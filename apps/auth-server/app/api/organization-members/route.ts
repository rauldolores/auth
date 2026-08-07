import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * kontrolia.memberships has no email column (that lives in auth.users,
 * which RLS-scoped browser queries can never reach) — admin-panel's Users
 * page could only ever show a raw user_id. This resolves emails
 * server-side, but only for membership rows the caller's own token can
 * already see: the org-membership check itself is just RLS on the
 * caller's own bearer token, not a separate permission check here, so this
 * can never leak a member list for an org the caller doesn't belong to.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

function scopedClient(token: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function GET(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });

  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  interface RoleInfo {
    id: string;
    name: string;
    slug: string;
    application_id: string | null;
    application: { name: string } | null;
  }
  interface MembershipWithRoles {
    id: string;
    user_id: string;
    status: string;
    created_at: string;
    membership_roles: { role: RoleInfo | null }[];
  }

  // RLS on the caller's own token is the access check — this only ever
  // returns rows for an org the caller already belongs to.
  const caller = scopedClient(token);
  const { data: memberships, error } = await caller
    .schema("kontrolia")
    .from("memberships")
    .select(
      "id, user_id, status, created_at, membership_roles(role:roles(id, name, slug, application_id, application:applications(name)))",
    )
    .eq("organization_id", organizationId)
    .returns<MembershipWithRoles[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });

  const admin = createSupabaseAdminClient();
  const members = await Promise.all(
    (memberships ?? []).map(async (row) => {
      const { data: user } = await admin.auth.admin.getUserById(row.user_id);
      const roles = row.membership_roles.map((mr) => mr.role).filter((role): role is RoleInfo => role !== null);
      return {
        membershipId: row.id,
        userId: row.user_id,
        email: user.user?.email ?? "(desconocido)",
        status: row.status,
        createdAt: row.created_at,
        roles,
      };
    }),
  );

  return NextResponse.json({ members }, { headers: corsHeaders() });
}

export async function DELETE(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });

  const membershipId = new URL(request.url).searchParams.get("membershipId");
  if (!membershipId) {
    return NextResponse.json({ error: "membershipId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  // "org admins manage memberships" RLS policy is the access check — a
  // non-admin's own token simply can't delete anyone's row, this call
  // fails with the same error either way.
  const caller = scopedClient(token);

  interface MembershipWithRoleSlugs {
    organization_id: string;
    membership_roles: { role: { slug: string } | null }[];
  }

  const { data: membership } = await caller
    .schema("kontrolia")
    .from("memberships")
    .select("organization_id, membership_roles(role:roles(slug))")
    .eq("id", membershipId)
    .returns<MembershipWithRoleSlugs[]>()
    .maybeSingle();

  const roleSlugs = (membership?.membership_roles ?? []).map((mr) => mr.role?.slug).filter(Boolean);

  if (membership && roleSlugs.includes("owner")) {
    const { data: ownerRole } = await caller
      .schema("kontrolia")
      .from("roles")
      .select("id")
      .is("organization_id", null)
      .eq("slug", "owner")
      .single();

    const { count: ownerCount } = await caller
      .schema("kontrolia")
      .from("membership_roles")
      .select("membership_id, memberships!inner(organization_id)", { count: "exact", head: true })
      .eq("role_id", ownerRole?.id)
      .eq("memberships.organization_id", membership.organization_id);

    if ((ownerCount ?? 0) <= 1) {
      return NextResponse.json(
        { error: "No puedes quitar al único Owner de la organización." },
        { status: 400, headers: corsHeaders() },
      );
    }
  }

  const { error } = await caller.schema("kontrolia").from("memberships").delete().eq("id", membershipId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
