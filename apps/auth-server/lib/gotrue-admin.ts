import { verifyRequest } from "@kontrolia/auth/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError, logSecurityEvent } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Shared by every route that proxies GoTrue's OAuth-client admin API
 * (apps/auth-server/app/api/oauth-clients/route.ts and
 * .../oauth-clients/mcp-bootstrap/route.ts) — extracted once a second call
 * site needed the same rate limit, auth gate, and error-normalization
 * logic rather than re-implementing GoTrue's inconsistent error shapes
 * twice.
 */

const RATE_LIMIT = { max: 30, windowMs: 5 * 60 * 1000 };
const GOTRUE_ADMIN_TIMEOUT_MS = 10_000;

export function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export function oauthClientsCorsHeaders(methods: string): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": methods,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

/** Returns an error NextResponse if the caller isn't a verified platform admin, otherwise null. */
export async function authorizePlatformAdmin(request: Request, corsHeaders: HeadersInit): Promise<NextResponse | null> {
  const ip = clientIp(request);
  const rateLimit = checkRateLimit(`oauth-clients:${ip ?? "unknown"}`, RATE_LIMIT);
  if (!rateLimit.allowed) {
    logSecurityEvent("oauth-clients: rate limited", { ip });
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { ...corsHeaders, "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const { claims } = await verifyRequest(request, { supabaseUrl: process.env.SUPABASE_URL! });
    if (!claims.is_platform_admin) {
      return NextResponse.json({ error: "Se requiere ser platform admin" }, { status: 403, headers: corsHeaders });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders });
  }
}

/**
 * GoTrue's own error responses don't consistently use an `error` field —
 * e.g. the OAuth-server-disabled case is `{code, error_code, msg}`, with no
 * `error` key at all. Normalize so `.error` always carries something
 * readable, whatever GoTrue actually called it, while still passing
 * through the raw fields too.
 */
function normalizeGotrueError(data: unknown): Record<string, unknown> {
  const body = (data ?? {}) as Record<string, unknown>;
  const message = [body.error_description, body.msg, body.error, body.message].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return message ? { ...body, error: message } : body;
}

/** Wraps a call to GoTrue's admin OAuth-clients API — bounds a hung GoTrue instance instead of hanging the route handler indefinitely, and never lets a network-level failure (bad SUPABASE_URL, DNS, ...) throw uncaught into an opaque 500. */
export async function callGotrueAdmin(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/oauth/clients${path}`, {
      ...init,
      signal: AbortSignal.timeout(GOTRUE_ADMIN_TIMEOUT_MS),
      // Supabase Cloud's gateway (Kong) rejects requests missing `apikey`
      // even when Authorization already carries a valid service-role JWT —
      // the two checks are independent.
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
