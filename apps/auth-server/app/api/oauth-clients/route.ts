import { verifyRequest } from "@kontrolia/auth/server";
import { logError, logSecurityEvent } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const RATE_LIMIT = { max: 30, windowMs: 5 * 60 * 1000 };

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/**
 * Registers/lists OAuth 2.1 clients (redirect_uris/client_id — the login
 * SSO mechanism, not the permission-catalog registration in
 * /api/applications/sync) from admin-panel instead of requiring an operator
 * to run the GoTrue admin API curl command by hand with the service-role
 * key. That key never leaves this server: only requests already verified
 * as is_platform_admin get to trigger it, and admin-panel only ever sees
 * the client_id back, never the key itself.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Returns an error NextResponse if the caller isn't a verified platform admin, otherwise null. */
async function authorizePlatformAdmin(request: Request): Promise<NextResponse | null> {
  const ip = clientIp(request);
  const rateLimit = checkRateLimit(`oauth-clients:${ip ?? "unknown"}`, RATE_LIMIT);
  if (!rateLimit.allowed) {
    logSecurityEvent("oauth-clients: rate limited", { ip });
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const { claims } = await verifyRequest(request, { supabaseUrl: process.env.SUPABASE_URL! });
    if (!claims.is_platform_admin) {
      return NextResponse.json({ error: "Se requiere ser platform admin" }, { status: 403, headers: corsHeaders() });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });
  }
}

/**
 * GoTrue's own error responses don't consistently use an `error` field —
 * e.g. the OAuth-server-disabled case is `{code, error_code, msg}`, with
 * no `error` key at all. Forwarding that shape as-is left admin-panel's
 * `data.error ?? "No se pudo registrar el cliente."` fallback swallowing
 * the real reason every time GoTrue's response didn't happen to match.
 * Normalize so `.error` always carries something readable, whatever GoTrue
 * actually called it, while still passing through the raw fields too.
 */
function normalizeGotrueError(data: unknown): Record<string, unknown> {
  const body = (data ?? {}) as Record<string, unknown>;
  const message = [body.error_description, body.msg, body.error, body.message].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return message ? { ...body, error: message } : body;
}

const GOTRUE_ADMIN_TIMEOUT_MS = 10_000;

/** Wraps the call to GoTrue's admin OAuth API — a network-level failure (bad SUPABASE_URL, DNS, etc.) here would otherwise throw uncaught and crash the route with an opaque 500. A hung GoTrue instance would otherwise hang this route handler indefinitely — AbortSignal.timeout() bounds it instead. */
async function callGotrueAdmin(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/oauth/clients${path}`, {
      ...init,
      signal: AbortSignal.timeout(GOTRUE_ADMIN_TIMEOUT_MS),
      // Supabase Cloud's gateway (Kong) rejects requests missing `apikey`
      // even when Authorization already carries a valid service-role JWT —
      // the two checks are independent. Without this, every call here
      // failed with "No API key found in request", previously invisible
      // because the old error-forwarding code didn't surface `.message`.
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        ...init?.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, body: response.ok ? data : normalizeGotrueError(data) };
  } catch (error) {
    logError("oauth-clients:callGotrueAdmin", error, { path });
    const message = error instanceof Error && error.name === "TimeoutError" ? "Supabase tardó demasiado en responder" : (error as Error).message;
    return { status: 502, body: { error: `No se pudo contactar a Supabase: ${message}` } };
  }
}

export async function GET(request: Request) {
  const denied = await authorizePlatformAdmin(request);
  if (denied) return denied;

  const { status, body } = await callGotrueAdmin("");
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const denied = await authorizePlatformAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { client_name?: string; redirect_uris?: string[] } | null;
  if (!body?.client_name || !body.redirect_uris?.length) {
    return NextResponse.json(
      { error: "client_name y redirect_uris son requeridos" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { status, body: responseBody } = await callGotrueAdmin("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      client_type: "public",
      token_endpoint_auth_method: "none",
    }),
  });
  return NextResponse.json(responseBody, { status, headers: corsHeaders() });
}

export async function PUT(request: Request) {
  const denied = await authorizePlatformAdmin(request);
  if (denied) return denied;

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const body = (await request.json().catch(() => null)) as { client_name?: string; redirect_uris?: string[] } | null;
  if (!body?.client_name || !body.redirect_uris?.length) {
    return NextResponse.json(
      { error: "client_name y redirect_uris son requeridos" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { status, body: responseBody } = await callGotrueAdmin(`/${clientId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: body.client_name, redirect_uris: body.redirect_uris }),
  });
  return NextResponse.json(responseBody, { status, headers: corsHeaders() });
}
