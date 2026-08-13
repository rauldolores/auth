import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Create/list invitations, gated by kontrolia_auth's RLS policy "org admins
 * manage invitations" (insert/select fail outright for a non-admin caller —
 * this route trusts the database, not application code, for that check).
 * Bearer-token auth (not cookies) so the same route works cross-origin from
 * admin-panel and from the MCP server, matching organization-members'
 * pattern — nothing calls this route's POST today (admin-panel inserts
 * directly), so converting it here carries no behavior change for anyone.
 *
 * KontrolIA Auth has no configured email provider of its own, so POST
 * intentionally does not send anything — it returns the invitation token so
 * the caller can build `${authServerUrl}/invitations/accept?token=...}` and
 * share it however they already send mail.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

const INVITATIONS_PAGE_SIZE = 50;

interface InvitationRow {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  role: { name: string } | null;
}

export async function GET(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId es requerido" }, { status: 400, headers: corsHeaders() });
  }
  const offset = Number(url.searchParams.get("offset") ?? "0") || 0;

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("invitations")
    .select("id, email, token, created_at, expires_at, accepted_at, role:roles(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + INVITATIONS_PAGE_SIZE - 1)
    .returns<InvitationRow[]>();

  if (error) {
    logError("GET /api/invitations", error, { organizationId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  const invitations = data ?? [];
  return NextResponse.json(
    { invitations, hasMore: invitations.length === INVITATIONS_PAGE_SIZE },
    { headers: corsHeaders() },
  );
}

export async function POST(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as { organizationId?: string; email?: string; roleId?: string } | null;
  if (!body?.organizationId || !body.email) {
    return NextResponse.json({ error: "organizationId y email son requeridos" }, { status: 400, headers: corsHeaders() });
  }

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("invitations")
    .insert({ organization_id: body.organizationId, email: body.email, role_id: body.roleId ?? null })
    .select("id, email, token, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });

  return NextResponse.json({ invitation: data }, { status: 201, headers: corsHeaders() });
}
