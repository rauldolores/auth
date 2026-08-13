import { extractBearerToken, scopedClient, type ScopedClient } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { resolveEmails } from "@/lib/resolve-emails";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * admin-panel's Users page could only ever show a raw user_id without
 * resolving emails server-side (see resolveEmails). Only for membership rows
 * the caller's own token can already see: the org-membership check itself is
 * just RLS on the caller's own bearer token, not a separate permission check
 * here, so this can never leak a member list for an org the caller doesn't
 * belong to.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

const MEMBERS_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId es requerido" }, { status: 400, headers: corsHeaders() });
  }
  const membershipId = url.searchParams.get("membershipId");
  const offset = Number(url.searchParams.get("offset") ?? "0") || 0;

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
  let query = caller
    .schema("kontrolia_auth")
    .from("memberships")
    .select(
      "id, user_id, status, created_at, membership_roles(role:roles(id, name, slug, application_id, application:applications(name)))",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  // A single membershipId lookup (the user-detail page) skips pagination
  // entirely rather than paying the cost of fetching a whole page to find
  // one row.
  query = membershipId
    ? query.eq("id", membershipId)
    : query.range(offset, offset + MEMBERS_PAGE_SIZE - 1);

  const { data: memberships, error } = await query.returns<MembershipWithRoles[]>();

  if (error) {
    logError("GET /api/organization-members", error, { organizationId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  const admin = createSupabaseAdminClient();
  const emailById = await resolveEmails(admin, (memberships ?? []).map((row) => row.user_id));
  const members = (memberships ?? []).map((row) => {
    const roles = row.membership_roles.map((mr) => mr.role).filter((role): role is RoleInfo => role !== null);
    return {
      membershipId: row.id,
      userId: row.user_id,
      email: emailById.get(row.user_id) ?? "(desconocido)",
      status: row.status,
      createdAt: row.created_at,
      roles,
    };
  });

  const hasMore = !membershipId && members.length === MEMBERS_PAGE_SIZE;
  return NextResponse.json({ members, hasMore }, { headers: corsHeaders() });
}

/**
 * Shared guard for both DELETE and PATCH-to-suspended: removing or
 * suspending the organization's only Owner would lock everyone out of
 * managing it just as effectively as deleting the org itself, so both
 * mutations refuse it the same way.
 */
async function wouldRemoveLastOwner(caller: ScopedClient, membershipId: string): Promise<{ blocked: boolean; error?: string }> {
  interface MembershipWithRoleSlugs {
    organization_id: string;
    membership_roles: { role: { slug: string } | null }[];
  }

  const { data: membership } = await caller
    .schema("kontrolia_auth")
    .from("memberships")
    .select("organization_id, membership_roles(role:roles(slug))")
    .eq("id", membershipId)
    .returns<MembershipWithRoleSlugs[]>()
    .maybeSingle();

  const roleSlugs = (membership?.membership_roles ?? []).map((mr) => mr.role?.slug).filter(Boolean);
  if (!membership || !roleSlugs.includes("owner")) return { blocked: false };

  const { data: ownerRole } = await caller
    .schema("kontrolia_auth")
    .from("roles")
    .select("id")
    .is("organization_id", null)
    .eq("slug", "owner")
    .single();

  // Must count only *active* owners — suspending doesn't remove this row
  // the way deleting does, so an unfiltered count would let an org get
  // suspended down to zero active Owners one PATCH at a time.
  const { count: ownerCount } = await caller
    .schema("kontrolia_auth")
    .from("membership_roles")
    .select("membership_id, memberships!inner(organization_id, status)", { count: "exact", head: true })
    .eq("role_id", ownerRole?.id)
    .eq("memberships.organization_id", membership.organization_id)
    .eq("memberships.status", "active");

  return { blocked: (ownerCount ?? 0) <= 1 };
}

export async function PATCH(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });

  const membershipId = new URL(request.url).searchParams.get("membershipId");
  if (!membershipId) {
    return NextResponse.json({ error: "membershipId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "active" && body?.status !== "suspended") {
    return NextResponse.json({ error: 'status debe ser "active" o "suspended"' }, { status: 400, headers: corsHeaders() });
  }

  // Same access model as DELETE/GET: "org admins manage memberships" RLS is
  // the actual gate, not a check in this route.
  const caller = scopedClient(token);

  if (body.status === "suspended") {
    const { blocked } = await wouldRemoveLastOwner(caller, membershipId);
    if (blocked) {
      return NextResponse.json(
        { error: "No puedes suspender al único Owner de la organización." },
        { status: 400, headers: corsHeaders() },
      );
    }
  }

  const { error } = await caller
    .schema("kontrolia_auth")
    .from("memberships")
    .update({ status: body.status })
    .eq("id", membershipId);
  if (error) {
    logError("PATCH /api/organization-members", error, { membershipId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
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

  const { blocked } = await wouldRemoveLastOwner(caller, membershipId);
  if (blocked) {
    return NextResponse.json(
      { error: "No puedes quitar al único Owner de la organización." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { error } = await caller.schema("kontrolia_auth").from("memberships").delete().eq("id", membershipId);
  if (error) {
    logError("DELETE /api/organization-members", error, { membershipId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
