import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Read-only by design: permissions are never created by hand — an
 * application declares its own catalog via POST /api/applications/sync
 * (its own kapp_ key). RLS ("org members can view permissions of their
 * enabled apps") is the actual scope; ?applicationId= just narrows within
 * what the caller can already see.
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

interface PermissionRow {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
  application: { id: string; name: string } | null;
}

const PERMISSIONS_PAGE_SIZE = 200;

export async function GET(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");
  const offset = Number(url.searchParams.get("offset") ?? "0") || 0;

  let query = auth.caller
    .schema("kontrolia_auth")
    .from("permissions")
    .select("id, key, resource, action, description, application:applications(id, name)")
    .order("key")
    .range(offset, offset + PERMISSIONS_PAGE_SIZE - 1);

  if (applicationId) query = query.eq("application_id", applicationId);

  const { data, error } = await query.returns<PermissionRow[]>();

  if (error) {
    logError("GET /api/permissions", error, { applicationId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  const permissions = data ?? [];
  return NextResponse.json(
    { permissions, hasMore: permissions.length === PERMISSIONS_PAGE_SIZE },
    { headers: corsHeaders() },
  );
}
