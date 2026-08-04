import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Organizations the caller belongs to — used to populate <OrgSwitcher>.
 * Deliberately NOT carried in the JWT (see the risks section of the
 * architecture plan): only the *active* organization's roles/permissions
 * live in the token, so the membership list is fetched here instead.
 */
export async function GET() {
  const supabase = await createRouteHandlerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  interface MembershipOrgRow {
    organization: { id: string; name: string; slug: string } | null;
  }

  const { data, error } = await supabase
    .schema("kontrolia")
    .from("memberships")
    .select("organization:organizations(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .returns<MembershipOrgRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ organizations: data.map((row: MembershipOrgRow) => row.organization) });
}

export async function POST(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const body = (await request.json()) as { name?: string; slug?: string };

  if (!body.name || !body.slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  // The kontrolia.on_organization_created trigger auto-enrolls the caller as
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
    .schema("kontrolia")
    .from("organizations")
    .insert({ name: body.name, slug: body.slug });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const { data, error } = await supabase
    .schema("kontrolia")
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", body.slug)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ organization: data }, { status: 201 });
}
