# @kontrolia/react

## 1.3.0

### Minor Changes

- 1aa8b7f: Adds `listOrganizationMembers`, `searchOrganizationMembers`, and `getOrganizationMemberCount` to `KontroliaClient` (and `useAuth()`) — the counterpart to the existing `getMemberships()` (which lists the organizations a user belongs to), for listing/searching/counting the users who belong to one organization, with id/email/name resolved server-side. Requires a new optional `authServerUrl` config field on `KontroliaClientConfig`, only needed by these three methods.

### Patch Changes

- Updated dependencies [1aa8b7f]
  - @kontrolia/auth@2.1.0

## 1.2.1

### Patch Changes

- Updated dependencies [da0ba79]
  - @kontrolia/auth@2.0.0

## 1.2.0

### Minor Changes

- 9105753: Adds a way to list every organization the current user belongs to — the data a "switch company" selector needs before it can call `switchOrganization()`, which previously had no discovery method.

  - `client.getMemberships()` (`@kontrolia/auth`, exposed through `useAuth()` in `@kontrolia/react`) — browser-side, backed by the live session, returns each membership's role/status plus its resolved organization.
  - `listMemberships(request, config)` (`@kontrolia/auth/server`) — the same data for a backend that only has the caller's bearer token, no cookies. Authenticates the query with the token itself via Row Level Security; no service-role key needed.
  - New `KontroliaMembershipWithOrganization` type (`@kontrolia/shared`).

- 1c3cd5a: Adds a "platform admin" concept for cross-tenant tooling (support/ops consoles that need to see across every organization, not just the active one) — a single reserved `is_platform_admin` claim outside the app permission-key namespace, instead of each app inventing its own `<app>.admin.ver_todo` escape hatch.

  - New `kontrolia.platform_admins` table (migration `0016_platform_admins.sql`) — one `user_id` per platform admin. No self-service UI yet; grant by inserting directly, same pattern as enabling an application for an organization.
  - `custom_access_token_hook` now sets `is_platform_admin` alongside `roles`/`permissions`, computed the same way (only as fresh as the token).
  - `client.isPlatformAdmin()` client-side, `claims.is_platform_admin` from `verifyRequest()`/`requirePermission()` server-side. What an app does with that boolean — which endpoints it unlocks — is up to the app.

### Patch Changes

- Updated dependencies [9105753]
- Updated dependencies [1c3cd5a]
- Updated dependencies [d247ebb]
  - @kontrolia/auth@1.2.0
  - @kontrolia/shared@1.1.0
  - @kontrolia/permissions@1.0.1

## 1.1.0

### Minor Changes

- 564595f: Add support for keeping auth-server and any other app sharing a KontrolIA Auth session (e.g. admin-panel) signed in together, regardless of how they're deployed:

  - `cookieDomain` client config option (`@kontrolia/auth`, `@kontrolia/next`) for SSO across subdomains of one domain — set once, the session cookie is shared automatically.
  - Native OAuth 2.1 Server support (GoTrue's authorization-code + PKCE flow) for SSO across genuinely different domains, where a shared cookie is impossible by design: `buildOAuthServerAuthorizeUrl()`, `exchangeOAuthServerCode()`, `getOAuthAuthorizationDetails()`, `decideOAuthAuthorization()` in `@kontrolia/auth`, all exposed through `useAuth()` in `@kontrolia/react`.

### Patch Changes

- Updated dependencies [564595f]
  - @kontrolia/auth@1.1.0
