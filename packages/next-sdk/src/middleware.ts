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
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
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
