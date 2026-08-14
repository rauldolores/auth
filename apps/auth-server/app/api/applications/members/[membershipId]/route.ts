import { authenticateApplication } from "@/lib/application-auth";
import { loadAssignableRole } from "@/lib/assignable-role";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

function applicationSlug(request: Request): string | null {
  return request.headers.get("x-application-slug")?.trim() || null;
}

// Every handler below confirms `membershipId` belongs to the calling
// application's own organization before any mutation touches it — the
// actual tenant-isolation boundary for this route, since the admin client
// bypasses RLS. A membership that exists but belongs to a different org is
// reported as 404, same as one that doesn't exist at all, so this can't be
// used to probe which membership ids are real in another org.

export async function DELETE(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params;
  const auth = await authenticateApplication(request, applicationSlug(request), "applications/members:remove");
  if (auth instanceof NextResponse) return auth;
  const { application, admin } = auth;

  const { data: membership } = await admin
    .schema("kontrolia_auth")
    .from("memberships")
    .select("id, organization_id")
    .eq("id", membershipId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (!membership || membership.organization_id !== application.organizationId) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  // No app-layer last-owner check needed here: prevent_last_owner_membership_removal
  // (packages/db/migrations/0026, re-anchored in 0030) has no service_role
  // exemption, unlike the owner-*grant* trigger — it protects this delete
  // for every caller, this API included.
  const { error } = await admin.schema("kontrolia_auth").from("memberships").delete().eq("id", membershipId);
  if (error) {
    logError("DELETE /api/applications/members/[membershipId]", error, { applicationId: application.id, membershipId });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}

interface RolesBody {
  grant?: string[];
  revoke?: string[];
}

/**
 * Grants and/or revokes role assignments for a member of the application's
 * own organization. Granting the Owner role is always rejected (see
 * loadAssignableRole) — that's the one case the database's own
 * last-owner-protection triggers exempt the service-role client this API
 * runs as, so this route is the actual enforcement point for it. Revoking
 * Owner is left to the database: prevent_last_owner_role_removal applies to
 * every caller and will reject it if this would leave the org without an
 * active Owner.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params;
  const auth = await authenticateApplication(request, applicationSlug(request), "applications/members:roles");
  if (auth instanceof NextResponse) return auth;
  const { application, admin } = auth;

  const body = (await request.json().catch(() => null)) as RolesBody | null;
  const grant = body?.grant ?? [];
  const revoke = body?.revoke ?? [];
  if (grant.length === 0 && revoke.length === 0) {
    return NextResponse.json({ error: "grant y/o revoke son requeridos" }, { status: 400 });
  }

  const { data: membership } = await admin
    .schema("kontrolia_auth")
    .from("memberships")
    .select("id, organization_id")
    .eq("id", membershipId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (!membership || membership.organization_id !== application.organizationId) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  // Validate every role id up front, before mutating anything, so a request
  // with one bad role id in a batch fails cleanly instead of partially
  // applying.
  for (const roleId of grant) {
    const { role, error: roleError, status } = await loadAssignableRole(admin, roleId, application.organizationId);
    if (!role) return NextResponse.json({ error: roleError }, { status: status ?? 400 });
  }
  for (const roleId of revoke) {
    const { data: role } = await admin
      .schema("kontrolia_auth")
      .from("roles")
      .select("id")
      .eq("id", roleId)
      .maybeSingle();
    if (!role) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
  }

  if (grant.length > 0) {
    const { error } = await admin
      .schema("kontrolia_auth")
      .from("membership_roles")
      .upsert(
        grant.map((roleId) => ({ membership_id: membershipId, role_id: roleId })),
        { onConflict: "membership_id,role_id" },
      );
    if (error) {
      logError("PATCH /api/applications/members/[membershipId] (grant)", error, { applicationId: application.id, membershipId });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (revoke.length > 0) {
    const { error } = await admin
      .schema("kontrolia_auth")
      .from("membership_roles")
      .delete()
      .eq("membership_id", membershipId)
      .in("role_id", revoke);
    if (error) {
      // Includes the last-owner-removal trigger's raised exception, surfaced
      // verbatim — e.g. "No puedes quitar el rol de Owner al único Owner
      // activo de la organización."
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const { data: roles } = await admin
    .schema("kontrolia_auth")
    .from("membership_roles")
    .select("role:roles(id, name, slug)")
    .eq("membership_id", membershipId);

  return NextResponse.json({ roles: (roles ?? []).map((r) => r.role).filter(Boolean) });
}
