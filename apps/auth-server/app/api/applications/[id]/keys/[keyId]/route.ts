import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/** Revokes (never deletes) a single application API key — RLS ("org admins can revoke their org's application keys") is the actual authorization boundary. */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "DELETE, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; keyId: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id, keyId } = await params;

  const { data: userData } = await auth.caller.auth.getUser();

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("application_api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_by: userData.user?.id ?? null })
    .eq("id", keyId)
    .eq("application_id", id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logError("DELETE /api/applications/[id]/keys/[keyId]", error, { id, keyId });
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Clave no encontrada, ya revocada, o no tienes permiso sobre su organización." },
      { status: 404, headers: corsHeaders() },
    );
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
