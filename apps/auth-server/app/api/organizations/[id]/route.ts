import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Rename or delete a single organization. Both rely entirely on RLS to
 * decide who's allowed: PATCH needs "org admins can update their
 * organization" (Owner or Admin), DELETE needs the stricter
 * "org owners can delete their organization" (Owner only, migration 0021)
 * — deleting cascades through every membership/role/invitation/audit-log
 * row for this org, a different level of consequence than a rename.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createRouteHandlerSupabaseClient();
  const body = (await request.json().catch(() => null)) as { name?: string } | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name es requerido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema("kontrolia_auth")
    .from("organizations")
    .update({ name: body.name.trim() })
    .eq("id", id)
    .select("id, name, slug")
    .single();

  if (error) {
    // RLS filters the row out of the UPDATE instead of raising a permission
    // error — .single() then fails with PGRST116 ("no rows"), which reads
    // like a database bug to an end user. It just means the caller isn't
    // Owner/Admin here (or the org doesn't exist).
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "No tienes permiso para editar esta organización (solo Owner y Admin pueden), o ya no existe." },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ organization: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createRouteHandlerSupabaseClient();

  // RLS silently filters rows out of the operation instead of erroring —
  // an org that exists but isn't owned by the caller "deletes" 0 rows with
  // no error, so `count` is the only way to tell that apart from success.
  const { error, count } = await supabase
    .schema("kontrolia_auth")
    .from("organizations")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!count) {
    return NextResponse.json(
      { error: "No tienes permiso para eliminar esta organización (solo el Owner puede), o ya no existe." },
      { status: 403 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
