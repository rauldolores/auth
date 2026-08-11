import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

export interface AssignableRoleCheck {
  role: { id: string; slug: string; is_system_role: boolean } | null;
  error: string | null;
  /** HTTP status a caller should respond with when `role` is null. */
  status?: number;
}

/**
 * A role is assignable through the external applications API when it's
 * either a non-Owner system role (Admin/Member) or a custom role that
 * belongs to the same organization as the calling application. Granting
 * Owner through this surface is never allowed: it's the one case
 * kontrolia_auth's own last-owner-protection trigger exempts the
 * service-role client this API runs as
 * (`prevent_admin_granting_owner_role`'s `auth.role() = 'service_role'`
 * bypass, needed for org-bootstrap), so the application layer has to be the
 * enforcement point here — the database won't catch it for this caller.
 */
export async function loadAssignableRole(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  roleId: string,
  organizationId: string,
): Promise<AssignableRoleCheck> {
  const { data: role, error } = await admin
    .schema("kontrolia_auth")
    .from("roles")
    .select("id, slug, is_system_role, organization_id")
    .eq("id", roleId)
    .maybeSingle<{ id: string; slug: string; is_system_role: boolean; organization_id: string | null }>();

  if (error) return { role: null, error: error.message, status: 500 };
  if (!role) return { role: null, error: "Rol no encontrado", status: 404 };
  if (role.is_system_role && role.slug === "owner") {
    return { role: null, error: "No se puede otorgar el rol de Owner a través de la API externa.", status: 403 };
  }
  if (!role.is_system_role && role.organization_id !== organizationId) {
    return { role: null, error: "Este rol no pertenece a la organización de la aplicación.", status: 403 };
  }

  return { role: { id: role.id, slug: role.slug, is_system_role: role.is_system_role }, error: null };
}
