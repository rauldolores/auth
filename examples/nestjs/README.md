# Ejemplo: NestJS (resource server)

Un `KontroliaAuthGuard` de Nest sobre `@kontrolia/auth/server` — misma verificación de token que el ejemplo de Express, en el patrón idiomático de Nest (`@UseGuards` + un decorator `@RequirePermission`).

```bash
cp .env.example .env
pnpm install
pnpm --filter @kontrolia/example-nestjs dev
```

## Probar

```bash
curl http://localhost:5002/api/facturas -H "Authorization: Bearer <token>"
```

- [`src/kontrolia-auth.guard.ts`](src/kontrolia-auth.guard.ts) — el guard, adapta el `Request` de Express (que Nest usa por debajo) a un `Request` estándar y llama a `verifyRequest()`/`requirePermission()`.
- [`src/require-permission.decorator.ts`](src/require-permission.decorator.ts) — decorator que declara qué permiso requiere una ruta.
- [`src/app.controller.ts`](src/app.controller.ts) — la ruta protegida, usando ambos.
