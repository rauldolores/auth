import { createAuthMiddleware } from "@kontrolia/next";

export const middleware = createAuthMiddleware({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  rules: [
    { pathPrefix: "/login", mode: "guest", redirectTo: "/" },
    { pathPrefix: "/register", mode: "guest", redirectTo: "/" },
  ],
  mfaChallengePath: "/mfa-challenge",
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
