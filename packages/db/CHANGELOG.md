# @kontrolia/db

## 2.1.4

### Patch Changes

- 68602ae: Adds audit-log triggers for creating/deleting a role and granting/revoking a permission on a role — previously the only mutations in the product with zero audit trail. Matches the existing "the database logs it, not application code" pattern (migrations 0013/0024).

## 2.1.3

### Patch Changes

- 909d3b5: Fixes a bug from migration 0036: the new `oauth_client_id` column was never granted `SELECT` to the `authenticated` role, which migration 0032 restricted to an explicit column list. Any query including `oauth_client_id` (the Applications page's own query does, unconditionally) failed outright with "permission denied for table applications" — not gracefully omitting the column, taking down the whole query and rendering the entire Aplicaciones list empty. Live-reproduced against production before fixing.

## 2.1.2

### Patch Changes

- ee5d1cc: Added migration 0036: a nullable `oauth_client_id` column on `kontrolia_auth.applications`, letting admin-panel manage an application's GoTrue OAuth 2.1 client from inside that application's own row instead of a separate, disconnected "Clientes OAuth" screen. No real foreign key — GoTrue's OAuth clients live entirely outside this schema, reachable only via its admin API. Closes a gap an old day-one migration comment shows was the original intended design but was never implemented.

## 2.1.1

### Patch Changes

- 51ff10f: Fixed a regression from migration 0028: creating a new organization was broken entirely, since granting its first Owner role now required the caller to already be an Owner — a genuine chicken-and-egg problem for a brand-new org with no Owner yet. Migration 0031 allows the grant when the target organization currently has zero active Owners (only ever true for a brand-new org, since 0025-0027 already prevent an existing org's Owner count from ever reaching zero any other way).
- 1549077: Added migration 0030, closing the real root cause behind the day's whole last-owner-protection effort: every authority check (`is_org_owner()`, `is_org_admin()`, the JWT's `roles` claim, and every "how many active Owners remain" counting query added in migrations 0025-0029) trusted `roles.slug = 'owner'` alone. Since `kontrolia_auth.roles` had no trigger and its RLS policies never inspected `slug`, any org Admin could create an ordinary custom role, grant it to themselves, and relabel its slug to `'owner'` — becoming recognized as Owner by every check in the system, and inflating the "active Owners" count enough to let the real Owner be removed. All authority checks and counting queries now additionally require `is_system_role = true` (a flag no RLS-writable path can ever set), and a new trigger blocks any non-system role from ever taking a reserved slug (`owner`/`admin`/`member`) as defense in depth.
- 585b646: Added migration 0032, closing the integration-surface audit's one HIGH finding (INT-KEY-001): the application sync API key had no rotation, no revocation, no "last used" tracking, and no admin-panel UI — a leak was both undetectable and recoverable only by destructively re-registering the whole application. Also found while implementing the fix and closed at the same time: `api_key_hash` was readable by any authenticated user for any application (RLS is row-level only, and the existing "browse the application catalog" policy makes every row visible) — now column-level ACL restricted to `service_role`. Rotation/revocation are now logged to `audit_logs` via a trigger, the same way every other security-relevant event in this schema is.
- ee1db05: Added migration 0034, closing INT-API-007/INT-API-008/PQ-TECH-010: `applications.owner_organization_id` was never written by any code path in the repo, making the admin-panel rotate/revoke API-key UI, migration 0022's owning-org UPDATE policy, and the `/api/applications/members` API all unreachable for any application registered the intended way. The actual fix is a new platform-admin-gated `POST /api/applications/claim` route on auth-server; this migration adds the database side — audit logging for `application.ownership_claimed`/`application.ownership_transferred`, and a guard closing a related gap found while designing it: migration 0022's UPDATE policy let a dual-org admin silently reassign an already-owned application to their other organization (same shape as this session's earlier PQ-SEC-005). Once set, `owner_organization_id` can now only change via `service_role`.
- 4579870: Added migration 0024: audit-log triggers now cover membership status changes (suspend/reactivate) and invitation revocation/resend, which previously left no audit trail.
- 717bf03: Added migration 0029: `membership_roles` had no trigger on UPDATE at all, letting a plain org Admin self-promote to Owner, demote the sole active Owner, or hijack an existing Owner role row via a single UPDATE statement — bypassing every DELETE/INSERT guard added earlier today. Also fixes a regression from the previous migration: granting the Owner role via a legitimate invitation-accept (which runs under a service-role connection with no `auth.uid()`) now works correctly again, using `auth.role()` instead of `current_user` to detect that trust boundary from inside a `SECURITY DEFINER` trigger.
- b45ab5d: Added migration 0026: two new triggers on `memberships` block deleting or suspending an organization's last active Owner directly, closing the two remaining RLS-only doors to the same lockout migration 0025 partially fixed for `membership_roles`.
- f44d3eb: Added migration 0027: the last-Owner protection trigger on `memberships` now also blocks reassigning the sole active Owner's membership to a different organization, closing a narrower bypass of migration 0026's status-only check.
- d1bf2cb: Added migration 0025: a DB-level trigger now blocks deleting the organization's last active Owner's role assignment directly, closing a gap where the API-layer last-owner protection (added in a previous release) could be bypassed by deleting the `membership_roles` row directly.
- 2326859: Added migration 0033: an invitation can no longer carry the Owner role. Found while designing the new external `/api/applications/members` API — invitation-accept grants an invitation's `role_id` through a service-role client, and `prevent_admin_granting_owner_role`'s own service-role bypass (0028, needed for org bootstrap) meant it never checked whether that role was Owner. An org Admin could create an owner-role invitation (nothing inspected `role_id` at creation) and accepting it would silently grant Owner with no `is_org_owner()` check — a reachable bypass of every owner-grant protection built in 0025-0031, through a channel none of them touch. Rather than teach the bootstrap-exempt accept flow to tell a legitimate grant apart from this, the capability is removed at its source: invitations can never reference the Owner role.
- ee1db05: Added migration 0035, fixing a CRITICAL regression found live while testing the new applications/claim route: migration 0030's `create or replace` of `custom_access_token_hook` dropped the `is_platform_admin` JWT claim that 0020's version set — `create or replace` replaces the whole function body, and 0030's new body only re-set `organization_id`/`roles`/`permissions`. Every platform-admin-gated route (`/api/platform-admins`, `/api/oauth-clients`, and the new `/api/applications/claim`) has been unusable for any real logged-in user since 0030 shipped earlier today — confirmed by generating a real session for a genuine `platform_admins` row and finding no `is_platform_admin` claim in the resulting JWT at all. Fails closed (no privilege escalation, just a broken feature), but a real, live, previously-undiscovered regression. Restored the missing lookup and `jsonb_set` call.
- 0e615d9: Added migration 0028, closing two CRITICAL authorization gaps found via live exploit testing: any org Admin could grant themselves the Owner role directly (now requires an existing Owner), and any org Admin could silently reassign an existing membership's `user_id` to hijack another user's org access (now blocked entirely — no legitimate flow ever needs to do this).

## 2.1.0

### Minor Changes

- 6abc401: Nuevo comando `npx create-kontrolia-auth grant-admin <email>` — otorga platform admin directo contra la base de datos (misma connection string que `migrate`), sin pasar por login. Es la única vía de recuperación cuando una instalación se queda sin ningún platform admin: por ejemplo, al instalar sobre un proyecto Supabase que ya tenía usuarios de otra aplicación, el trigger que asciende automáticamente "al primer usuario" nunca dispara (cuenta filas de `auth.users`, que es compartida por todo el proyecto Supabase, no solo por KontrolIA Auth) — y la página "Platform admins" del admin-panel no se puede usar para arreglarlo porque requiere ya ser platform admin.
- b6de82d: Nuevas migraciones para soportar editar/eliminar organizaciones desde auth-server y un "launcher" de aplicaciones por organización:

  - `is_org_owner()` + política de DELETE en `organizations` (solo el Owner puede eliminar — a diferencia de `is_org_admin()`, que incluye Admin, para operaciones normales).
  - Columna `applications.homepage_url` (dónde vive la app para un usuario final, distinto de `redirect_urls` que son URIs de OAuth) + política de UPDATE para admins de la organización dueña de la aplicación.
  - Corrige los triggers de audit log (`log_membership_change`, `log_role_assignment_change`) para que no truenen con una violación de foreign key al eliminar una organización: ambos intentaban insertar un registro nuevo referenciando la organización que se está borrando en ese mismo cascade.

## 2.0.0

### Major Changes

- da0ba79: **Breaking:** renamed the Postgres schema from `kontrolia` to `kontrolia_auth` — clearer, and avoids any collision with a host app's own tables/schemas literally named `kontrolia`. Applying the new migration on an existing install renames the schema in place (`alter schema ... rename to ...`), so existing data and rows are untouched; only the schema's name changes. Every function that referenced other tables by a hardcoded `kontrolia.` prefix internally has been redefined against the new name — this matters because, unlike RLS policies and views (which Postgres binds to stable object IDs at creation time and survive a rename untouched), a function's own body is literal text re-resolved on each call, so it would otherwise start failing with "schema kontrolia does not exist" the next time it ran.

  Two things outside the database also need to change on upgrade, both already covered by `npx create-kontrolia-auth` for new installs — existing installs must update these by hand after migrating, or auth breaks:
  - The Custom Access Token Hook URI: `pg-functions://postgres/kontrolia_auth/custom_access_token_hook`.
  - The exposed PostgREST schema list must include `kontrolia_auth` instead of `kontrolia` (`docker/docker-compose.yml`'s `PGRST_DB_SCHEMAS`, or `[api] schemas` in `config.toml` for the Supabase CLI).

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
