import { authenticateCookieOrBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

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
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = await params;
  const { caller: supabase } = await authenticateCookieOrBearer(request);

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

/** Enables an application for this organization. RLS "org admins enable/disable applications for their org" (migration 0018) is the actual gate. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = await params;
  const { caller: supabase } = await authenticateCookieOrBearer(request);

  const body = (await request.json().catch(() => null)) as { applicationId?: string } | null;
  if (!body?.applicationId) {
    return NextResponse.json({ error: "applicationId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const { error } = await supabase
    .schema("kontrolia_auth")
    .from("application_organizations")
    .insert({ application_id: body.applicationId, organization_id: organizationId });

  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });

  return new NextResponse(null, { status: 201, headers: corsHeaders() });
}

/** Disables an application for this organization. Same RLS as POST. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = await params;
  const { caller: supabase } = await authenticateCookieOrBearer(request);

  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const { error } = await supabase
    .schema("kontrolia_auth")
    .from("application_organizations")
    .delete()
    .eq("application_id", applicationId)
    .eq("organization_id", organizationId);

  if (error) {
    logError("DELETE /api/organizations/[id]/applications", error, { organizationId, applicationId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
