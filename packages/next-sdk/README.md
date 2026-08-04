# @kontrolia/next

Integración con Next.js para [KontrolIA Auth](https://github.com/rauldolores/auth): middleware reutilizable de protección de rutas (con refresh automático de sesión) y `verifyRequest()`/`requirePermission()` para Route Handlers que actúan como resource server.

## Instalación

```bash
npm install @kontrolia/next @kontrolia/auth
```

## Middleware

```ts
// middleware.ts
import { createAuthMiddleware } from "@kontrolia/next";

export const middleware = createAuthMiddleware({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  rules: [{ pathPrefix: "/login", mode: "guest", redirectTo: "/" }],
  mfaChallengePath: "/mfa-challenge",
});

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"] };
```

## Route Handlers

```ts
import { requirePermission } from "@kontrolia/next";

export async function POST(request: Request) {
  // Throws a 401/403 Response (catch it, or let it propagate — Next.js
  // Route Handlers can throw a Response directly) if the bearer token is
  // missing/invalid or doesn't carry the required permission.
  const { claims } = await requirePermission(request, { supabaseUrl: process.env.SUPABASE_URL! }, "facturacion.facturas.crear");
  // ...
}
```

## Documentación

Ver la [guía completa](https://github.com/rauldolores/auth) del monorepo.
