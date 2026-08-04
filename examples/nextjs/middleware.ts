import { createAuthMiddleware } from "@kontrolia/next";

export const middleware = createAuthMiddleware({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  rules: [{ pathPrefix: "/facturas", mode: "protected", redirectTo: "/" }],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
