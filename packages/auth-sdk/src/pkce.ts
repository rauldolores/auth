function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generates a PKCE code_verifier/code_challenge (S256) pair for the OAuth
 * 2.1 authorization code flow — used when one first-party app (e.g.
 * admin-panel) needs its own session established via a short-lived
 * authorization code instead of a cookie shared with auth-server, which is
 * the only option once the two apps live on genuinely different domains.
 */
export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}
