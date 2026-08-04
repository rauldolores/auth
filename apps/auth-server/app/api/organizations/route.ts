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
  const { data, error } = await supabase
    .schema("kontrolia")
    .from("organizations")
    .insert({ name: body.name, slug: body.slug })
    .select("id, name, slug")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ organization: data }, { status: 201 });
}
