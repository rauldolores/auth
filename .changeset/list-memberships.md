---
"@kontrolia/auth": minor
"@kontrolia/shared": minor
"@kontrolia/react": minor
---

Adds a way to list every organization the current user belongs to — the data a "switch company" selector needs before it can call `switchOrganization()`, which previously had no discovery method.

- `client.getMemberships()` (`@kontrolia/auth`, exposed through `useAuth()` in `@kontrolia/react`) — browser-side, backed by the live session, returns each membership's role/status plus its resolved organization.
- `listMemberships(request, config)` (`@kontrolia/auth/server`) — the same data for a backend that only has the caller's bearer token, no cookies. Authenticates the query with the token itself via Row Level Security; no service-role key needed.
- New `KontroliaMembershipWithOrganization` type (`@kontrolia/shared`).
