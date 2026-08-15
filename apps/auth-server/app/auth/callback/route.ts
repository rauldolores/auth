import { resolveRedirectTarget } from "@/lib/redirect";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * Server-side leg of the OAuth/PKCE redirect (Google, etc.). Because
 * sessions live in cookies (@supabase/ssr), the authorization code Supabase
 * appends to this URL has to be exchanged here — not client-side — so the
 * resulting session cookies get set on the response before the browser
 * lands back on the app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // `redirect_to`, not `redirect` — matches the query param name used
  // everywhere else this app threads a post-login destination through
  // (login/forgot-password/mfa-challenge, resolveRedirectTarget itself).
  // resolveRedirectTarget also closes an open redirect this route had:
  // `new URL(value, url.origin)` returns `value` unmodified whenever it's
  // already an absolute URL, so any `?redirect_to=https://evil.example`
  // was being honored with no allowlist check at all.
  const redirectTarget = resolveRedirectTarget(url.searchParams.get("redirect_to"));

  if (code) {
    const supabase = await createRouteHandlerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(redirectTarget, url.origin));
}
