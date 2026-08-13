import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/** Delete a custom role. RLS ("org admins can delete custom roles") already
 * blocks system roles and non-admin callers — no extra guard needed here. */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "DELETE, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { error } = await auth.caller.schema("kontrolia_auth").from("roles").delete().eq("id", id);
  if (error) {
    logError("DELETE /api/roles/[id]", error, { id });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
