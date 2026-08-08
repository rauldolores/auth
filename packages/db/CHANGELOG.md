# @kontrolia/db

## 1.3.0

### Minor Changes

- 31fc1a7: Custom roles now belong to exactly one application instead of being able to span several — each enabled application can define its own catalog of roles (e.g. "Facturación → Contador"), and a membership can hold at most one role per application (enforced by a new trigger). Enabling an application for an organization now also auto-creates an "Administrador de `<app>`" role holding every permission that application currently declares; it stays in sync automatically whenever the application registers a new permission, so nobody has to remember to re-grant it by hand. The 3 global system roles (Owner/Admin/Member) are unchanged — still organization-wide, shared, and immutable.
- b72d710: The very first user to sign up on a fresh installation is now automatically granted platform-admin status (migration `0017_bootstrap_first_platform_admin.sql`) — closing the bootstrapping gap where granting the very first platform admin required direct database access, something a non-technical operator running `npx create-kontrolia-auth` shouldn't have to do. Guarded so it only ever fires once, on a genuinely fresh install (checks `auth.users` count, not just whether `kontrolia.platform_admins` happens to be empty) — revoking the sole platform admin later never silently hands the role to the next random signup.
- 9cab90f: Organization admins/owners can now enable or disable a registered application for their own organization directly from admin-panel — closing a gap where `kontrolia.application_organizations` had no write policy, so nothing ever populated it and Aplicaciones/Permisos/Roles stayed empty even after registering an application. The application catalog itself is also now browsable by any authenticated user (previously an app only became visible once already enabled for one of your orgs, a chicken-and-egg problem).

## 1.2.0

### Minor Changes

- 1c3cd5a: Adds a "platform admin" concept for cross-tenant tooling (support/ops consoles that need to see across every organization, not just the active one) — a single reserved `is_platform_admin` claim outside the app permission-key namespace, instead of each app inventing its own `<app>.admin.ver_todo` escape hatch.

  - New `kontrolia.platform_admins` table (migration `0016_platform_admins.sql`) — one `user_id` per platform admin. No self-service UI yet; grant by inserting directly, same pattern as enabling an application for an organization.
  - `custom_access_token_hook` now sets `is_platform_admin` alongside `roles`/`permissions`, computed the same way (only as fresh as the token).
  - `client.isPlatformAdmin()` client-side, `claims.is_platform_admin` from `verifyRequest()`/`requirePermission()` server-side. What an app does with that boolean — which endpoints it unlocks — is up to the app.

## 1.1.0

### Minor Changes

- 9e10f4f: Applications can now keep their own permission catalog in sync after the initial registration, without an operator touching the database by hand: `registerApplication()` generates a per-application sync API key (only its hash is stored — the plaintext is returned once, on first registration, and never again), which the application then uses to call auth-server's new `POST /api/applications/sync` from its own deploy pipeline. See the "Registro de aplicaciones" guide in the documentation for the full contract.

  Adds `generateApplicationApiKey()` / `hashApplicationApiKey()` and a new `api_key_hash` column on `kontrolia.applications` (migration `0015_application_api_key.sql`).

## 1.0.1

### Patch Changes

- 4f661a6: Fix `delete from auth.users` failing with a foreign key violation on `audit_logs_actor_user_id_fkey` for any user that has device/session rows. The `log_device_revoked` audit trigger no longer falls back to the just-deleted user as the log's actor when the deletion cascades from `auth.users`.
