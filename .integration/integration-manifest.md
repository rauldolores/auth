# Integration Surface

## API

Three real endpoint families, all in `apps/auth-server/app/api/`:

- **`/api/oauth-clients`** (`route.ts`) — GET/POST/PUT, platform-admin-JWT-gated proxy in front
  of GoTrue's admin OAuth-client API (`{SUPABASE_URL}/auth/v1/admin/oauth/clients`). No DELETE.
  Edit is via `PUT ?clientId=` (query string, not a path segment — no `[id]` route exists).
- **`/api/applications/sync`** (`route.ts`) — POST only, per-application Bearer API-key gated.
  Registers/updates an application's permission catalog. Never deletes existing permissions
  (upsert-only). Machine-to-machine (deploy pipeline), not browser-facing.
- **`/api/applications/members`** (`route.ts` + `[membershipId]/route.ts`, GENERATE, 2026-08-11) —
  GET (list), POST (invite), DELETE (remove), PATCH (grant/revoke roles). Same `kapp_` Bearer key
  as `/sync`, identified via an `X-Application-Slug` header (GET/DELETE/PATCH have no body to carry
  a slug in). Lets an application's own backend manage the members of *its own* organization
  (`applications.owner_organization_id`) — never one supplied by the caller, since the admin
  client bypasses RLS and this route's explicit `.eq("organization_id", ...)` filter is the actual
  tenant boundary. Built to complement `/sync`, not replace anything — no pre-existing general
  member-management API existed for external callers before this.

No API versioning scheme exists or is currently warranted at this surface's size.

## Authentication

- OAuth clients endpoint: session-based, `is_platform_admin` JWT claim verified via
  `@kontrolia/auth/server`'s `verifyRequest()` (real JWKS-backed verification).
- Applications/sync and applications/members endpoints: per-application Bearer API key
  (`kapp_...`), SHA-256-hashed at rest, compared with `node:crypto.timingSafeEqual`
  (constant-time) — shared via `apps/auth-server/lib/application-auth.ts`.
- All three reuse the platform's real authentication/authorization primitives — no parallel/
  weaker path found for any of them. Where the application-authenticated routes run as
  `service_role` (bypassing RLS), tenant isolation and the last-owner/owner-grant invariants that
  RLS/triggers normally provide are instead enforced explicitly in application code — see
  `/api/applications/members` above and `packages/db/migrations/0033_prevent_owner_role_invitation.sql`.

## API Keys

One system: the application-registration/sync key (`kapp_<base64url>`, 192 bits of entropy,
`packages/db/src/api-key.ts`), now also gating `/api/applications/members`. Generation and storage
are genuinely solid (CSPRNG, SHA-256 hash only, true one-time display with zero retrieval path
anywhere in the codebase). Lifecycle management (`INT-KEY-001`) is closed: rotation, revocation,
`api_key_last_used_at` tracking, and an admin-panel UI all shipped 2026-08-11 (migration 0032,
commit 585b646) — live-verified end to end. Failed-auth-attempt logging (`INT-KEY-002`) is also
closed: `logSecurityEvent()` fires on every rejection branch across both key-gated route families.

## Scopes

None exist. The application API key's capability surface grew with `/api/applications/members`
(permission-catalog sync + org member management, one key = full control of both for that one
application's own org) — still a single undifferentiated capability per key, not yet wide enough
to justify a scope system, but this is the point at which it's worth watching: a future third
capability on the same key would be the trigger to revisit.

## Rate Limits

Present on all three real endpoint families as of 2026-08-11: a dependency-free in-memory
sliding-window limiter (`apps/auth-server/lib/rate-limit.ts`, `checkRateLimit()`), 30 requests per
5-minute window per IP, 429 + `Retry-After` on breach. `/api/oauth-clients` and
`/api/applications/sync` closed `INT-SEC-001` in commit 585b646; `/api/applications/members`'s 4
operations (list/invite/remove/roles) were each given their own independently-keyed budget from
inception, on the reasoning that mixing read-heavy `list` traffic with mutation traffic in one
shared budget would throttle them unevenly. Still true as before: Kong never proxies
`apps/auth-server`'s own routes, and `middleware.ts` excludes `/api/*` — this limiter is these
routes' only defense, single-process/best-effort (see the file's own doc comment).

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

All three endpoint families have real, meaningfully-branched vitest coverage:
`oauth-clients.test.ts` (10 cases), `applications-sync.test.ts` (9 cases), and the new
`applications-members.test.ts` (11 cases: auth gate, tenant isolation, owner-role rejection,
invite/list happy paths) + `applications-members-detail.test.ts` (10 cases: cross-org 404,
last-owner-removal surfaced as 400, owner-grant rejection, grant/revoke happy paths). 120 tests
total in `apps/auth-server`, all passing. Rate limiting and key lifecycle both now have real test
coverage (previously untested because neither capability existed).

## Observability

Closed (`INT-KEY-002`): `logSecurityEvent()` fires on every rejection branch (missing key,
no-key-configured, invalid key, rate-limited) across all three key/JWT-gated route families, and
`api_key_last_used_at` is touched on every successful application-key auth. Mutations through
`/api/applications/members` get their audit trail for free from the pre-existing DB triggers
(`membership.created/removed`, `role.assigned/unassigned`, `invitation.created` — migrations 0013/
0020/0023/0024), confirmed firing correctly for service-role-driven writes by live query against
`kontrolia_auth.audit_logs` after exercising the new endpoints. Not attributed to which
*application* made the call in `audit_logs` itself (only console-level `logSecurityEvent`/
`logError` carry that) — a possible future improvement, not pursued here to avoid scope creep on a
GENERATE request.

## Known Limitations

- **No self-service application registration/ownership path exists anywhere** (`INT-API-007`,
  HIGH). The only way to create an application row is the CLI wizard's `registerApplication()`
  (raw Postgres connection string), which runs before any organization necessarily exists and
  never asks which org should own the app — `owner_organization_id` is simply omitted from its
  INSERT.
- **`applications.owner_organization_id` is never written by any code path** (`INT-API-008`,
  HIGH — the other side of `INT-API-007`'s root cause). Not by `registerApplication()`, not by
  any migration, not by any RLS policy's `WITH CHECK`, not by any route — confirmed by exhaustive
  grep. `INT-KEY-001`'s rotate/revoke UI and the new `/api/applications/members` API are both
  correctly built but gated entirely on this column, so **neither is reachable in a genuinely
  fresh self-hosted deployment** without a DBA manually running SQL — which is how the sandbox
  data used to build and verify both was actually set up. A real fix needs a "claim ownership"
  flow (most plausibly platform-admin-gated, matching migration 0010's own comment that the
  application catalog is "platform-level, managed via service_role"), not just a form.
- No OpenAPI spec for any of the 3 endpoint families (`INT-OPENAPI-001`, LOW — low urgency given
  the narrow current surface).
- The new `/api/applications/members` API has no page in `apps/documentation` yet (`INT-DOC-005`,
  LOW — a DOCUMENT-mode follow-up, deliberately not done as part of this GENERATE request).
- `apps/playground` is an empty single-page stub despite being described in the root README as a
  working sandbox (`INT-DX-001`, LOW).
- All 4 examples pin `@kontrolia/*` via `workspace:*`, so none demonstrate real registry semver
  ranges an external consumer would actually use (`INT-DX-002`, LOW).
- A Developer Portal separate from `apps/documentation` + admin-panel is explicitly **not**
  recommended at this product's current size/audience — evaluated, not a gap.
