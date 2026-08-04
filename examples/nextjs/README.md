# Ejemplo: Next.js

Integración de referencia — criterio de aceptación de v1 del roadmap.

```bash
cp .env.example .env.local   # apunta al Supabase de tu instalación KontrolIA
pnpm install
pnpm --filter @kontrolia/example-nextjs dev
```

Todo el código de esta app se reduce a:

1. `middleware.ts` — `createAuthMiddleware()` protege `/facturas`.
2. `app/providers.tsx` — `<AuthProvider>` con la URL/clave pública de Supabase.
3. `app/facturas/page.tsx` — `<RequirePermission permission="facturacion.facturas.crear">`.

Ningún archivo importa `@supabase/supabase-js`, maneja un redirect de OAuth, ni decodifica un JWT.
