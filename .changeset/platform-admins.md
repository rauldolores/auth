---
"@kontrolia/db": minor
"@kontrolia/auth": minor
"@kontrolia/shared": minor
"@kontrolia/react": minor
---

Adds a "platform admin" concept for cross-tenant tooling (support/ops consoles that need to see across every organization, not just the active one) — a single reserved `is_platform_admin` claim outside the app permission-key namespace, instead of each app inventing its own `<app>.admin.ver_todo` escape hatch.

- New `kontrolia.platform_admins` table (migration `0016_platform_admins.sql`) — one `user_id` per platform admin. No self-service UI yet; grant by inserting directly, same pattern as enabling an application for an organization.
- `custom_access_token_hook` now sets `is_platform_admin` alongside `roles`/`permissions`, computed the same way (only as fresh as the token).
- `client.isPlatformAdmin()` client-side, `claims.is_platform_admin` from `verifyRequest()`/`requirePermission()` server-side. What an app does with that boolean — which endpoints it unlocks — is up to the app.
