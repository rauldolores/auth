# KontrolIA Auth

Plataforma Open Source de Identity & Access Management (IAM) para aplicaciones React, Next.js y cualquier stack moderno. Autenticación, organizaciones multi-tenant y RBAC jerárquico, instalable sobre un proyecto Supabase existente o uno nuevo, y desplegable en cualquier servidor.

> Estado: v1 en desarrollo. Ver [`docs/architecture`](apps/documentation) y el roadmap en el plan de arquitectura del proyecto.

## Estructura del monorepo

```
apps/
  auth-server/     # UI de login/registro/recuperación + API de orquestación (Next.js)
  admin-panel/     # Dashboard de administración (Next.js)
  documentation/   # Sitio de documentación
  playground/      # Sandbox para probar el SDK en vivo
packages/
  auth-sdk/        # @kontrolia/auth — core sin framework
  react-sdk/       # @kontrolia/react — AuthProvider, guards, useAuth()
  next-sdk/        # @kontrolia/next — middleware y helpers de Next.js
  permissions/      # Motor de evaluación RBAC (hasPermission/hasRole)
  ui/                # Componentes compartidos (shadcn/ui)
  db/                 # Migraciones SQL, RLS, Custom Access Token Hook
  shared/              # Tipos y utilidades comunes
  config/               # Presets de eslint/tsconfig/tailwind
examples/
  nextjs/ react/ express/ nestjs/
docker/            # docker-compose mínimo (Postgres + GoTrue) para instalación self-hosted
scripts/
```

## Instalación

Dos preguntas independientes:

1. **¿De dónde sale tu Supabase (Postgres + Auth)?**
   - Ya tengo un proyecto (Cloud o self-hosted) → `pnpm --filter @kontrolia/db migrate` apuntando a tu `DATABASE_URL`.
   - No tengo uno → `docker compose -f docker/docker-compose.yml up -d` levanta Postgres + GoTrue mínimo localmente.
2. **¿Dónde despliego `auth-server` / `admin-panel`?** Docker, Vercel, Coolify, Railway o Kubernetes — son apps Next.js estándar, solo necesitan las variables de `.env.example`.

Guía completa de instalación (wizard `create-kontrolia-auth`) en progreso — ver [`packages/cli`](packages/cli) cuando esté disponible.

## Desarrollo

```bash
pnpm install
pnpm dev
```

## Licencia

MIT
