# @kontrolia/db

Migraciones SQL del schema `kontrolia` (organizaciones, RBAC jerárquico, invitaciones, dispositivos, audit log) y el Custom Access Token Hook que enriquece el JWT con `organization_id`, `roles` y `permissions` de la organización activa del usuario.

Diseñado para aplicarse igual sobre:
- un proyecto Supabase **existente** (Cloud o self-hosted) — solo aísla sus tablas en el schema `kontrolia`, no toca `public`;
- un proyecto Supabase **nuevo** levantado localmente por `docker/docker-compose.yml`.

## Uso

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres" pnpm --filter @kontrolia/db migrate
```

## Activar el hook

- **Self-hosted**: variable de entorno de GoTrue `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/kontrolia/custom_access_token_hook` (ver `docker/docker-compose.yml`).
- **Supabase Cloud**: paso manual en el Dashboard → Authentication → Hooks → Custom Access Token → seleccionar `kontrolia.custom_access_token_hook`. No automatizable por API pública.
