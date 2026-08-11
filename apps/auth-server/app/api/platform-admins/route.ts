import { verifyRequest } from "@kontrolia/auth/server";
import { logError } from "@/lib/logger";
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

const GOTRUE_ADMIN_TIMEOUT_MS = 10_000;

async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
      {
        signal: AbortSignal.timeout(GOTRUE_ADMIN_TIMEOUT_MS),
        // Kong (Supabase Cloud's gateway) requires `apikey` on every request
        // independent of Authorization — same gap fixed in oauth-clients.
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { users: { id: string; email: string }[] };
    return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
  } catch (error) {
    // A hung/unreachable GoTrue would otherwise hang this route indefinitely
    // (no timeout) or crash it with an unlogged uncaught rejection (no
    // try/catch) — bound it and let the caller treat this the same as
    // "no user found" (POST already returns 404 for that case).
    logError("platform-admins:findUserByEmail", error);
    return null;
  }
}

/**
 * GoTrue's admin API has no "get users by id list" endpoint — the closest
 * thing to a batch fetch is paging through listUsers() once and building a
 * lookup map, instead of one getUserById() round-trip per row (which is
 * what this used to do, N concurrent admin-API calls for N platform admins).
 */
async function resolveEmails(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  const remaining = new Set(userIds);
  const perPage = 200;
  let page = 1;

  while (remaining.size > 0) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data || data.users.length === 0) break;
    for (const user of data.users) {
      if (remaining.has(user.id)) {
        emailById.set(user.id, user.email ?? "(desconocido)");
        remaining.delete(user.id);
      }
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return emailById;
}

const PLATFORM_ADMINS_PAGE_SIZE = 50;

export async function GET(request: Request) {
  const authResult = await authorizePlatformAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0") || 0;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("kontrolia_auth")
    .from("platform_admins")
    .select("user_id, granted_at")
    .order("granted_at", { ascending: false })
    .range(offset, offset + PLATFORM_ADMINS_PAGE_SIZE - 1);
  if (error) {
    logError("GET /api/platform-admins", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  const emailById = await resolveEmails(admin, (data ?? []).map((row) => row.user_id as string));
  const admins = (data ?? []).map((row) => ({
    userId: row.user_id,
    email: emailById.get(row.user_id as string) ?? "(desconocido)",
    grantedAt: row.granted_at,
  }));

  const hasMore = admins.length === PLATFORM_ADMINS_PAGE_SIZE;
  return NextResponse.json({ admins, hasMore }, { headers: corsHeaders() });
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
    .schema("kontrolia_auth")
    .from("platform_admins")
    .upsert({ user_id: user.id, granted_by: authResult.userId }, { onConflict: "user_id" });
  if (error) {
    logError("POST /api/platform-admins", error, { userId: user.id });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return NextResponse.json({ userId: user.id, email: user.email }, { status: 201, headers: corsHeaders() });
}

export async function DELETE(request: Request) {
  const authResult = await authorizePlatformAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId es requerido" }, { status: 400, headers: corsHeaders() });

  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .schema("kontrolia_auth")
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true });
  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "No puedes quitar al último platform admin — la instalación se quedaría sin ninguno." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { error } = await admin.schema("kontrolia_auth").from("platform_admins").delete().eq("user_id", userId);
  if (error) {
    logError("DELETE /api/platform-admins", error, { userId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
