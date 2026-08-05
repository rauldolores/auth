import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export interface RouteRule {
  /** Matches the start of request.nextUrl.pathname. */
  pathPrefix: string;
  /** "protected" (default) requires a session; "guest" requires no session. */
  mode?: "protected" | "guest";
  /** Where to send the user when the rule is not satisfied. */
  redirectTo: string;
}

export interface AuthMiddlewareConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  rules: RouteRule[];
  /**
   * If set, any authenticated request whose session still needs MFA
   * elevation (a verified TOTP factor exists but the code challenge hasn't
   * completed yet — aal1 -> aal2 pending) gets redirected here instead of
   * reaching the requested page. Without this, login() alone is enough to
   * reach protected routes even on an account with MFA enabled — the
   * factor exists, but nothing has actually checked it.
   */
  mfaChallengePath?: string;
  /**
   * Only needed when this app and another app sharing the same session
   * (e.g. admin-panel) are deployed on different subdomains of the same
   * domain — set to ".example.com" so the refreshed session cookie is
   * readable by both. Leave unset when they share a host.
   */
  cookieDomain?: string;
}

/**
 * Reusable Next.js middleware: refreshes the Supabase session on every
 * request (keeping the custom-claims JWT from going stale) and enforces
 * protected/guest route rules — the app only declares path prefixes, it
 * never touches a session or a cookie directly.
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  return async function middleware(request: NextRequest) {
    const response = NextResponse.next({ request });

    const supabase = createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
      cookieOptions: config.cookieDomain ? { domain: config.cookieDomain } : undefined,
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    if (user && config.mfaChallengePath && pathname !== config.mfaChallengePath) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        return NextResponse.redirect(new URL(config.mfaChallengePath, request.url));
      }
    }

    const rule = config.rules.find((r) => pathname.startsWith(r.pathPrefix));

    if (rule) {
      const mode = rule.mode ?? "protected";
      const satisfied = mode === "protected" ? user !== null : user === null;
      if (!satisfied) {
        const redirectUrl = new URL(rule.redirectTo, request.url);
        return NextResponse.redirect(redirectUrl);
      }
    }

    return response;
  };
}
