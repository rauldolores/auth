---
"@kontrolia/auth": minor
"@kontrolia/react": minor
---

Adds `listOrganizationMembers`, `searchOrganizationMembers`, and `getOrganizationMemberCount` to `KontroliaClient` (and `useAuth()`) — the counterpart to the existing `getMemberships()` (which lists the organizations a user belongs to), for listing/searching/counting the users who belong to one organization, with id/email/name resolved server-side. Requires a new optional `authServerUrl` config field on `KontroliaClientConfig`, only needed by these three methods.
