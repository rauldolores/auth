import { verifyRequest } from "@kontrolia/auth/server";
import { clientIp } from "@/lib/gotrue-admin";
import { logSecurityEvent } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { exchangeAuthorizationCode } from "@/lib/supabase-oauth-connection";
import { NextResponse } from "next/server";

/**
 * The token-exchange leg of connecting this installation to Supabase's
 * Management API via OAuth (see lib/supabase-oauth-connection.ts). Split
 * from app/api/supabase-connection/route.ts because this one needs the
 * caller's user id (to record connected_by) — a plain platform-admin gate
 * that only returns "denied or not" isn't enough here.
 *
 * Called by admin-panel's /oauth/supabase-callback page after Supabase
 * redirects back with an authorization code — never called directly by a
 * browser navigation, since it needs the platform admin's own bearer token
 * (a top-level redirect can't carry an Authorization header) and the
 * client_secret this route holds must never reach the browser.
 */

const RATE_LIMIT = { max: 10, windowMs: 5 * 60 * 1000 };

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

interface PostBody {
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rateLimit = checkRateLimit(`supabase-connection-callback:${ip ?? "unknown"}`, RATE_LIMIT);
  if (!rateLimit.allowed) {
    logSecurityEvent("supabase-connection-callback: rate limited", { ip });
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let userId: string;
  try {
    const { claims } = await verifyRequest(request, { supabaseUrl: process.env.SUPABASE_URL! });
    if (!claims.is_platform_admin) {
      return NextResponse.json({ error: "Se requiere ser platform admin" }, { status: 403, headers: corsHeaders() });
    }
    userId = claims.sub;
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });
  }

  const body = (await request.json().catch(() => null)) as PostBody | null;
  if (!body?.code || !body.codeVerifier || !body.redirectUri) {
    return NextResponse.json({ error: "code, codeVerifier y redirectUri son requeridos" }, { status: 400, headers: corsHeaders() });
  }

  const result = await exchangeAuthorizationCode({
    code: body.code,
    codeVerifier: body.codeVerifier,
    redirectUri: body.redirectUri,
    userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502, headers: corsHeaders() });
  }
  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
