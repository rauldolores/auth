import { authorizePlatformAdmin, callGotrueAdmin, oauthClientsCorsHeaders } from "@/lib/gotrue-admin";
import { logError, logSecurityEvent } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * Idempotently creates (once, ever) the reserved OAuth client for MCP agent
 * connections (Claude Code, Claude Desktop, ChatGPT connectors, ...) and
 * records its client_id on instance_settings — so a platform admin never
 * has to manually register "a" client just to hand an agent a client_id,
 * the way Applications' per-app OAuth dialog requires for genuine app SSO.
 * Called by admin-panel's "Clientes OAuth" screen on first load if
 * instance_settings.mcp_oauth_client_id is still null; every call after
 * that is a no-op that just returns the existing id.
 */

const CORS = oauthClientsCorsHeaders("POST, OPTIONS");

// Claude.ai/Desktop's connector callback — fixed, the same for every user,
// confirmed live against a real connection attempt. Not every MCP client
// has a fixed callback (Claude Code CLI's is a variable localhost port
// chosen at connect time) — those still get added to this same client's
// redirect_uris by hand, from the Clientes OAuth screen, same as any other
// client. This bootstrap only seeds the one URI that's actually fixed.
const DEFAULT_REDIRECT_URIS = ["https://claude.ai/api/mcp/auth_callback"];
const MCP_CLIENT_NAME = "MCP — Agentes de IA";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const denied = await authorizePlatformAdmin(request, CORS);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();

  const { data: settings, error: settingsError } = await admin
    .schema("kontrolia_auth")
    .from("instance_settings")
    .select("mcp_oauth_client_id")
    .eq("id", true)
    .maybeSingle<{ mcp_oauth_client_id: string | null }>();
  if (settingsError) {
    logError("POST /api/oauth-clients/mcp-bootstrap (read)", settingsError);
    return NextResponse.json({ error: settingsError.message }, { status: 500, headers: CORS });
  }
  if (settings?.mcp_oauth_client_id) {
    return NextResponse.json({ clientId: settings.mcp_oauth_client_id }, { headers: CORS });
  }

  const { status, body } = await callGotrueAdmin("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: MCP_CLIENT_NAME,
      redirect_uris: DEFAULT_REDIRECT_URIS,
      client_type: "public",
      token_endpoint_auth_method: "none",
    }),
  });
  if (status >= 400) {
    logError("POST /api/oauth-clients/mcp-bootstrap (create)", body);
    return NextResponse.json(body, { status, headers: CORS });
  }

  const clientId = body.client_id as string | undefined;
  if (!clientId) {
    return NextResponse.json({ error: "GoTrue creó el cliente pero no devolvió un client_id." }, { status: 502, headers: CORS });
  }

  const { error: updateError } = await admin
    .schema("kontrolia_auth")
    .from("instance_settings")
    .update({ mcp_oauth_client_id: clientId })
    .eq("id", true);
  if (updateError) {
    logError("POST /api/oauth-clients/mcp-bootstrap (persist)", updateError, { clientId });
    return NextResponse.json({ error: updateError.message }, { status: 500, headers: CORS });
  }

  logSecurityEvent("oauth-clients: mcp client bootstrapped", { clientId });
  return NextResponse.json({ clientId }, { status: 201, headers: CORS });
}
