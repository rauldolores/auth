# docker/ — instalación self-hosted nueva

Levanta Postgres + GoTrue + PostgREST + Kong (mínimo funcional, no el stack completo de 13 servicios de Supabase) más `auth-server` y `admin-panel` ya compilados desde el monorepo.

```bash
cp docker/.env.example docker/.env
# generar JWT_SECRET / ANON_KEY / SERVICE_ROLE_KEY reales antes de continuar
docker compose -f docker/docker-compose.yml up -d
pnpm --filter @kontrolia/db migrate   # DATABASE_URL=postgres://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres
```

Si ya tienes un proyecto Supabase (Cloud o self-hosted), **no uses este docker-compose** — corre solo `pnpm --filter @kontrolia/db migrate` apuntando a tu `DATABASE_URL` existente y despliega `auth-server`/`admin-panel` donde prefieras (Vercel, Coolify, Railway...).

## Qué NO incluye

Realtime, Storage, Studio, Edge Functions Runtime, Analytics/Logflare, Vector, Supabase Meta — ninguno es requerido por KontrolIA Auth. Si tu proyecto los necesita para otra cosa, añade un `docker-compose.override.yml` con el [compose oficial de Supabase](https://supabase.com/docs/guides/self-hosting/docker).
