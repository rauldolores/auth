import { authorizePlatformAdmin } from "@/lib/gotrue-admin";
import { logSecurityEvent } from "@/lib/logger";
import { disconnectConnection, getConnectionStatus, isOauthConfigured } from "@/lib/supabase-oauth-connection";
import { NextResponse } from "next/server";

/**
 * Status + disconnect for this installation's OAuth connection to
 * Supabase's Management API (see lib/supabase-oauth-connection.ts). The
 * actual authorize/token-exchange flow lives in
 * app/api/supabase-connection/callback — this route is just what
 * admin-panel's Social login screen polls before offering the "Conectar"
 * button, and what "Desconectar" calls.
 */

const RATE_LIMIT_KEY_PREFIX = "supabase-connection";

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const denied = await authorizePlatformAdmin(request, corsHeaders(), RATE_LIMIT_KEY_PREFIX);
  if (denied) return denied;

  const oauthConfigured = isOauthConfigured();
  const status = oauthConfigured ? await getConnectionStatus() : null;

  return NextResponse.json(
    {
      // false means no platform admin has ever registered a Supabase OAuth
      // App for this installation (SUPABASE_OAUTH_CLIENT_ID/SECRET unset) —
      // the "Conectar con Supabase" button has nothing to redirect to yet.
      oauthConfigured,
      connected: status !== null,
      connectedAt: status?.connectedAt ?? null,
      // Not a secret — safe to hand to admin-panel so it can build the
      // authorize URL itself.
      clientId: oauthConfigured ? (process.env.SUPABASE_OAUTH_CLIENT_ID ?? null) : null,
    },
    { headers: corsHeaders() },
  );
}

export async function DELETE(request: Request) {
  const denied = await authorizePlatformAdmin(request, corsHeaders(), RATE_LIMIT_KEY_PREFIX);
  if (denied) return denied;

  const result = await disconnectConnection();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500, headers: corsHeaders() });

  logSecurityEvent("supabase-connection: disconnected", {});
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
