# @kontrolia/db

## 1.1.0

### Minor Changes

- 9e10f4f: Applications can now keep their own permission catalog in sync after the initial registration, without an operator touching the database by hand: `registerApplication()` generates a per-application sync API key (only its hash is stored — the plaintext is returned once, on first registration, and never again), which the application then uses to call auth-server's new `POST /api/applications/sync` from its own deploy pipeline. See the "Registro de aplicaciones" guide in the documentation for the full contract.

  Adds `generateApplicationApiKey()` / `hashApplicationApiKey()` and a new `api_key_hash` column on `kontrolia.applications` (migration `0015_application_api_key.sql`).

## 1.0.1

### Patch Changes

- 4f661a6: Fix `delete from auth.users` failing with a foreign key violation on `audit_logs_actor_user_id_fkey` for any user that has device/session rows. The `log_device_revoked` audit trigger no longer falls back to the just-deleted user as the log's actor when the deletion cascades from `auth.users`.
