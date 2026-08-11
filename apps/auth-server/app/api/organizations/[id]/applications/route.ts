import { logError } from "@/lib/logger";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

interface RoleRow {
  slug: string;
  application_id: string | null;
}

interface MembershipRoleRow {
  roles: RoleRow | null;
}

interface MembershipRow {
  membership_roles: MembershipRoleRow[];
}

interface ApplicationRow {
  id: string;
  name: string;
  slug: string;
  homepage_url: string | null;
}

interface EnabledAppRow {
  applications: ApplicationRow | null;
}

/**
 * Applications the caller can actually use inside this organization — the
 * home-page "launcher". Owner/Admin see every app the org has enabled
 * (they administer that decision); everyone else only sees apps where they
 * hold an app-scoped role (e.g. "Administrador de Facturación" or a custom
 * role for that app) — being a Member of the org isn't itself access to
 * any particular application.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = await params;
  const supabase = await createRouteHandlerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabase.schema("kontrolia_auth");

  const { data: membership, error: membershipError } = await db
    .from("memberships")
    .select("membership_roles(roles(slug, application_id))")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle<MembershipRow>();

  if (membershipError) {
    logError("GET /api/organizations/[id]/applications", membershipError, { organizationId });
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }
  if (!membership) return NextResponse.json({ applications: [] });

  const roles = membership.membership_roles.map((mr) => mr.roles).filter((role): role is RoleRow => role !== null);
  const isOrgAdmin = roles.some((role) => role.application_id === null && ["owner", "admin"].includes(role.slug));
  const accessibleAppIds = new Set(roles.filter((role) => role.application_id).map((role) => role.application_id as string));

  const { data: enabledRows, error: enabledError } = await db
    .from("application_organizations")
    .select("applications(id, name, slug, homepage_url)")
    .eq("organization_id", organizationId)
    .returns<EnabledAppRow[]>();

  if (enabledError) {
    logError("GET /api/organizations/[id]/applications", enabledError, { organizationId });
    return NextResponse.json({ error: enabledError.message }, { status: 500 });
  }

  const applications = enabledRows
    .map((row) => row.applications)
    .filter((app): app is ApplicationRow => app !== null)
    .filter((app) => isOrgAdmin || accessibleAppIds.has(app.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ applications });
}
