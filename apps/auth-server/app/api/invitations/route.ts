import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Creates an invitation, gated by kontrolia's RLS policy "org admins manage
 * invitations" (the insert fails outright for a non-admin caller — this
 * route trusts the database, not application code, for that check).
 * Sending the actual email is a v1.5 item (see the roadmap); this returns
 * the invitation token so it can be wired to a provider later.
 */
export async function POST(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const body = (await request.json()) as { organizationId?: string; email?: string; roleId?: string };

  if (!body.organizationId || !body.email) {
    return NextResponse.json({ error: "organizationId and email are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema("kontrolia")
    .from("invitations")
    .insert({ organization_id: body.organizationId, email: body.email, role_id: body.roleId ?? null })
    .select("id, email, token, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // TODO(v1.5): send the invitation email via the configured provider.
  return NextResponse.json({ invitation: data }, { status: 201 });
}
