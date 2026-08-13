import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/** Revoke (DELETE) or resend (PATCH — regenerate token + expires_at) a
 * pending invitation. Same RLS policy as the collection route gates both. */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Matches the DB's own token shape (24 random bytes, hex-encoded) — mirrors admin-panel's randomToken(). */
function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { error } = await auth.caller.schema("kontrolia_auth").from("invitations").delete().eq("id", id);
  if (error) {
    logError("DELETE /api/invitations/[id]", error, { id });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const newToken = randomToken();

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("invitations")
    .update({ expires_at: newExpiry, token: newToken })
    .eq("id", id)
    .select("token, expires_at")
    .single();

  if (error) {
    logError("PATCH /api/invitations/[id]", error, { id });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return NextResponse.json({ invitation: data }, { headers: corsHeaders() });
}
