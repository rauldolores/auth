import { type PermissionChecker, createPermissionChecker } from "@kontrolia/permissions";
import type { KontroliaTokenClaims } from "@kontrolia/shared";
import { type JWTVerifyResult, createRemoteJWKSet, jwtVerify } from "jose";

export interface VerifyRequestConfig {
  /** Base Supabase URL, e.g. https://<project>.supabase.co or your self-hosted Kong URL. */
  supabaseUrl: string;
}

export interface VerifiedRequest {
  claims: KontroliaTokenClaims;
  checker: PermissionChecker;
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
 * a backend resource server (a Next.js Route Handler acting as an API, or
 * the equivalent in the Express/NestJS examples) needs to deal with JWT
 * verification, and it's hidden behind this single call.
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

  return { claims, checker };
}

/** Convenience wrapper for a Route Handler that must require a permission. */
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
