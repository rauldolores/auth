import { verifyRequest } from "@kontrolia/auth/server";
import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const denied = await authorizePlatformAdmin(request);
  if (denied) return denied;

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/oauth/clients`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status, headers: corsHeaders() });
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

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/oauth/clients`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      client_type: "public",
      token_endpoint_auth_method: "none",
    }),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status, headers: corsHeaders() });
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

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/oauth/clients/${clientId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_name: body.client_name, redirect_uris: body.redirect_uris }),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status, headers: corsHeaders() });
}
