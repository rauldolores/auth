export const OAUTH_CODE_VERIFIER_KEY = "kontrolia_oauth_code_verifier";
/** Separate key from OAUTH_CODE_VERIFIER_KEY above — this is a second, unrelated OAuth flow (connecting to Supabase's own Management API from /social-login), not admin-panel's own SSO login. */
export const SUPABASE_OAUTH_CODE_VERIFIER_KEY = "kontrolia_supabase_oauth_code_verifier";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * PKCE code_verifier/code_challenge (S256) pair for the Supabase OAuth App
 * connection flow — a local copy of @kontrolia/auth's internal
 * generatePkcePair() (packages/auth-sdk/src/pkce.ts), which isn't exported
 * from that package's public API and is hardcoded to GoTrue's own
 * authorize/token endpoints anyway, not reusable for this second,
 * independent flow to api.supabase.com.
 */
export async function generateSupabaseOauthPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}
