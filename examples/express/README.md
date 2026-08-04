# Ejemplo: Express (resource server)

Un backend Express que protege una ruta por permiso, usando `requirePermission()` de `@kontrolia/auth/server` — la misma función que usaría un Route Handler de Next.js, sin depender de Next.js para nada.

```bash
cp .env.example .env
pnpm install
pnpm --filter @kontrolia/example-express dev
```

## Probar

Consigue un access token real iniciando sesión contra tu Supabase local (por ejemplo desde `examples/nextjs` o `examples/react`, copiando el token de `getToken()`), luego:

```bash
curl http://localhost:5001/api/facturas -H "Authorization: Bearer <token>"
```

Sin el header, o con un token de un usuario sin el permiso `facturacion.facturas.crear`, responde 401/403. El único código específico de Express en este ejemplo es [`src/to-fetch-request.ts`](src/to-fetch-request.ts) — adapta `req` de Express a un `Request` estándar, que es lo único que el SDK necesita.
