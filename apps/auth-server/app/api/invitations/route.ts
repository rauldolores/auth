import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Creates an invitation, gated by kontrolia's RLS policy "org admins manage
 * invitations" (the insert fails outright for a non-admin caller — this
 * route trusts the database, not application code, for that check).
 *
 * KontrolIA Auth has no configured email provider of its own, so this
 * intentionally does not send anything — it returns the invitation token so
 * the caller can build `${authServerUrl}/invitations/accept?token=...}` and
 * share it however they already send mail (their own SMTP/provider, Slack,
 * etc.). admin-panel's Invitations page surfaces this same link with a
 * copy button for the same reason.
 */
export async function POST(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const body = (await request.json()) as { organizationId?: string; email?: string; roleId?: string };

  if (!body.organizationId || !body.email) {
    return NextResponse.json({ error: "organizationId and email are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema("kontrolia_auth")
    .from("invitations")
    .insert({ organization_id: body.organizationId, email: body.email, role_id: body.roleId ?? null })
    .select("id, email, token, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // TODO(v1.5): send the invitation email via the configured provider.
  return NextResponse.json({ invitation: data }, { status: 201 });
}
