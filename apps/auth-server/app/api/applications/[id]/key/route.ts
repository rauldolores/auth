import { generateApplicationApiKey, hashApplicationApiKey } from "@kontrolia/db";
import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Rotate (POST) or revoke (DELETE) an application's kapp_ sync key. Same RLS
 * as applications/[id]'s PATCH gates both. Key generation moves server-side
 * here — admin-panel's UI currently generates and hashes the key
 * client-side (mirroring this exact logic in the browser bundle); doing it
 * here means the plaintext never has to round-trip through a client-side
 * hashing step at all, a real security improvement, not just a port.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const plaintext = generateApplicationApiKey();
  const { error } = await auth.caller
    .schema("kontrolia_auth")
    .from("applications")
    .update({ api_key_hash: hashApplicationApiKey(plaintext), api_key_last_used_at: null })
    .eq("id", id);

  if (error) {
    logError("POST /api/applications/[id]/key", error, { id });
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });
  }

  // Shown once — the hash is all that's ever stored, matching applications.api_key_hash's own column-level ACL.
  return NextResponse.json({ apiKey: plaintext }, { headers: corsHeaders() });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { error } = await auth.caller
    .schema("kontrolia_auth")
    .from("applications")
    .update({ api_key_hash: null, api_key_last_used_at: null })
    .eq("id", id);

  if (error) {
    logError("DELETE /api/applications/[id]/key", error, { id });
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
