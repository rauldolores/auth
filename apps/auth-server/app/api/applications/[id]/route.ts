import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Update an application's own homepage_url and/or linked OAuth client.
 * Gated by RLS "owning org admins can update their application"
 * (owner_organization_id is not null and is_org_admin(owner_organization_id))
 * — admin-panel currently does this same update via a direct client-side
 * Supabase call; this route is the same RLS-authorized mutation, just
 * reachable server-to-server too (MCP, external integrations).
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "PATCH, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { homepageUrl?: string; oauthClientId?: string } | null;
  if (!body || (body.homepageUrl === undefined && body.oauthClientId === undefined)) {
    return NextResponse.json({ error: "homepageUrl u oauthClientId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const update: Record<string, string> = {};
  if (body.homepageUrl !== undefined) update.homepage_url = body.homepageUrl;
  if (body.oauthClientId !== undefined) update.oauth_client_id = body.oauthClientId;

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("applications")
    .update(update)
    .eq("id", id)
    .select("id, homepage_url, oauth_client_id")
    .single();

  if (error) {
    logError("PATCH /api/applications/[id]", error, { id });
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });
  }

  return NextResponse.json({ application: data }, { headers: corsHeaders() });
}
