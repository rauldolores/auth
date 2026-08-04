import type { KontroliaTokenClaims } from "@kontrolia/shared";

/**
 * Decodes (does NOT verify — GoTrue already signed and the app receives this
 * over an authenticated Supabase session) the payload of a JWT access token
 * issued by kontrolia.custom_access_token_hook.
 */
export function decodeAccessToken(accessToken: string): KontroliaTokenClaims | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as KontroliaTokenClaims;
  } catch {
    return null;
  }
}
