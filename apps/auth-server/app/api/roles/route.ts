import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * List/create roles. Gated by kontrolia_auth's RLS: "org admins can create
 * app-scoped custom roles" (checks the caller is an org admin AND the
 * target application is actually enabled for that org) and the org-wide
 * "members can view..." read policy. The slug is always computed here, not
 * trusted from the client — mirrors admin-panel's own slugify() exactly so
 * behavior doesn't change for anyone reading it as a custom role's URL-safe
 * identifier.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  is_system_role: boolean;
  grants_all_permissions: boolean;
  organization_id: string | null;
  application_id: string | null;
  application: { name: string } | null;
}

export async function GET(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId es requerido" }, { status: 400, headers: corsHeaders() });
  }

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("roles")
    .select("id, name, slug, is_system_role, grants_all_permissions, organization_id, application_id, application:applications(name)")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .order("name")
    .returns<RoleRow[]>();

  if (error) {
    logError("GET /api/roles", error, { organizationId });
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return NextResponse.json({ roles: data ?? [] }, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as
    | { organizationId?: string; applicationId?: string; name?: string }
    | null;
  if (!body?.organizationId || !body.applicationId || !body.name?.trim()) {
    return NextResponse.json(
      { error: "organizationId, applicationId y name son requeridos" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const name = body.name.trim();
  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("roles")
    .insert({ organization_id: body.organizationId, application_id: body.applicationId, name, slug: slugify(name) })
    .select("id, name, slug, is_system_role, grants_all_permissions, organization_id, application_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });

  return NextResponse.json({ role: data }, { status: 201, headers: corsHeaders() });
}
