import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { resolveEmails } from "@/lib/resolve-emails";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

/**
 * Query the audit log, gated by RLS "org admins can view audit logs".
 * admin-panel's current page shows a raw actor_user_id (or "sistema" for
 * trigger-originated rows) since it queries Supabase directly with no
 * server-side resolution — this route resolves actor emails the same way
 * organization-members/platform-admins already do, a real improvement over
 * what's on screen today, not just a port of it.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

const AUDIT_LOGS_PAGE_SIZE = 50;

interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function GET(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId es requerido" }, { status: 400, headers: corsHeaders() });
  }
  const offset = Number(url.searchParams.get("offset") ?? "0") || 0;
  const action = url.searchParams.get("action");
  const actorUserId = url.searchParams.get("actorUserId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = auth.caller
    .schema("kontrolia_auth")
    .from("audit_logs")
    .select("id, actor_user_id, action, target_type, target_id, metadata, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + AUDIT_LOGS_PAGE_SIZE - 1);

  if (action) query = query.eq("action", action);
  if (actorUserId) query = query.eq("actor_user_id", actorUserId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query.returns<AuditLogRow[]>();

  if (error) {
    logError("GET /api/audit-logs", error, { organizationId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  const rows = data ?? [];
  const admin = createSupabaseAdminClient();
  const actorIds = [...new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => id !== null))];
  const emailById = await resolveEmails(admin, actorIds);

  const logs = rows.map((row) => ({
    ...row,
    actorEmail: row.actor_user_id ? (emailById.get(row.actor_user_id) ?? "(desconocido)") : null,
  }));

  return NextResponse.json({ logs, hasMore: rows.length === AUDIT_LOGS_PAGE_SIZE }, { headers: corsHeaders() });
}
