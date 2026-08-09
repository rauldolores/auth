import { type PermissionChecker, createPermissionChecker } from "@kontrolia/permissions";
import type { KontroliaMembershipWithOrganization, KontroliaTokenClaims, KontroliaUser } from "@kontrolia/shared";
import { createClient } from "@supabase/supabase-js";
import { type JWTVerifyResult, createRemoteJWKSet, jwtVerify } from "jose";
import { mapMembershipRows } from "./membership-mapping.js";
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

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
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
  const token = extractBearerToken(request);
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

export interface ListMembershipsConfig extends VerifyRequestConfig {
  /** Supabase anon/public key — safe to use here, RLS is what actually scopes this query. */
  supabaseAnonKey: string;
}

/**
 * Every organization the caller belongs to, with their roles and membership
 * status in each — the server-side equivalent of the client SDK's
 * getMemberships(), for a backend that only has the caller's bearer token
 * (no cookies, no live browser session). No service-role key needed: the
 * token itself authenticates a Row-Level-Security-scoped Postgres REST
 * request — the same mechanism getOrganization()/getMemberships() rely on
 * client-side, just reached with a raw token instead of a live session.
 */
export async function listMemberships(
  request: Request,
  config: ListMembershipsConfig,
): Promise<KontroliaMembershipWithOrganization[]> {
  await verifyRequest(request, config); // throws 401 before spending a query on an invalid token
  const token = extractBearerToken(request)!;

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase
    .schema("kontrolia_auth")
    .from("memberships")
    .select("id, organization_id, status, organization:organizations(id, name, slug, settings), membership_roles(role:roles(slug))");

  if (error) throw error;
  return mapMembershipRows((data ?? []) as never);
}
