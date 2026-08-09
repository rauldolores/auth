---
"@kontrolia/db": major
"@kontrolia/auth": major
"create-kontrolia-auth": major
---

**Breaking:** renamed the Postgres schema from `kontrolia` to `kontrolia_auth` — clearer, and avoids any collision with a host app's own tables/schemas literally named `kontrolia`. Applying the new migration on an existing install renames the schema in place (`alter schema ... rename to ...`), so existing data and rows are untouched; only the schema's name changes. Every function that referenced other tables by a hardcoded `kontrolia.` prefix internally has been redefined against the new name — this matters because, unlike RLS policies and views (which Postgres binds to stable object IDs at creation time and survive a rename untouched), a function's own body is literal text re-resolved on each call, so it would otherwise start failing with "schema kontrolia does not exist" the next time it ran.

Two things outside the database also need to change on upgrade, both already covered by `npx create-kontrolia-auth` for new installs — existing installs must update these by hand after migrating, or auth breaks:
- The Custom Access Token Hook URI: `pg-functions://postgres/kontrolia_auth/custom_access_token_hook`.
- The exposed PostgREST schema list must include `kontrolia_auth` instead of `kontrolia` (`docker/docker-compose.yml`'s `PGRST_DB_SCHEMAS`, or `[api] schemas` in `config.toml` for the Supabase CLI).
