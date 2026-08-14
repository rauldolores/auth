import { applicationApiKeyDisplayPrefix, generateApplicationApiKey, hashApplicationApiKey } from "@kontrolia/db";
import { authenticateBearer } from "@/lib/bearer-auth";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * List (GET) or create (POST) API keys for an application. Unlike the old
 * single applications.api_key_hash, a key here is scoped to whichever
 * organization it's generated for — RLS ("org admins can create application
 * keys for their org") is the actual authorization boundary: it requires
 * the caller to administer organizationId AND that organization to have
 * this application enabled (application_organizations), so this route
 * itself does no extra scope-checking beyond passing the caller's own
 * bearer-scoped client through.
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

interface KeyRow {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_by: string | null;
  created_at: string;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("application_api_keys")
    .select("id, organization_id, name, key_prefix, last_used_at, expires_at, revoked_at, revoked_by, created_by, created_at")
    .eq("application_id", id)
    .order("created_at", { ascending: false })
    .returns<KeyRow[]>();

  if (error) {
    logError("GET /api/applications/[id]/keys", error, { id });
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders() });
  }

  const keys = (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ keys }, { headers: corsHeaders() });
}

interface CreateKeyBody {
  organizationId?: string;
  name?: string;
  expiresAt?: string | null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authenticateBearer(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as CreateKeyBody | null;
  if (!body?.organizationId || !body.name?.trim()) {
    return NextResponse.json(
      { error: "organizationId y name son requeridos" },
      { status: 400, headers: corsHeaders() },
    );
  }
  if (body.expiresAt && Number.isNaN(Date.parse(body.expiresAt))) {
    return NextResponse.json({ error: "expiresAt debe ser una fecha válida" }, { status: 400, headers: corsHeaders() });
  }

  const { data: userData } = await auth.caller.auth.getUser();
  const plaintext = generateApplicationApiKey();

  const { data, error } = await auth.caller
    .schema("kontrolia_auth")
    .from("application_api_keys")
    .insert({
      application_id: id,
      organization_id: body.organizationId,
      name: body.name.trim(),
      key_hash: hashApplicationApiKey(plaintext),
      key_prefix: applicationApiKeyDisplayPrefix(plaintext),
      expires_at: body.expiresAt ?? null,
      created_by: userData.user?.id ?? null,
    })
    .select("id, name, organization_id, key_prefix, expires_at, created_at")
    .single();

  if (error) {
    logError("POST /api/applications/[id]/keys", error, { id, organizationId: body.organizationId });
    // RLS rejects with a generic "new row violates row-level security policy"
    // — translated here since the two real causes (not an admin of that org,
    // or that org doesn't have this application enabled) are worth telling
    // apart from an actual server error.
    const message = error.message.includes("row-level security")
      ? "No tienes permiso para crear una clave para esa organización — confirma que la administras y que tiene esta aplicación habilitada."
      : error.message;
    return NextResponse.json({ error: message }, { status: error.message.includes("row-level security") ? 403 : 400, headers: corsHeaders() });
  }

  // Shown once — only the hash is ever stored, matching the column's own ACL.
  return NextResponse.json(
    {
      id: data.id,
      name: data.name,
      organizationId: data.organization_id,
      keyPrefix: data.key_prefix,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      apiKey: plaintext,
    },
    { status: 201, headers: corsHeaders() },
  );
}
