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

/**
 * Shared core of every `kapp_...`-authenticated endpoint: rate limit, extract
 * the Bearer key, look up the application by slug, hash-compare the key
 * (constant-time), and touch `api_key_last_used_at` on success. Callers
 * supply their own `slug` (from a request body, a header — wherever that
 * specific route's contract puts it) rather than this helper extracting it
 * itself, so existing contracts (e.g. `/api/applications/sync`'s
 * body.slug) don't have to change to share this logic.
 *
 * Returns a NextResponse directly on any failure — callers just
 * `return`/pass it straight through — or `{ application, admin }` on
 * success.
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
    .select("id, api_key_hash, owner_organization_id")
    .eq("slug", slug)
    .maybeSingle<{ id: string; api_key_hash: string | null; owner_organization_id: string | null }>();

  if (lookupError) {
    logError(`${routeLabel}: application lookup`, lookupError, { slug });
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!application) return NextResponse.json({ error: "Aplicación no encontrada" }, { status: 404 });
  if (!application.api_key_hash) {
    logSecurityEvent(`${routeLabel}: no key configured`, { slug, ip });
    return NextResponse.json(
      {
        error:
          "Esta aplicación no tiene una clave de sincronización. Vuelve a registrarla con el instalador (CLI) para generar una.",
      },
      { status: 403 },
    );
  }
  if (!safeEqualHex(hashApplicationApiKey(apiKey), application.api_key_hash)) {
    logSecurityEvent(`${routeLabel}: invalid key`, { slug, ip });
    return NextResponse.json({ error: "Clave inválida" }, { status: 401 });
  }

  // Fire-and-forget: a "last used" signal for the rotate/revoke UI is a
  // nice-to-have, not worth failing (or even delaying) a legitimate,
  // already-authenticated call over.
  void admin
    .schema("kontrolia_auth")
    .from("applications")
    .update({ api_key_last_used_at: new Date().toISOString() })
    .eq("id", application.id)
    .then(({ error: touchError }) => {
      if (touchError) logError(`${routeLabel}: touch api_key_last_used_at`, touchError, { slug });
    });

  return {
    application: { id: application.id, slug, ownerOrganizationId: application.owner_organization_id },
    admin,
  };
}
