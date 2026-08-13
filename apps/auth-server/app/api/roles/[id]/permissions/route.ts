import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/** List/grant/revoke a role's permissions. Gated by RLS "org admins manage
 * role permissions" (excludes grants_all_permissions roles — those are only
 * ever synced automatically, never hand-edited, per migration 0019). */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", id)
    .returns<{ permission_id: string }[]>();

  if (error) {
    logError("GET /api/roles/[id]/permissions", error, { id });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return NextResponse.json({ permissionIds: (data ?? []).map((row) => row.permission_id) }, { headers: corsHeaders() });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { permissionId?: string } | null;
  if (!body?.permissionId) {
    return NextResponse.json({ error: "permissionId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const { error } = await auth.caller
    .schema("kontrolia_auth")
    .from("role_permissions")
    .insert({ role_id: id, permission_id: body.permissionId });

  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });

  return new NextResponse(null, { status: 201, headers: corsHeaders() });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const url = new URL(request.url);
  const permissionId = url.searchParams.get("permissionId");
  if (!permissionId) {
    return NextResponse.json({ error: "permissionId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const { error } = await auth.caller
    .schema("kontrolia_auth")
    .from("role_permissions")
    .delete()
    .eq("role_id", id)
    .eq("permission_id", permissionId);

  if (error) {
    logError("DELETE /api/roles/[id]/permissions", error, { id, permissionId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
