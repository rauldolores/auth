# @kontrolia/db

Migraciones SQL del schema `kontrolia_auth` (organizaciones, RBAC jerárquico, invitaciones, dispositivos, audit log) y el Custom Access Token Hook que enriquece el JWT con `organization_id`, `roles` y `permissions` de la organización activa del usuario.

Diseñado para aplicarse igual sobre:
- un proyecto Supabase **existente** (Cloud o self-hosted) — solo aísla sus tablas en el schema `kontrolia_auth`, no toca `public`;
- un proyecto Supabase **nuevo** levantado localmente por `docker/docker-compose.yml`.

## Uso

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres" pnpm --filter @kontrolia/db migrate
```

## Activar el hook

- **Self-hosted**: variable de entorno de GoTrue `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/kontrolia_auth/custom_access_token_hook` (ver `docker/docker-compose.yml`).
- **Supabase Cloud**: `npx create-kontrolia-auth` (o `deploy`) lo automatiza vía la Management API de Supabase, pidiendo un Personal Access Token de la cuenta. A mano: Dashboard → Authentication → Hooks → Custom Access Token → seleccionar `kontrolia_auth.custom_access_token_hook`.
