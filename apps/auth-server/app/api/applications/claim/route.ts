import { verifyRequest } from "@kontrolia/auth/server";
import { logError, logSecurityEvent } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/application-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

const RATE_LIMIT = { max: 30, windowMs: 5 * 60 * 1000 };

/**
 * Lets a platform admin assign the first owner to an application that
 * doesn't have one yet — closes INT-API-007/INT-API-008/PQ-TECH-010:
 * applications.owner_organization_id was never written by any code path in
 * the product (registerApplication()'s INSERT omits it, the CLI wizard runs
 * before any org necessarily exists), leaving the rotate/revoke API-key UI,
 * migration 0022's owning-org UPDATE policy, and the applications/members
 * API all unreachable for any application registered the intended way.
 * Platform-admin-gated (not self-service for any org) to match migration
 * 0010's own design comment that the application catalog is "platform-level,
 * managed via service_role from the auth-server admin API" — and runs as
 * service_role for exactly that reason, since no RLS policy permits this
 * write for anyone else. Only ever assigns an owner where none exists yet;
 * migration 0034's prevent_application_ownership_reassignment trigger blocks
 * changing it again afterward for any caller but this one.
 */

function corsHeaders(): HeadersInit {
  const origin = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL;
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      }
    : {};
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

async function authorizePlatformAdmin(request: Request): Promise<NextResponse | null> {
  const ip = clientIp(request);
  const rateLimit = checkRateLimit(`applications-claim:${ip ?? "unknown"}`, RATE_LIMIT);
  if (!rateLimit.allowed) {
    logSecurityEvent("applications/claim: rate limited", { ip });
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const { claims } = await verifyRequest(request, { supabaseUrl: process.env.SUPABASE_URL! });
    if (!claims.is_platform_admin) {
      return NextResponse.json({ error: "Se requiere ser platform admin" }, { status: 403, headers: corsHeaders() });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: corsHeaders() });
  }
}

interface ClaimBody {
  applicationId?: string;
  organizationId?: string;
}

export async function POST(request: Request) {
  const denied = await authorizePlatformAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as ClaimBody | null;
  if (!body?.applicationId || !body.organizationId) {
    return NextResponse.json({ error: "applicationId y organizationId son requeridos" }, { status: 400, headers: corsHeaders() });
  }

  const admin = createSupabaseAdminClient();

  const { data: application, error: lookupError } = await admin
    .schema("kontrolia_auth")
    .from("applications")
    .select("id, owner_organization_id")
    .eq("id", body.applicationId)
    .maybeSingle<{ id: string; owner_organization_id: string | null }>();

  if (lookupError) {
    logError("POST /api/applications/claim", lookupError, { applicationId: body.applicationId });
    return NextResponse.json({ error: lookupError.message }, { status: 500, headers: corsHeaders() });
  }
  if (!application) {
    return NextResponse.json({ error: "Aplicación no encontrada" }, { status: 404, headers: corsHeaders() });
  }
  if (application.owner_organization_id) {
    return NextResponse.json(
      { error: "Esta aplicación ya tiene una organización propietaria." },
      { status: 409, headers: corsHeaders() },
    );
  }

  const { data: organization, error: orgLookupError } = await admin
    .schema("kontrolia_auth")
    .from("organizations")
    .select("id")
    .eq("id", body.organizationId)
    .maybeSingle();
  if (orgLookupError) {
    logError("POST /api/applications/claim", orgLookupError, { organizationId: body.organizationId });
    return NextResponse.json({ error: orgLookupError.message }, { status: 500, headers: corsHeaders() });
  }
  if (!organization) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404, headers: corsHeaders() });
  }

  const { data: updated, error: updateError } = await admin
    .schema("kontrolia_auth")
    .from("applications")
    .update({ owner_organization_id: body.organizationId })
    .eq("id", body.applicationId)
    .select("id, slug, owner_organization_id")
    .single();
  if (updateError) {
    logError("POST /api/applications/claim", updateError, { applicationId: body.applicationId, organizationId: body.organizationId });
    return NextResponse.json({ error: updateError.message }, { status: 500, headers: corsHeaders() });
  }

  return NextResponse.json({ application: updated }, { headers: corsHeaders() });
}
