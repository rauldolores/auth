import { verifyRequest } from "@kontrolia/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * Lets an existing platform admin grant/revoke the role for someone else by
 * email — the follow-up to the very first admin, which
 * bootstrap_first_platform_admin() (migration 0017) grants automatically to
 * whoever signs up first on a fresh install. Without this, adding a SECOND
 * admin would need direct database access same as before, just delayed by
 * one grant — the whole point is nobody ever needs that.
 */

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

async function authorizePlatformAdmin(request: Request): Promise<{ userId: string } | NextResponse> {
  try {
    const { claims } = await verifyRequest(request, { supabaseUrl: process.env.SUPABASE_URL! });
    if (!claims.is_platform_admin) {
      return NextResponse.json({ error: "Se requiere ser platform admin" }, { status: 403, headers: corsHeaders() });
    }
    return { userId: claims.sub };
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });
  }
}

async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { users: { id: string; email: string }[] };
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function GET(request: Request) {
  const authResult = await authorizePlatformAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.schema("kontrolia").from("platform_admins").select("user_id, granted_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });

  const admins = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: user } = await admin.auth.admin.getUserById(row.user_id as string);
      return { userId: row.user_id, email: user.user?.email ?? "(desconocido)", grantedAt: row.granted_at };
    }),
  );

  return NextResponse.json({ admins }, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const authResult = await authorizePlatformAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  if (!body?.email) {
    return NextResponse.json({ error: "email es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const user = await findUserByEmail(body.email);
  if (!user) {
    return NextResponse.json(
      { error: "No hay ningún usuario registrado con ese correo." },
      { status: 404, headers: corsHeaders() },
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("kontrolia")
    .from("platform_admins")
    .upsert({ user_id: user.id, granted_by: authResult.userId }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });

  return NextResponse.json({ userId: user.id, email: user.email }, { status: 201, headers: corsHeaders() });
}

export async function DELETE(request: Request) {
  const authResult = await authorizePlatformAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId es requerido" }, { status: 400, headers: corsHeaders() });

  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .schema("kontrolia")
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true });
  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "No puedes quitar al último platform admin — la instalación se quedaría sin ninguno." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { error } = await admin.schema("kontrolia").from("platform_admins").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
