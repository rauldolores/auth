/**
 * Validates a `redirect_to` query value against the small set of origins
 * this installation trusts to receive a post-login redirect. Never follow
 * an arbitrary URL a query string handed us — that's a classic open-redirect
 * phishing vector (a crafted "/login?redirect_to=https://evil.example"
 * link that looks like it points at your own auth pages).
 *
 * `extraTrustedOrigins` exists for one specific reason: GoTrue builds the
 * `/oauth/consent?...` redirect from its own `site_url` config, which is a
 * separate setting from NEXT_PUBLIC_AUTH_SERVER_URL and can legitimately use
 * a different hostname alias for the same server (e.g. GoTrue's site_url is
 * "http://127.0.0.1:3000" while this app's own env var says
 * "http://localhost:3000" — same server, same port, different hostname
 * string). Without this, that mismatch makes a same-server redirect look
 * untrusted and silently fall back to "/". Callers should always pass the
 * page's own `window.location.origin` here — redirecting back to the exact
 * origin the browser is already on is never an open-redirect risk,
 * regardless of what the env var happens to say.
 */
export function resolveRedirectTarget(redirectTo: string | null, extraTrustedOrigins: string[] = []): string {
  const fallback = "/";
  if (!redirectTo) return fallback;

  let target: URL;
  try {
    target = new URL(redirectTo);
  } catch {
    return fallback;
  }

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_AUTH_SERVER_URL,
    process.env.NEXT_PUBLIC_ADMIN_PANEL_URL,
    ...extraTrustedOrigins,
  ]
    .filter((url): url is string => Boolean(url))
    .map((url) => {
      try {
        return new URL(url).origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => origin !== null);

  return allowedOrigins.includes(target.origin) ? target.toString() : fallback;
}
