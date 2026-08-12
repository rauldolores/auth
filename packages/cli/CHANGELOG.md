# create-kontrolia-auth

## 2.4.5

### Patch Changes

- Updated dependencies [909d3b5]
  - @kontrolia/db@2.1.3

## 2.4.4

### Patch Changes

- Updated dependencies [ee5d1cc]
  - @kontrolia/db@2.1.2

## 2.4.3

### Patch Changes

- 7080d4e: `migrate` and `update` now ask for confirmation before applying migrations to a connection string that doesn't look like a local database, so a pasted-in-error production connection string doesn't get migrated silently.
- 8a05162: The install/deploy wizard now opens the auth-server and admin-panel URLs in the browser once setup finishes, instead of only printing them.
- Updated dependencies [51ff10f]
- Updated dependencies [1549077]
- Updated dependencies [585b646]
- Updated dependencies [ee1db05]
- Updated dependencies [4579870]
- Updated dependencies [717bf03]
- Updated dependencies [b45ab5d]
- Updated dependencies [f44d3eb]
- Updated dependencies [d1bf2cb]
- Updated dependencies [2326859]
- Updated dependencies [ee1db05]
- Updated dependencies [0e615d9]
  - @kontrolia/db@2.1.1

## 2.4.2

### Patch Changes

- be58f93: Corrige el valor de `oauth_server_authorization_path` que la automatización de Supabase Cloud enviaba al activar el servidor OAuth 2.1: era `/oauth/authorize` (la propia API interna de GoTrue, fija y no configurable) cuando debía ser `/oauth/consent` — la ruta en auth-server donde GoTrue redirige al usuario para mostrar la pantalla de consentimiento. `docker/docker-compose.yml` (self-hosted) siempre tuvo el valor correcto; el error estaba solo en la llamada a la Management API. Con el valor incorrecto, activar el servidor OAuth no daba ningún error, pero cada intento de autorización real fallaba silenciosamente al redirigir a una ruta que nada atiende.

## 2.4.1

### Patch Changes

- bc01e03: El instalador ahora valida que las URLs de auth-server y admin-panel usen `https://` para un dominio real (`http://` solo se acepta para `localhost`/`127.0.0.1`). Sin esto, un `http://` accidental en un dominio real se colaba silenciosamente en `NEXT_PUBLIC_ADMIN_PANEL_URL`, y como esa variable arma el header CORS `Access-Control-Allow-Origin` de auth-server, el navegador bloqueaba toda llamada de admin-panel hacia auth-server con un "Failed to fetch" genérico — sin ninguna pista de que el problema era un solo carácter (http vs https).

## 2.4.0

### Minor Changes

- 18ad91b: La automatización de configuración de Supabase Cloud (schema expuesto + Custom Access Token Hook) ahora también activa el servidor OAuth 2.1 de GoTrue en el mismo paso — la función que hace posible que otras aplicaciones, en dominios distintos, inicien sesión contra tu auth-server. Antes solo se podía activar a mano desde el Dashboard (si el proyecto ya tenía el toggle disponible, por ser una función en beta); ahora usa el mismo Personal Access Token y la misma llamada a la Management API que ya se pedía para el hook.
- 6abc401: Nuevo comando `npx create-kontrolia-auth grant-admin <email>` — otorga platform admin directo contra la base de datos (misma connection string que `migrate`), sin pasar por login. Es la única vía de recuperación cuando una instalación se queda sin ningún platform admin: por ejemplo, al instalar sobre un proyecto Supabase que ya tenía usuarios de otra aplicación, el trigger que asciende automáticamente "al primer usuario" nunca dispara (cuenta filas de `auth.users`, que es compartida por todo el proyecto Supabase, no solo por KontrolIA Auth) — y la página "Platform admins" del admin-panel no se puede usar para arreglarlo porque requiere ya ser platform admin.

### Patch Changes

- Updated dependencies [6abc401]
- Updated dependencies [b6de82d]
  - @kontrolia/db@2.1.0

## 2.3.0

### Minor Changes

- 9817868: Cuando conectas un proyecto Supabase Cloud existente, el instalador ahora ofrece configurar automáticamente los dos ajustes que antes eran 100% manuales — exponer el schema `kontrolia_auth` en la API de datos y activar el Custom Access Token Hook — vía la Management API de Supabase. Pide un Personal Access Token de tu cuenta (distinto a las keys del proyecto, no se guarda). Si lo saltas, o si el proyecto es self-hosted/dominio propio (sin Management API), sigue mostrando las instrucciones manuales exactas para lo que falte.

### Patch Changes

- b3c49a8: Cuando conectas un proyecto Supabase existente, el instalador ahora también avisa que hay que agregar `kontrolia_auth` a "Exposed schemas" en Dashboard → Project Settings → Data API (además del Custom Access Token Hook que ya avisaba). Sin ese paso, cualquier operación contra el schema (crear una organización, etc.) falla con `Invalid schema: kontrolia_auth` — un error de PostgREST poco descriptivo que antes no quedaba explicado en ningún lado del flujo.

## 2.2.2

### Patch Changes

- 295c176: `npx create-kontrolia-auth deploy` ya no pide de nuevo la URL/anon key/service role key de Supabase en cada corrida — las reutiliza desde `apps/auth-server/.env.local` (escrito en una instalación o despliegue anterior) si están ahí, con opción de capturar otras. Las URLs de auth-server/admin-panel y el dominio de cookie compartido también quedan pre-llenados con lo último guardado, editable en vez de tener que reescribirlo.

## 2.2.1

### Patch Changes

- b0da499: La creación automática de proyectos en Vercel ahora también dispara el primer despliegue de cada proyecto (antes solo conectaba el repo y dejaba el build pendiente de un click manual en el dashboard). También se añadió una nota explicando paso a paso cómo generar el API token en vercel.com/account/tokens, para usuarios sin experiencia técnica.

## 2.2.0

### Minor Changes

- 8220610: Added `npx create-kontrolia-auth deploy` — jumps straight to the deployment step (URLs, OAuth client registration, `.env.local` generation, and the Vercel auto-create offer) without repeating the database or application questions. For anyone who already has everything running and just wants to (re)connect a deploy target — e.g. adding admin-panel to Vercel after auth-server was already deployed, without re-entering Supabase credentials through the full install flow.

## 2.1.0

### Minor Changes

- 00a2c75: The installer can now create both Vercel projects for you via the Vercel REST API instead of walking you through the dashboard or CLI by hand — the exact fields that were easy to get wrong doing this manually (`rootDirectory`, the connected GitHub repo, environment variables) are just set correctly in one request. Offered automatically when you pick Vercel as the deploy target and the repo has a GitHub remote; only needs a Vercel API token (from vercel.com/account/tokens, never persisted). Falls back to the existing manual instructions if declined, if there's no GitHub remote yet, or if project creation fails for either app.

## 2.0.1

### Patch Changes

- 3d3cd9c: Fixed `npx create-kontrolia-auth update` refusing to run when the working tree had untracked files it had never seen edited — a stray `.vercel/` folder left behind by a manual `vercel` deploy attempt was enough to trip it, even with zero actual local edits. The dirty-tree guard now only blocks on modifications to files git already tracks (untracked files can't be silently discarded by `git pull` anyway — it refuses on its own if one would collide with an incoming file). Also added `.vercel` to `.gitignore`, since it's a normal by-product of deploying from this monorepo and was never meant to be tracked.
- 0dbae63: Fixed the installer's Vercel/Railway deployment instructions — they previously told you to `cd apps/auth-server` (or `apps/admin-panel`) before running `vercel`/`railway init`, which uploads only that subfolder in isolation. Without the repo root's `pnpm-lock.yaml` and sibling `@kontrolia/*` packages, the cloud build falls back to `npm install` and fails with `Unsupported URL Type "workspace:"`. The instructions now lead with connecting the repo via each platform's dashboard (Root Directory set to the app folder, always builds from the full repo), with the CLI path as a documented alternative that explicitly warns against running it from inside the app subfolder.

## 2.0.0

### Major Changes

- da0ba79: **Breaking:** renamed the Postgres schema from `kontrolia` to `kontrolia_auth` — clearer, and avoids any collision with a host app's own tables/schemas literally named `kontrolia`. Applying the new migration on an existing install renames the schema in place (`alter schema ... rename to ...`), so existing data and rows are untouched; only the schema's name changes. Every function that referenced other tables by a hardcoded `kontrolia.` prefix internally has been redefined against the new name — this matters because, unlike RLS policies and views (which Postgres binds to stable object IDs at creation time and survive a rename untouched), a function's own body is literal text re-resolved on each call, so it would otherwise start failing with "schema kontrolia does not exist" the next time it ran.

  Two things outside the database also need to change on upgrade, both already covered by `npx create-kontrolia-auth` for new installs — existing installs must update these by hand after migrating, or auth breaks:
  - The Custom Access Token Hook URI: `pg-functions://postgres/kontrolia_auth/custom_access_token_hook`.
  - The exposed PostgREST schema list must include `kontrolia_auth` instead of `kontrolia` (`docker/docker-compose.yml`'s `PGRST_DB_SCHEMAS`, or `[api] schemas` in `config.toml` for the Supabase CLI).

### Minor Changes

- b221185: Added `npx create-kontrolia-auth update` for anyone who already installed via a self-hosted clone and wants to pull the latest code and apply new migrations, instead of doing it by hand. Refuses to touch a working tree with uncommitted local changes, and only fast-forwards from `origin/main` — if history has diverged it stops and points at git rather than guessing. (Consuming `@kontrolia/*` as npm dependencies in your own app is a separate path — update those like any other dependency and re-run your own migration step.)
- 9d000ae: `npx create-kontrolia-auth mi-app` is now a genuinely turnkey installer instead of assuming you're already inside a clone of the repo: it checks requirements (Node, pnpm, git/Docker) with plain-language install hints for anything missing, clones the repo into the target folder and runs `pnpm install` for you, and — for the self-hosted database path — brings up `docker compose` and retries the migration until Postgres finishes booting instead of asking you to confirm it's ready by hand. Also adds `migrate` and `doctor` subcommands, and Render as a deployment target alongside the existing Vercel/Railway/Coolify/Docker/manual instructions.

### Patch Changes

- Updated dependencies [31fc1a7]
- Updated dependencies [b72d710]
- Updated dependencies [9cab90f]
- Updated dependencies [da0ba79]
  - @kontrolia/db@2.0.0

## 1.1.2

### Patch Changes

- Updated dependencies [1c3cd5a]
  - @kontrolia/db@1.2.0

## 1.1.1

### Patch Changes

- Updated dependencies [9e10f4f]
  - @kontrolia/db@1.1.0

## 1.1.0

### Minor Changes

- 564595f: The installer now registers your admin panel as an OAuth 2.1 client automatically (when your Supabase project has GoTrue's OAuth server enabled), writing `NEXT_PUBLIC_OAUTH_CLIENT_ID` for you — this is what lets auth-server and admin-panel stay signed in together across genuinely different domains, not just subdomains. Falls back gracefully (with a note on the manual steps) when the target Supabase project doesn't have that feature enabled.

  Also fixes a real bug for self-hosted Docker installs: `docker/.env`'s `SITE_URL` was only ever written with a fixed `http://localhost:3000` default, before the wizard even asked where auth-server would actually live — answering that question with a different URL left GoTrue silently building redirects (and auth emails) against the wrong host. `SITE_URL` is now kept in sync with your answer.

### Patch Changes

- Updated dependencies [4f661a6]
  - @kontrolia/db@1.0.1
