import { authenticateCookieOrBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Organizations the caller belongs to — used to populate <OrgSwitcher>.
 * Deliberately NOT carried in the JWT (see the risks section of the
 * architecture plan): only the *active* organization's roles/permissions
 * live in the token, so the membership list is fetched here instead.
 *
 * Cookie-or-bearer auth: auth-server's own dashboard calls this same-origin
 * with its session cookie (unchanged); a bearer token (MCP, admin-panel,
 * external callers) works identically since it's the same RLS underneath.
 */
export async function GET(request: Request) {
  const { caller: supabase } = await authenticateCookieOrBearer(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  interface MembershipOrgRow {
    organization: { id: string; name: string; slug: string } | null;
  }

  const { data, error } = await supabase
    .schema("kontrolia_auth")
    .from("memberships")
    .select("organization:organizations(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .returns<MembershipOrgRow[]>();

  if (error) {
    logError("GET /api/organizations", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organizations: data.map((row: MembershipOrgRow) => row.organization) });
}

export async function POST(request: Request) {
  const { caller: supabase } = await authenticateCookieOrBearer(request);
  const body = (await request.json()) as { name?: string; slug?: string };

  if (!body.name || !body.slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  // The kontrolia_auth.on_organization_created trigger auto-enrolls the caller as
  // Owner in the same transaction — no separate membership call needed.
  //
  // Deliberately NOT using .select().single() (INSERT ... RETURNING) here:
  // the "members can view their organizations" SELECT policy depends on
  // the membership row the trigger just created, and Postgres evaluates
  // RETURNING's visibility check via a STABLE function whose result can be
  // cached from before the trigger ran within the same statement — so the
  // RETURNING row intermittently fails RLS even though the insert itself
  // succeeded. A follow-up SELECT in a fresh statement sees it correctly.
  const { error: insertError } = await supabase
    .schema("kontrolia_auth")
    .from("organizations")
    .insert({ name: body.name, slug: body.slug });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const { data, error } = await supabase
    .schema("kontrolia_auth")
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", body.slug)
    .single();

  if (error) {
    logError("POST /api/organizations", error, { slug: body.slug });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organization: data }, { status: 201 });
}
