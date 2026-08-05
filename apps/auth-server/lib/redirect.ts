/**
 * Validates a `redirect_to` query value against the small set of origins
 * this installation trusts to receive a post-login redirect. Never follow
 * an arbitrary URL a query string handed us — that's a classic open-redirect
 * phishing vector (a crafted "/login?redirect_to=https://evil.example"
 * link that looks like it points at your own auth pages).
 */
export function resolveRedirectTarget(redirectTo: string | null): string {
  const fallback = "/";
  if (!redirectTo) return fallback;

  let target: URL;
  try {
    target = new URL(redirectTo);
  } catch {
    return fallback;
  }

  const allowedOrigins = [process.env.NEXT_PUBLIC_AUTH_SERVER_URL, process.env.NEXT_PUBLIC_ADMIN_PANEL_URL]
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
