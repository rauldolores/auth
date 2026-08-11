# Integration Surface

## API

Two narrow, real endpoint families, both in `apps/auth-server/app/api/`:

- **`/api/oauth-clients`** (`route.ts`) — GET/POST/PUT, platform-admin-JWT-gated proxy in front
  of GoTrue's admin OAuth-client API (`{SUPABASE_URL}/auth/v1/admin/oauth/clients`). No DELETE.
  Edit is via `PUT ?clientId=` (query string, not a path segment — no `[id]` route exists).
- **`/api/applications/sync`** (`route.ts`) — POST only, per-application Bearer API-key gated.
  Registers/updates an application's permission catalog. Never deletes existing permissions
  (upsert-only). Machine-to-machine (deploy pipeline), not browser-facing.

No broader public REST resource API exists (no `/api/organizations`, `/api/users`, etc. intended
for third-party consumption — those exist but are internal, consumed only by admin-panel/
auth-server's own UI, out of this skill's "external integration surface" scope). No API
versioning scheme exists or is currently warranted at this surface's size.

## Authentication

- OAuth clients endpoint: session-based, `is_platform_admin` JWT claim verified via
  `@kontrolia/auth/server`'s `verifyRequest()` (real JWKS-backed verification).
- Applications/sync endpoint: per-application Bearer API key (`kapp_...`), SHA-256-hashed at
  rest, compared with `node:crypto.timingSafeEqual` (constant-time).
- Both reuse the platform's real authentication/authorization primitives — no parallel/weaker
  path found for either.

## API Keys

One system: the application-registration/sync key (`kapp_<base64url>`, 192 bits of entropy,
`packages/db/src/api-key.ts`). Generation and storage are genuinely solid (CSPRNG, SHA-256 hash
only, true one-time display with zero retrieval path anywhere in the codebase). Lifecycle
management is the real gap: **no rotation, no revocation, no expiration, no "last used"
tracking, no admin-panel UI** — see `INT-KEY-001` (HIGH). The only way to replace a leaked key is
deleting and re-registering the whole application row.

## Scopes

None exist, and none are currently warranted — the application API key gates exactly one real
capability (permission-catalog sync + basic name/environment update), so a scope system today
would be inventing boundaries with nothing real to bound. Revisit only if the key's capability
surface grows.

## Rate Limits

**None**, on either integration-relevant endpoint. Confirmed by tracing the actual request path:
Kong (`docker/kong.yml`) only proxies `/auth/v1` (GoTrue) and `/rest/v1` (PostgREST) — it never
reaches `apps/auth-server`'s own API routes at all. `apps/auth-server/middleware.ts` explicitly
excludes `/api/*` from its matcher. No rate-limiting library or hand-rolled logic exists anywhere
in the repo. GoTrue's own `GOTRUE_RATE_LIMIT_HEADER` (docker-compose.yml) covers login/signup/OTP/
token-refresh only — a separate, already-tracked concern (`REL-SEC-001`), not these two endpoints.
See `INT-SEC-001` (MEDIUM).

## Webhooks

None exist. Confirmed absent via exhaustive grep across all first-party code and all 31
migrations. Evaluated as a real, plausible product gap (not overengineering) given KontrolIA
Auth's role as a centralized auth/IAM provider other systems would want to react to — see
`INT-WEBHOOK-001` (MEDIUM) in the latest audit for the specific event candidates and scoping
recommendation.

## Events

N/A — no event/webhook system exists to define events for yet.

## Delivery

N/A.

## Retries

N/A.

## MCP

None exist. Evaluated honestly per this skill's own discipline and concluded **not currently
warranted**: no concrete named consumer/use case has been identified, and the domain's
highest-value write operations (create/delete organizations, grant/revoke roles, promote/demote
platform admins) are exactly the high-risk/hard-to-reverse pattern that argues against building
MCP tooling without a real authorization/confirmation story ready first. This is `NOT_APPLICABLE`,
not a gap. If ever pursued, start read-only (list orgs/users/roles) and reuse the exact same
JWT/RLS authorization the REST API and admin-panel UI already enforce — never a parallel path.

## Tools

N/A — no MCP server exists.

## Permissions

N/A — no MCP server exists.

## Documentation

`apps/documentation` (14 real content pages, `app/docs/*`) is genuinely accurate — zero
documentation drift found on spot-check (a dozen specific claims cross-checked against real code,
all confirmed true, all internal links resolve). Its real gap is *completeness* for a
non-JS/external integrator: no HTTP-level reference for the OAuth authorize/token endpoints or
`scope` parameter (`INT-DOC-001`), no systematic error-response reference (`INT-DOC-003`), no
consolidated SDK API-reference page (`INT-DOC-002`), and SDK install instructions buried in a
single incidental spot (`INT-DOC-004`). The 4 example integrations (`examples/*`) independently
verified with **zero API-contract drift** against the real, current SDK exports — a reliable
quickstart reference for the flows they cover, though none demonstrate the product's actual core
cross-domain PKCE flow (`INT-API-004`).

## Testing

Both integration-relevant routes have real, meaningfully-branched vitest coverage
(`apps/auth-server/app/api/__tests__/oauth-clients.test.ts`, 8 cases;
`applications-sync.test.ts`, 7 cases, including invalid-key/never-issued-key paths). No tests
exist for rate limiting or key lifecycle because neither capability exists yet.

## Observability

`POST /api/applications/sync` logs permission-upsert errors (`logError()`) but logs **nothing**
on invalid/missing API-key attempts (401 paths) or on successful syncs — no audit trail exists
for detecting misuse or a leaked key (`INT-KEY-002`, MEDIUM).

## Known Limitations

- No OpenAPI spec for either endpoint family (`INT-OPENAPI-001`, LOW — low urgency given the
  narrow current surface).
- `apps/playground` is an empty single-page stub despite being described in the root README as a
  working sandbox (`INT-DX-001`, LOW).
- All 4 examples pin `@kontrolia/*` via `workspace:*`, so none demonstrate real registry semver
  ranges an external consumer would actually use (`INT-DX-002`, LOW).
- A Developer Portal separate from `apps/documentation` + admin-panel is explicitly **not**
  recommended at this product's current size/audience — evaluated, not a gap.
