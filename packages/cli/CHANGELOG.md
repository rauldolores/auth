# create-kontrolia-auth

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
