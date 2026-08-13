import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Grant/revoke a membership's app-scoped role — mirrors admin-panel's
 * per-app role dropdown (handleAppRoleChange), which does this same
 * insert/delete on membership_roles directly. RLS "org admins manage
 * membership roles" is the actual gate; the "one role per application"
 * trigger (migration 0019) still applies and its error message passes
 * through unchanged if a caller tries to grant a second role for the same
 * app without revoking the first.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as { membershipId?: string; roleId?: string } | null;
  if (!body?.membershipId || !body.roleId) {
    return NextResponse.json({ error: "membershipId y roleId son requeridos" }, { status: 400, headers: corsHeaders() });
  }

  const { error } = await auth.caller
    .schema("kontrolia_auth")
    .from("membership_roles")
    .insert({ membership_id: body.membershipId, role_id: body.roleId });

  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });

  return new NextResponse(null, { status: 201, headers: corsHeaders() });
}

export async function DELETE(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const membershipId = url.searchParams.get("membershipId");
  const roleId = url.searchParams.get("roleId");
  if (!membershipId || !roleId) {
    return NextResponse.json({ error: "membershipId y roleId son requeridos" }, { status: 400, headers: corsHeaders() });
  }

  const { error } = await auth.caller
    .schema("kontrolia_auth")
    .from("membership_roles")
    .delete()
    .eq("membership_id", membershipId)
    .eq("role_id", roleId);

  if (error) {
    logError("DELETE /api/organization-members/roles", error, { membershipId, roleId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
