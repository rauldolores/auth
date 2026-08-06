import { type PermissionChecker, createPermissionChecker } from "@kontrolia/permissions";
import type { KontroliaTokenClaims, KontroliaUser } from "@kontrolia/shared";
import { type JWTVerifyResult, createRemoteJWKSet, jwtVerify } from "jose";
import { mapToKontroliaUser } from "./user-mapping.js";

export interface VerifyRequestConfig {
  /** Base Supabase URL, e.g. https://<project>.supabase.co or your self-hosted Kong URL. */
  supabaseUrl: string;
}

export interface VerifiedRequest {
  claims: KontroliaTokenClaims;
  checker: PermissionChecker;
  /**
   * The profile fields already carried by every Supabase-issued access
   * token (email, full name, avatar, locale, timezone) — no extra query.
   * `lastSeenAt` is always null here: it's the one KontroliaUser field
   * GoTrue doesn't put in the token, only in the client-side Session.user
   * object (see @kontrolia/auth's getUser()).
   */
  user: KontroliaUser;
}

/**
 * Maps decoded JWT claims to the same KontroliaUser shape the client SDK's
 * getUser() returns — everything here already came from the verified token,
 * so this never does I/O. verifyRequest() calls this for you; exported
 * separately in case a caller already has claims from elsewhere.
 */
export function getUserFromClaims(claims: KontroliaTokenClaims): KontroliaUser {
  return mapToKontroliaUser({
    id: claims.sub,
    email: claims.email,
    user_metadata: claims.user_metadata,
    lastSeenAt: null,
  });
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(supabaseUrl: string) {
  let jwks = jwksCache.get(supabaseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`));
    jwksCache.set(supabaseUrl, jwks);
  }
  return jwks;
}

/**
 * Verifies a bearer access token against the project's JWKS — the one place
 * a backend resource server (Express, NestJS, a Next.js Route Handler, or
 * anything else that receives a `Bearer <token>` header) needs to deal with
 * JWT verification, and it's hidden behind this single call.
 *
 * Framework-agnostic on purpose: it only needs a standard Fetch API
 * `Request`, which frameworks that don't already use one (Express, Nest's
 * default HTTP adapter) can build from their own request object with a
 * couple of lines — see examples/express and examples/nestjs.
 */
export async function verifyRequest(request: Request, config: VerifyRequestConfig): Promise<VerifiedRequest> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) throw new Response("Unauthorized", { status: 401 });

  let result: JWTVerifyResult;
  try {
    result = await jwtVerify(token, getJwks(config.supabaseUrl));
  } catch {
    throw new Response("Unauthorized", { status: 401 });
  }

  const claims = result.payload as unknown as KontroliaTokenClaims;
  const checker = createPermissionChecker({
    roles: claims.roles ?? [],
    permissions: claims.permissions ?? [],
  });

  return { claims, checker, user: getUserFromClaims(claims) };
}

/** Convenience wrapper for a route/handler that must require a permission. */
export async function requirePermission(
  request: Request,
  config: VerifyRequestConfig,
  permission: string | string[],
): Promise<VerifiedRequest> {
  const verified = await verifyRequest(request, config);
  if (!verified.checker.hasPermission(permission)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return verified;
}
