# @kontrolia/auth

SDK oficial y framework-agnóstico de [KontrolIA Auth](https://github.com/rauldolores/auth). Es la única forma soportada de integrar una aplicación — nunca importes `supabase-js`, manejes redirects de OAuth o decodifiques un JWT directamente; todo eso vive detrás de este cliente.

## Instalación

```bash
npm install @kontrolia/auth
```

## Uso

```ts
import { createKontroliaClient } from "@kontrolia/auth";

const client = createKontroliaClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
});

await client.login({ email, password });
await client.switchOrganization(organizationId);
const permissions = await client.getPermissions();
```

Incluye login por contraseña, OAuth (Google/Azure/...), organizaciones multi-tenant, MFA/TOTP y más.

## `@kontrolia/auth/server`

Verificación de tokens del lado del servidor para resource servers en cualquier framework (Express, NestJS, etc.):

```ts
import { verifyRequest, requirePermission } from "@kontrolia/auth/server";
```

Si usas Next.js, prefiere [`@kontrolia/next`](https://www.npmjs.com/package/@kontrolia/next), que reexporta esto mismo junto con el middleware de rutas.

## Documentación

Ver la [guía completa](https://github.com/rauldolores/auth) del monorepo.
