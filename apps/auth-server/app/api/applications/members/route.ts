import { authenticateApplication } from "@/lib/application-auth";
import { loadAssignableRole } from "@/lib/assignable-role";
import { logError } from "@/lib/logger";
import { resolveEmails } from "@/lib/resolve-emails";
import { NextResponse } from "next/server";

const MEMBERS_PAGE_SIZE = 100;

function applicationSlug(request: Request): string | null {
  return request.headers.get("x-application-slug")?.trim() || null;
}

interface RoleInfo {
  id: string;
  name: string;
  slug: string;
  application_id: string | null;
}
interface MembershipWithRoles {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  membership_roles: { role: RoleInfo | null }[];
}

/**
 * Lets an already-registered application (authenticated the same way as
 * /api/applications/sync — Bearer kapp_ key — identified via
 * X-Application-Slug here since GET/DELETE have no body to carry a slug in)
 * list the members of *its own* organization: the org that owns the
 * application, never one supplied by the caller. That scoping is enforced
 * entirely in this route (the admin client bypasses RLS, so there's no
 * database-level backstop for it here) — every query below is explicitly
 * filtered by application.ownerOrganizationId.
 */
export async function GET(request: Request) {
  const auth = await authenticateApplication(request, applicationSlug(request), "applications/members:list");
  if (auth instanceof NextResponse) return auth;
  const { application, admin } = auth;

  if (!application.ownerOrganizationId) {
    return NextResponse.json({ error: "Esta aplicación no está asociada a una organización." }, { status: 409 });
  }

  const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0") || 0;

  const { data: memberships, error } = await admin
    .schema("kontrolia_auth")
    .from("memberships")
    .select("id, user_id, status, created_at, membership_roles(role:roles(id, name, slug, application_id))")
    .eq("organization_id", application.ownerOrganizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + MEMBERS_PAGE_SIZE - 1)
    .returns<MembershipWithRoles[]>();

  if (error) {
    logError("GET /api/applications/members", error, { applicationId: application.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const emailById = await resolveEmails(admin, (memberships ?? []).map((row) => row.user_id));
  const members = (memberships ?? []).map((row) => ({
    membershipId: row.id,
    userId: row.user_id,
    email: emailById.get(row.user_id) ?? "(desconocido)",
    status: row.status,
    createdAt: row.created_at,
    roles: row.membership_roles.map((mr) => mr.role).filter((role): role is RoleInfo => role !== null),
  }));

  return NextResponse.json({ members, hasMore: members.length === MEMBERS_PAGE_SIZE });
}

interface InviteBody {
  email?: string;
  roleId?: string;
}

/**
 * Creates an invitation for the application's own organization. Mirrors
 * POST /api/invitations (same table, same "no email provider configured"
 * contract — the caller gets the token back to deliver however it already
 * sends mail), but gated by an application API key instead of a user
 * session, so role_id can't rely on "org admins manage invitations" RLS —
 * loadAssignableRole() is the actual gate here, and the database's own
 * prevent_owner_role_invitation trigger (migration 0033) backstops it.
 */
export async function POST(request: Request) {
  const auth = await authenticateApplication(request, applicationSlug(request), "applications/members:invite");
  if (auth instanceof NextResponse) return auth;
  const { application, admin } = auth;

  if (!application.ownerOrganizationId) {
    return NextResponse.json({ error: "Esta aplicación no está asociada a una organización." }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as InviteBody | null;
  if (!body?.email) {
    return NextResponse.json({ error: "email es requerido" }, { status: 400 });
  }

  if (body.roleId) {
    const { role, error: roleError, status } = await loadAssignableRole(admin, body.roleId, application.ownerOrganizationId);
    if (!role) return NextResponse.json({ error: roleError }, { status: status ?? 400 });
  }

  const { data, error } = await admin
    .schema("kontrolia_auth")
    .from("invitations")
    .insert({ organization_id: application.ownerOrganizationId, email: body.email, role_id: body.roleId ?? null })
    .select("id, email, token, expires_at")
    .single();

  if (error) {
    logError("POST /api/applications/members", error, { applicationId: application.id });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invitation: data }, { status: 201 });
}
