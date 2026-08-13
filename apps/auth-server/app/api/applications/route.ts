import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * Read-only application catalog — every application registered in this
 * install, not scoped to one organization (admin-panel's Applications page
 * separates "enabled for my org" vs "available" client-side from this same
 * full list). Gated by RLS "authenticated users can browse the application
 * catalog" (SELECT is broad by design; write policies are what actually
 * restrict who can touch a given row).
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

interface ApplicationRow {
  id: string;
  name: string;
  slug: string;
  environment: string;
  owner_organization_id: string | null;
  homepage_url: string | null;
  oauth_client_id: string | null;
}

const APPLICATIONS_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? "0") || 0;

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("applications")
    .select("id, name, slug, environment, owner_organization_id, homepage_url, oauth_client_id")
    .order("name")
    .range(offset, offset + APPLICATIONS_PAGE_SIZE - 1)
    .returns<ApplicationRow[]>();

  if (error) {
    logError("GET /api/applications", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  const applications = data ?? [];
  return NextResponse.json(
    { applications, hasMore: applications.length === APPLICATIONS_PAGE_SIZE },
    { headers: corsHeaders() },
  );
}
