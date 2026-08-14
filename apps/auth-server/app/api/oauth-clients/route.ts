import { logError, logSecurityEvent } from "@/lib/logger";
import { authorizePlatformAdmin, callGotrueAdmin, oauthClientsCorsHeaders } from "@/lib/gotrue-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * Registers/lists/updates/deletes OAuth 2.1 clients (redirect_uris/client_id
 * — the login SSO mechanism, not the permission-catalog registration in
 * /api/applications/sync) from admin-panel instead of requiring an operator
 * to run the GoTrue admin API curl command by hand with the service-role
 * key. That key never leaves this server: only requests already verified
 * as is_platform_admin get to trigger it, and admin-panel only ever sees
 * the client_id back, never the key itself.
 */

const CORS = oauthClientsCorsHeaders("GET, POST, PUT, DELETE, OPTIONS");

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const denied = await authorizePlatformAdmin(request, CORS);
  if (denied) return denied;

  const { status, body } = await callGotrueAdmin("");
  return NextResponse.json(body, { status, headers: CORS });
}

export async function POST(request: Request) {
  const denied = await authorizePlatformAdmin(request, CORS);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { client_name?: string; redirect_uris?: string[] } | null;
  if (!body?.client_name || !body.redirect_uris?.length) {
    return NextResponse.json({ error: "client_name y redirect_uris son requeridos" }, { status: 400, headers: CORS });
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
  return NextResponse.json(responseBody, { status, headers: CORS });
}

export async function PUT(request: Request) {
  const denied = await authorizePlatformAdmin(request, CORS);
  if (denied) return denied;

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId es requerido" }, { status: 400, headers: CORS });
  }

  const body = (await request.json().catch(() => null)) as { client_name?: string; redirect_uris?: string[] } | null;
  if (!body?.client_name || !body.redirect_uris?.length) {
    return NextResponse.json({ error: "client_name y redirect_uris son requeridos" }, { status: 400, headers: CORS });
  }

  const { status, body: responseBody } = await callGotrueAdmin(`/${clientId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: body.client_name, redirect_uris: body.redirect_uris }),
  });
  return NextResponse.json(responseBody, { status, headers: CORS });
}

export async function DELETE(request: Request) {
  const denied = await authorizePlatformAdmin(request, CORS);
  if (denied) return denied;

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId es requerido" }, { status: 400, headers: CORS });
  }

  const admin = createSupabaseAdminClient();

  const [{ data: settings }, { data: linkedApp }] = await Promise.all([
    admin.schema("kontrolia_auth").from("instance_settings").select("mcp_oauth_client_id").eq("id", true).maybeSingle<{ mcp_oauth_client_id: string | null }>(),
    admin.schema("kontrolia_auth").from("applications").select("name").eq("oauth_client_id", clientId).maybeSingle<{ name: string }>(),
  ]);

  if (settings?.mcp_oauth_client_id === clientId) {
    return NextResponse.json(
      { error: "Este es el cliente reservado para conectar agentes de IA (MCP) — no se puede eliminar." },
      { status: 403, headers: CORS },
    );
  }
  if (linkedApp) {
    return NextResponse.json(
      { error: `Este cliente está vinculado a la aplicación "${linkedApp.name}" — desvincúlalo desde Aplicaciones antes de eliminarlo.` },
      { status: 409, headers: CORS },
    );
  }

  const { status, body: responseBody } = await callGotrueAdmin(`/${clientId}`, { method: "DELETE" });
  if (status < 400) logSecurityEvent("oauth-clients: deleted", { clientId });
  else logError("DELETE /api/oauth-clients", responseBody, { clientId });
  return status === 204 ? new NextResponse(null, { status: 204, headers: CORS }) : NextResponse.json(responseBody, { status, headers: CORS });
}
