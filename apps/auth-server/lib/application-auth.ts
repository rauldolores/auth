import { timingSafeEqual } from "node:crypto";
import { hashApplicationApiKey } from "@kontrolia/db";
import { logError, logSecurityEvent } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

const DEFAULT_RATE_LIMIT = { max: 30, windowMs: 5 * 60 * 1000 };

export interface AuthenticatedApplication {
  id: string;
  slug: string;
  /** The organization the matched key was generated for — may differ from ownerOrganizationId (any org with this application enabled can hold its own key). */
  organizationId: string;
  /** The application's actual owner (kontrolia_auth.applications.owner_organization_id) — only operations on the application's own catalog/metadata should check this, not member-management ones. */
  ownerOrganizationId: string | null;
}

/** Best-effort client IP for logging only — never used for anything
 * security-decision-relevant, so a spoofed header here can't be abused for
 * more than a misleading log line. */
export function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

function extractApiKey(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

function safeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

interface CandidateKeyRow {
  id: string;
  organization_id: string;
  key_hash: string;
}

/**
 * Shared core of every `kapp_...`-authenticated endpoint: rate limit,
 * extract the Bearer key, look up the application by slug, then hash-compare
 * the key (constant-time) against every one of that application's active
 * (non-revoked, non-expired) keys — there's no way to know which specific
 * key a caller is using until one matches, and a real application realistically
 * only ever holds a handful of active keys at once, so a linear scan here is
 * fine. Touches `last_used_at` on the matched key row on success. Callers
 * supply their own `slug` (from a request body, a header — wherever that
 * specific route's contract puts it) rather than this helper extracting it
 * itself, so existing contracts (e.g. `/api/applications/sync`'s
 * body.slug) don't have to change to share this logic.
 *
 * Returns a NextResponse directly on any failure — callers just
 * `return`/pass it straight through — or `{ application, admin }` on
 * success, where `application.organizationId` is whichever organization the
 * *matched key* was generated for (not necessarily the application's own
 * owner_organization_id — see application_api_keys' organization_id).
 */
export async function authenticateApplication(
  request: Request,
  slug: string | null,
  routeLabel: string,
  rateLimit: { max: number; windowMs: number } = DEFAULT_RATE_LIMIT,
): Promise<{ application: AuthenticatedApplication; admin: ReturnType<typeof createSupabaseAdminClient> } | NextResponse> {
  const ip = clientIp(request);
  const limitResult = checkRateLimit(`${routeLabel}:${ip ?? "unknown"}`, rateLimit);
  if (!limitResult.allowed) {
    logSecurityEvent(`${routeLabel}: rate limited`, { ip });
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(limitResult.retryAfterSeconds) } },
    );
  }

  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: "Falta el header Authorization: Bearer <api key>" }, { status: 401 });
  }
  if (!slug) {
    return NextResponse.json({ error: "Falta el identificador de la aplicación (slug)" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: application, error: lookupError } = await admin
    .schema("kontrolia_auth")
    .from("applications")
    .select("id, owner_organization_id")
    .eq("slug", slug)
    .maybeSingle<{ id: string; owner_organization_id: string | null }>();

  if (lookupError) {
    logError(`${routeLabel}: application lookup`, lookupError, { slug });
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!application) return NextResponse.json({ error: "Aplicación no encontrada" }, { status: 404 });

  const nowIso = new Date().toISOString();
  const { data: candidates, error: keysError } = await admin
    .schema("kontrolia_auth")
    .from("application_api_keys")
    .select("id, organization_id, key_hash")
    .eq("application_id", application.id)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .returns<CandidateKeyRow[]>();

  if (keysError) {
    logError(`${routeLabel}: key lookup`, keysError, { slug });
    return NextResponse.json({ error: keysError.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    logSecurityEvent(`${routeLabel}: no active key configured`, { slug, ip });
    return NextResponse.json(
      { error: "Esta aplicación no tiene ninguna clave activa. Genera una desde Aplicaciones en el admin-panel." },
      { status: 403 },
    );
  }

  const hashed = hashApplicationApiKey(apiKey);
  const matched = candidates.find((candidate) => safeEqualHex(hashed, candidate.key_hash));
  if (!matched) {
    logSecurityEvent(`${routeLabel}: invalid key`, { slug, ip });
    return NextResponse.json({ error: "Clave inválida" }, { status: 401 });
  }

  // Fire-and-forget: a "last used" signal for the key list UI is a
  // nice-to-have, not worth failing (or even delaying) a legitimate,
  // already-authenticated call over.
  void admin
    .schema("kontrolia_auth")
    .from("application_api_keys")
    .update({ last_used_at: nowIso })
    .eq("id", matched.id)
    .then(({ error: touchError }) => {
      if (touchError) logError(`${routeLabel}: touch last_used_at`, touchError, { slug, keyId: matched.id });
    });

  return {
    application: {
      id: application.id,
      slug,
      organizationId: matched.organization_id,
      ownerOrganizationId: application.owner_organization_id,
    },
    admin,
  };
}
