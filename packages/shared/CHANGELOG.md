# @kontrolia/shared

## 1.1.0

### Minor Changes

- 9105753: Adds a way to list every organization the current user belongs to — the data a "switch company" selector needs before it can call `switchOrganization()`, which previously had no discovery method.

  - `client.getMemberships()` (`@kontrolia/auth`, exposed through `useAuth()` in `@kontrolia/react`) — browser-side, backed by the live session, returns each membership's role/status plus its resolved organization.
  - `listMemberships(request, config)` (`@kontrolia/auth/server`) — the same data for a backend that only has the caller's bearer token, no cookies. Authenticates the query with the token itself via Row Level Security; no service-role key needed.
  - New `KontroliaMembershipWithOrganization` type (`@kontrolia/shared`).

- 1c3cd5a: Adds a "platform admin" concept for cross-tenant tooling (support/ops consoles that need to see across every organization, not just the active one) — a single reserved `is_platform_admin` claim outside the app permission-key namespace, instead of each app inventing its own `<app>.admin.ver_todo` escape hatch.

  - New `kontrolia.platform_admins` table (migration `0016_platform_admins.sql`) — one `user_id` per platform admin. No self-service UI yet; grant by inserting directly, same pattern as enabling an application for an organization.
  - `custom_access_token_hook` now sets `is_platform_admin` alongside `roles`/`permissions`, computed the same way (only as fresh as the token).
  - `client.isPlatformAdmin()` client-side, `claims.is_platform_admin` from `verifyRequest()`/`requirePermission()` server-side. What an app does with that boolean — which endpoints it unlocks — is up to the app.

- d247ebb: `verifyRequest()`/`requirePermission()` (`@kontrolia/auth/server`) now return a `user` field alongside `claims`/`checker` — the same `KontroliaUser` shape `useAuth().user` gives client-side (`email`, `fullName`, `avatarUrl`, `locale`, `timezone`), read straight out of the already-verified token with no extra query. Useful for a server-side `/api/auth/me`-style endpoint that needs to hydrate a user profile without a round trip to the database. `lastSeenAt` is always `null` here — it's the one field GoTrue doesn't put in the access token.

  `KontroliaTokenClaims` (`@kontrolia/shared`) is now properly typed with the `email`/`user_metadata` claims every Supabase-issued token already carries — previously only accessible via the type's index signature.

  Also exports `getUserFromClaims()` for mapping claims to a `KontroliaUser` outside of `verifyRequest()`.
