import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

interface InvitationLookup {
  id: string;
  email: string;
  role_id: string | null;
  organization_id: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  organization: { name: string } | null;
  role: { name: string } | null;
}

async function findInvitation(token: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("kontrolia")
    .from("invitations")
    .select("id, email, role_id, organization_id, invited_by, accepted_at, expires_at, organization:organizations(name), role:roles(name)")
    .eq("token", token)
    .maybeSingle<InvitationLookup>();

  if (error || !data) return null;
  return data;
}

function invitationProblem(invitation: InvitationLookup): string | null {
  if (invitation.accepted_at) return "Esta invitación ya fue utilizada.";
  if (new Date(invitation.expires_at) < new Date()) return "Esta invitación expiró.";
  return null;
}

/** Preview an invitation before the visitor is necessarily signed in. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 400 });

  const invitation = await findInvitation(token);
  if (!invitation) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });

  const problem = invitationProblem(invitation);
  if (problem) return NextResponse.json({ error: problem }, { status: 410 });

  return NextResponse.json({
    email: invitation.email,
    organizationName: invitation.organization?.name ?? "",
    roleName: invitation.role?.name ?? null,
  });
}

/** Accepts an invitation for the currently signed-in caller. */
export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string };
  if (!body.token) return NextResponse.json({ error: "Falta el token" }, { status: 400 });

  const routeClient = await createRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await routeClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión primero" }, { status: 401 });

  const invitation = await findInvitation(body.token);
  if (!invitation) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });

  const problem = invitationProblem(invitation);
  if (problem) return NextResponse.json({ error: problem }, { status: 410 });

  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Esta invitación es para otro correo electrónico." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  const { data: existingMembership } = await admin
    .schema("kontrolia")
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", invitation.organization_id)
    .maybeSingle();

  let membershipId = existingMembership?.id as string | undefined;

  if (!membershipId) {
    const { data: newMembership, error: membershipError } = await admin
      .schema("kontrolia")
      .from("memberships")
      .insert({
        user_id: user.id,
        organization_id: invitation.organization_id,
        status: "active",
        invited_by: invitation.invited_by,
      })
      .select("id")
      .single();

    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
    membershipId = newMembership.id as string;
  }

  if (invitation.role_id) {
    await admin
      .schema("kontrolia")
      .from("membership_roles")
      .upsert({ membership_id: membershipId, role_id: invitation.role_id }, { onConflict: "membership_id,role_id" });
  }

  await admin.schema("kontrolia").from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitation.id);

  return NextResponse.json({ organizationId: invitation.organization_id });
}
