# create-kontrolia-auth

Instalador "todo en uno" de KontrolIA Auth. Pensado para que alguien **sin
conocimiento técnico** deje el sistema funcionando con un solo comando.

## Instalar (desde cero, sin clonar nada a mano)

```bash
npx create-kontrolia-auth mi-app
```

Eso hace, en orden:

1. **Revisa requisitos** (Node 20+, pnpm, y git/Docker según lo que elijas) y te
   dice exactamente qué instalar si falta algo.
2. **Descarga** el repositorio en `./mi-app` e instala dependencias.
3. **Base de datos** — dos caminos independientes:
   - _Ya tengo Supabase_ (Cloud o self-hosted): pegas URL + keys, sin Docker.
   - _Crear uno nuevo self-hosted_: genera `docker/.env`, **levanta los
     contenedores por ti** (`docker compose up -d`) y aplica las migraciones
     en cuanto Postgres está listo.
4. **Primera aplicación** (opcional): registra tu app y su catálogo de permisos.
5. **Despliegue**: genera los `.env.local` de `auth-server` y `admin-panel`. Si
   eliges Vercel y el repo ya está en GitHub, puede **crear los dos proyectos
   por ti** vía la API de Vercel (carpeta y variables de entorno correctas de
   una vez, sin tocar el dashboard ni la CLI de Vercel) — solo pide un API
   token de vercel.com/account/tokens. Para Docker, Railway, Render o
   Coolify te da los pasos exactos.

Si ya estás **dentro del repo** (desarrollo), el instalador lo detecta y se
salta la descarga:

```bash
pnpm --filter create-kontrolia-auth dev
```

## Subcomandos

| Comando                               | Qué hace                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `npx create-kontrolia-auth [carpeta]` | Instalación completa (el flujo de arriba).                                   |
| `npx create-kontrolia-auth update`    | Descarga el código nuevo (`git pull`) sobre una copia ya instalada, instala dependencias, y aplica las migraciones nuevas. |
| `npx create-kontrolia-auth migrate`   | Aplica/re-aplica las migraciones contra una base existente.                  |
| `npx create-kontrolia-auth doctor`    | Solo revisa que tengas Node, pnpm, git y Docker.                             |

Las migraciones son **idempotentes** (solo tocan el schema `kontrolia_auth`), así
que `migrate` es seguro de correr las veces que necesites.

`update` es para quien instaló con `npx create-kontrolia-auth mi-app` y ya
tiene esa carpeta corriendo — no descarta cambios locales (se detiene si hay
algo sin guardar) y solo avanza si puede hacer fast-forward sobre `origin/main`.
Si usas los paquetes `@kontrolia/*` como dependencias npm en tu propia
aplicación (en vez de tener este repo clonado), actualízalos como a cualquier
otra dependencia (`pnpm update @kontrolia/db` etc.) y vuelve a correr tu
propio paso de migración — `update` no aplica a ese caso.
