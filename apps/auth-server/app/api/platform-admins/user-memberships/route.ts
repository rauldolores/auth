import { verifyRequest } from "@kontrolia/auth/server";
import { clientIp } from "@/lib/application-auth";
import { findUserByEmail } from "@/lib/find-user-by-email";
import { logError, logSecurityEvent } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

const RATE_LIMIT = { max: 30, windowMs: 5 * 60 * 1000 };

/**
 * Lets a platform admin see every organization a given user (by email)
 * belongs to across the whole installation, and remove them from any of
 * them — self-service organization creation (any authenticated user can
 * create one and become its Owner) has no equivalent self-service way to
 * *leave* one, and there was previously no cross-org view at all: `/users`
 * in admin-panel only ever shows members of the currently active
 * organization, one at a time. Runs as service_role since this is
 * inherently a cross-organization query no RLS policy is meant to allow.
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

async function authorizePlatformAdmin(request: Request): Promise<NextResponse | null> {
  const ip = clientIp(request);
  const rateLimit = checkRateLimit(`platform-admins-user-memberships:${ip ?? "unknown"}`, RATE_LIMIT);
  if (!rateLimit.allowed) {
    logSecurityEvent("platform-admins/user-memberships: rate limited", { ip });
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const { claims } = await verifyRequest(request, { supabaseUrl: process.env.SUPABASE_URL! });
    if (!claims.is_platform_admin) {
      return NextResponse.json({ error: "Se requiere ser platform admin" }, { status: 403, headers: corsHeaders() });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });
  }
}

interface MembershipWithOrgAndRoles {
  id: string;
  status: string;
  created_at: string;
  organization: { id: string; name: string } | null;
  membership_roles: { role: { name: string; slug: string } | null }[];
}

export async function GET(request: Request) {
  const denied = await authorizePlatformAdmin(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const email = params.get("email")?.trim();
  const userId = params.get("userId")?.trim();
  if (!email && !userId) {
    return NextResponse.json({ error: "email o userId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const admin = createSupabaseAdminClient();

  // The detail page already knows the user's id (it came from
  // organization-members) — skip the GoTrue email-search round-trip
  // findUserByEmail() would otherwise need, and just resolve the id's email
  // directly for the response shape below.
  const user = userId
    ? await admin.auth.admin.getUserById(userId).then(({ data }) => (data.user ? { id: data.user.id, email: data.user.email ?? "" } : null))
    : await findUserByEmail(email!);
  if (!user) {
    return NextResponse.json({ error: "No hay ningún usuario registrado con ese correo." }, { status: 404, headers: corsHeaders() });
  }
  const { data, error } = await admin
    .schema("kontrolia_auth")
    .from("memberships")
    .select("id, status, created_at, organization:organizations(id, name), membership_roles(role:roles(name, slug))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<MembershipWithOrgAndRoles[]>();

  if (error) {
    logError("GET /api/platform-admins/user-memberships", error, { email });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  const memberships = (data ?? [])
    .filter((row) => row.organization !== null)
    .map((row) => ({
      membershipId: row.id,
      organizationId: row.organization!.id,
      organizationName: row.organization!.name,
      status: row.status,
      createdAt: row.created_at,
      roles: row.membership_roles.map((mr) => mr.role).filter((role): role is { name: string; slug: string } => role !== null),
    }));

  return NextResponse.json({ user: { id: user.id, email: user.email }, memberships }, { headers: corsHeaders() });
}

export async function DELETE(request: Request) {
  const denied = await authorizePlatformAdmin(request);
  if (denied) return denied;

  const membershipId = new URL(request.url).searchParams.get("membershipId");
  if (!membershipId) {
    return NextResponse.json({ error: "membershipId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  // No app-layer last-owner check needed: prevent_last_owner_membership_removal
  // (packages/db/migrations/0026, re-anchored in 0030) has no service_role
  // exemption, unlike the owner-*grant* trigger — it protects this delete for
  // every caller, this route included, and its raised exception surfaces
  // verbatim below.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.schema("kontrolia_auth").from("memberships").delete().eq("id", membershipId);
  if (error) {
    logError("DELETE /api/platform-admins/user-memberships", error, { membershipId });
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
