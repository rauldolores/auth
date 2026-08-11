# Integration Surface Audit

Date: 2026-08-11T23:59:00
Mode: AUDIT (pure diagnosis — no code modified)
Scope: Full KontrolIA Auth monorepo (apps/auth-server, apps/admin-panel, apps/documentation,
apps/playground, packages/*, examples/*, docker/*)

## Existing Capabilities

- **OAuth 2.1 + PKCE as the primary integration mechanism** — real, working, and the product's
  actual core value proposition. `packages/auth-sdk/src/pkce.ts` generates a genuine S256
  PKCE pair (32-byte CSPRNG verifier via Web Crypto). `buildOAuthServerAuthorizeUrl()` /
  `exchangeOAuthServerCode()` (`packages/auth-sdk/src/client.ts:256-300`) drive a correct
  authorize → token exchange against GoTrue's own `/auth/v1/oauth/{authorize,token}`
  endpoints, and `getOAuthAuthorizationDetails()` / `decideOAuthAuthorization()` (`client.ts:308-352`)
  support a real third-party consent screen. This is genuinely implemented, not aspirational.
- **OAuth client registration** — `apps/auth-server/app/api/oauth-clients/route.ts` (145 lines)
  supports GET (list), POST (create), and PUT (edit) as a platform-admin-gated proxy in front
  of GoTrue's admin OAuth-client API, with a real `is_platform_admin` JWT-claim check
  (`route.ts:31-41`, `verifyRequest()` does genuine JWKS-backed verification, not a
  client-trusted flag) and a real, meaningfully-branched test suite
  (`apps/auth-server/app/api/__tests__/oauth-clients.test.ts`, 8 cases). An admin-panel UI
  (`apps/admin-panel/app/oauth-clients/page.tsx`) exists for create + inline edit.
- **Application registration / permission-catalog sync API key system** —
  `POST /api/applications/sync` (`apps/auth-server/app/api/applications/sync/route.ts`)
  authenticates via a Bearer key that is genuinely well-built at the cryptographic level:
  `packages/db/src/api-key.ts` generates a 192-bit CSPRNG key (`kapp_<base64url>`, `randomBytes(24)`),
  stores only a SHA-256 hash (`packages/db/migrations/0015_application_api_key.sql` — no plaintext
  column anywhere), and compares it with a real timing-safe comparison
  (`safeEqualHex()` using `node:crypto`'s `timingSafeEqual`, `route.ts:26-31,78`) — not a naive
  `===`. The plaintext key is genuinely shown exactly once at creation
  (`packages/db/src/register-application.ts:71`, `apiKey: application.inserted ? candidateApiKey : null`)
  with zero retrieval path anywhere in the codebase (confirmed by exhaustive grep — no
  "view secret" capability exists in admin-panel or any API route). Tenant isolation is
  correctly scoped: the presented key is hashed and compared only against the row matching the
  caller-supplied `slug`, and every write in the route is scoped to that same row's `id` — a
  valid key for application A cannot be used against application B's data. Has a real,
  meaningfully-branched test suite (`applications-sync.test.ts`, 7 cases, including the
  invalid-key and never-issued-key paths).
- **4 example integrations** (`examples/nextjs`, `examples/react`, `examples/express`,
  `examples/nestjs`) — independently verified against the real, current exported API surface of
  `@kontrolia/auth`, `@kontrolia/react`, and `@kontrolia/next`. **Zero API-contract drift found
  in any of the four** — every call site (`createAuthMiddleware`, `<AuthProvider>`, `useAuth()`,
  `<RequirePermission>`, `verifyRequest()`, `requirePermission()`) matches the real current
  function/prop signatures exactly, and each example's own README accurately describes what it
  demonstrates. This is a genuinely reliable quickstart reference for the flows it covers.
- **`apps/documentation`** — 14 real content pages under `app/docs/*` (no MDX, plain TSX). Spot-checked
  a dozen specific factual claims (endpoint paths, request/response shapes, example file contents)
  against real code and **found zero drift** — every checked claim matches reality, all internal
  links resolve. `guides/application-registration/page.tsx` documents the applications/sync API
  with an accurate error-code table and working curl/Node examples that match `route.ts` exactly.
- **A live SDK version/release discipline** — `packages/auth-sdk` is at a real `2.0.0` with a
  maintained `CHANGELOG.md` documenting an actual breaking change (schema rename) with a migration
  note, using `@changesets/*` tooling — not an ad hoc "just publish it" story.
- **Framework wrappers genuinely reuse the core SDK** — `packages/react-sdk`'s `useAuth()` is a
  thin 1:1 binder over `KontroliaClient` methods (no duplicated logic); `AuthGuard`/`GuestGuard`/
  `RequireRole`/`RequirePermission` are pure conditional renders over context state the core SDK
  populated. `packages/next-sdk`'s middleware correctly uses `@supabase/ssr` directly (a legitimate
  choice given the Edge runtime), and does not duplicate any JWT/claims logic.
- **No webhook or MCP system exists** — confirmed via exhaustive repo-wide grep (all first-party
  code, all 31 migrations, all `package.json` dependency lists) rather than assumed.

## Missing Capabilities

| ID | Capability | Priority |
|----|------------|----------|
| INT-KEY-001 | Application API key (`kapp_...`) has no rotation, no revocation, no expiration, no "last used" tracking, and zero admin-panel UI | HIGH |
| INT-WEBHOOK-001 | No webhook system anywhere (subscriptions/events/delivery/retries/signing/logs) | MEDIUM |
| INT-API-001 | OAuth client management has no DELETE/revoke — a client can be created and edited but never decommissioned | MEDIUM |
| INT-OPENAPI-001 | No OpenAPI/Swagger spec for either integration-relevant endpoint family | LOW |

## Incomplete Capabilities

| ID | Capability | Priority |
|----|------------|----------|
| INT-SEC-001 | Zero rate limiting (any layer) on `/api/oauth-clients` and `/api/applications/sync` | MEDIUM |
| INT-KEY-002 | No logging of failed/successful `/api/applications/sync` auth attempts — no audit trail | MEDIUM |
| INT-API-002 | `PUT /api/oauth-clients` uses a query-string `clientId` rather than a path segment, and only edits `client_name`/`redirect_uris` | LOW |
| INT-API-003 | No validation of `redirect_uris` format/scheme/host, no dedup, on OAuth client create/edit | MEDIUM |
| INT-API-004 | The product's actual core flow — cross-domain PKCE OAuth (`buildOAuthServerAuthorizeUrl`/`exchangeOAuthServerCode`) — is not demonstrated in any of the 4 examples; all 4 use same-origin password auth instead | MEDIUM |
| INT-API-005 | `getUserFromClaims`/`listMemberships` implemented in `auth-sdk/src/server.ts` but not exported from the public `@kontrolia/auth/server` surface | LOW |
| INT-API-006 | Unguarded `fetch()` in 3 OAuth-server client SDK methods (`exchangeOAuthServerCode`, `getOAuthAuthorizationDetails`, `decideOAuthAuthorization`) — same defect already tracked as `PQ-TECH-007` by Professional Review | MEDIUM |
| INT-DOC-001 | OAuth token endpoint, exact authorize-endpoint query params, and the `scope` parameter never documented at the HTTP level | MEDIUM |
| INT-DOC-002 | No consolidated SDK API-reference page — surface only discoverable via scattered example snippets | LOW |
| INT-DOC-003 | No systematic error-response reference beyond applications/sync's own table | MEDIUM |
| INT-DOC-004 | SDK npm-install instructions appear only once, buried in `migration/page.tsx` | LOW |
| INT-DX-001 | `apps/playground` is an empty single-page stub despite the root README describing it as a working "Sandbox para probar el SDK en vivo" | LOW |
| INT-DX-002 | All 4 examples pin `@kontrolia/*` via `workspace:*` — none demonstrate real registry semver ranges an external consumer would actually use | LOW |

## Security Findings

None reach the `CRITICAL` severity floor (no confirmed tenant-isolation break, no confirmed
authentication/authorization bypass). Findings below are real and carry their own severity:

- **INT-SEC-001 (MEDIUM)** — `/api/oauth-clients` and `/api/applications/sync` have zero rate
  limiting from any layer. Confirmed by tracing the actual request path: Kong
  (`docker/kong.yml`) only proxies `/auth/v1` (GoTrue) and `/rest/v1` (PostgREST) — it never
  proxies `apps/auth-server`'s own Next.js routes at all, so Kong's configuration is irrelevant
  to these two endpoints. `apps/auth-server/middleware.ts` explicitly excludes `/api` from its
  matcher (`matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"]`). No rate-limiting
  library or hand-rolled logic exists anywhere in the repo (confirmed by dependency-list and
  code grep). Scored MEDIUM rather than HIGH because actual exploitability is bounded: the
  applications/sync key has 192 bits of entropy (brute force is computationally infeasible),
  and the oauth-clients endpoint already requires a valid platform-admin JWT (a second real
  auth gate) before rate-limiting would even matter. The genuine risk is unbounded request
  volume / potential resource exhaustion and the complete absence of anomaly-detection signal,
  not a practical brute-force path.
- **INT-KEY-001 (HIGH)** — see Missing Capabilities. The credential-lifecycle gap is scored HIGH
  (not MEDIUM) specifically because the *only* remediation path for a leaked/compromised
  application key is deleting and re-registering the entire application row (per
  `register-application.ts`'s own docstring and the CLI's own operator-facing message), and
  because zero visibility (no "last used", no UI, no logging per INT-KEY-002) means a leak
  cannot even be detected, only guessed at. For a product whose entire business is being other
  applications' trust anchor, "the only incident response to a leaked machine credential is
  destructive re-registration, and there's no way to know it leaked" is a real production
  security gap.
- **INT-API-003 (MEDIUM)** — no `redirect_uris` format/scheme/host validation on OAuth client
  create/edit. Lower severity than a typical open-redirect finding because the endpoint already
  requires platform-admin auth (not attacker-reachable pre-auth), but a malicious or compromised
  platform-admin session (or a copy-paste mistake) can register an OAuth client with an
  unvalidated redirect target with no server-side guardrail.

## Documentation Gaps

All findings below are **missing documentation**, not drift — every spot-checked existing claim
in `apps/documentation` was verified accurate against real code; zero cases were found of docs
describing something that doesn't exist.

- INT-DOC-001 (MEDIUM) — OAuth token endpoint / query params / scope parameter never documented
  at the HTTP level (a non-JS-SDK integrator has no reference beyond reading
  `packages/auth-sdk/src/client.ts` source).
- INT-DOC-002 (LOW) — no consolidated SDK API-reference page.
- INT-DOC-003 (MEDIUM) — no systematic error-response reference for `requirePermission()`/
  `verifyRequest()` 401/403 shapes or GoTrue's own OAuth error responses
  (`invalid_grant`, `redirect_uri_mismatch`, etc.).
- INT-DOC-004 (LOW) — SDK npm-install instructions appear only once, in `migration/page.tsx`,
  not in `getting-started` or a dedicated package page.
- Rate limits are correctly undocumented — since none exist, this is an accurate omission, not
  a doc gap in itself; it becomes a doc requirement only once INT-SEC-001 is addressed.

## API Gaps

- INT-API-001 (MEDIUM) — no DELETE/revoke for OAuth clients (API or UI). This is the same
  underlying gap Professional Review already tracks as `PQ-UX-009`; that finding's original
  "create+list only" framing is now stale (edit was added since), but its core — no way to
  decommission a client — remains accurate today. Not double-counted as a new independent risk;
  cross-referenced here because it's directly relevant to integration-surface completeness.
- INT-API-002 (LOW) — `PUT /api/oauth-clients?clientId=` is not REST-conventional (no
  `/api/oauth-clients/[id]` route exists), and only `client_name`/`redirect_uris` are editable.
- INT-API-003 (MEDIUM) — see Security Findings.
- INT-OPENAPI-001 (LOW) — no OpenAPI spec. Given the narrow current surface (2 endpoint
  families), this is a real but low-urgency gap — not the kind of blocker it would be for a
  broad public REST API.

## Webhook Gaps

- INT-WEBHOOK-001 (MEDIUM) — no webhook system exists anywhere: no subscriptions, events,
  delivery, retries, signing, or logs (confirmed via exhaustive grep of all first-party code and
  all 31 migrations — the only hits across 7 search terms were two confirmed false positives:
  a Supabase `onAuthStateChange` unsubscribe mock, and coincidental "mcp"-shaped substrings
  inside unrelated base64 hashes). See Recommendations for the honest assessment of whether this
  is worth building.

## MCP Gaps

- No MCP server, tools, or SDK dependency exist anywhere (confirmed via exhaustive grep — zero
  genuine hits across the whole repo, including every `package.json`). See INT-MCP-001 under
  Recommendations for the honest evaluation of whether one is warranted — conclusion: **not
  currently**, this is `NOT_APPLICABLE`, not a gap.

## Developer Experience Gaps

- INT-DX-001 (LOW) — `apps/playground` (`@kontrolia/playground`) is a single-file stub
  (`apps/playground/app/page.tsx`, 8 lines, literally "Reserved workspace shell — filled in as
  the SDKs stabilize" per its own `package.json` description) while the root `README.md:128`
  describes it to readers as "Sandbox para probar el SDK en vivo" — a real, if minor,
  expectation mismatch for anyone who goes looking for a working sandbox.
- INT-DX-002 (LOW) — all 4 examples use `workspace:*` for every `@kontrolia/*` dependency; none
  show the real registry semver ranges (`@kontrolia/auth@2.0.0`, `@kontrolia/react@1.2.1`,
  `@kontrolia/next@1.1.2`) an external consumer installing from npm would actually pin.
- A genuine Developer Portal (separate from `apps/documentation` + admin-panel) is **not**
  recommended at this time — see Recommendations; flagged here only so the "no overengineering"
  judgment is explicit rather than silent.

## Recommendations

In priority order, each tagged with its `INT-*` ID:

1. **INT-KEY-001 (HIGH)** — Add rotation and revocation to the application API key system (at
   minimum: a way to mint a new key for an existing application row without deleting it, and a
   way to invalidate the current key). Add a minimal admin-panel UI surfacing key status/
   creation date/last-used, even without full CRUD. This is the highest-value, most clearly
   justified fix in this audit — it's the closest thing this product has to a "credential a
   third party depends on" story, and today it has no recovery path.
2. **INT-KEY-002 (MEDIUM)** — Log failed and successful `/api/applications/sync` auth attempts
   (identity/prefix only, never the key itself) so a compromised or misused key is at least
   detectable.
3. **INT-SEC-001 (MEDIUM)** — Add rate limiting to `/api/oauth-clients` and
   `/api/applications/sync`. Given neither Kong nor Next middleware currently reaches these
   routes, this needs to be implemented at the route/application level (or by adding these
   routes to Kong's proxy surface with a rate-limiting plugin).
4. **INT-API-001 (MEDIUM)** — Add OAuth client delete/revoke (API + UI). Coordinate with
   Professional Review's existing `PQ-UX-009` rather than tracking as a fully separate item.
5. **INT-API-003 (MEDIUM)** — Validate `redirect_uris` (scheme, format, dedup) on OAuth client
   create/edit.
6. **INT-DOC-001 / INT-DOC-003 (MEDIUM)** — Add an HTTP-level reference for the OAuth
   authorize/token endpoints (params, scopes) and a systematic error-response reference. Highest
   documentation-value fix given the product's SDK-agnostic ambitions (any non-JS integrator
   currently has no path but reading source).
7. **INT-WEBHOOK-001 (MEDIUM, product decision)** — Evaluate building a minimal webhook system
   (e.g. `user.created`, `invitation.accepted`, `membership.role_changed`, `application.registered`)
   for downstream ecosystem apps that want to react to auth/IAM events without polling. This is a
   plausible, real product gap given what KontrolIA Auth is — but it is a genuine build decision
   with real scope (subscription model, signing, retries, delivery log), not a bug fix. Recommend
   scoping narrowly (3-4 real events, not a speculative catalog) if pursued.
8. **INT-API-004 (MEDIUM)** — Add (or document) one example demonstrating the actual cross-domain
   PKCE OAuth flow, since none of the 4 current examples show it despite it being the product's
   core differentiator.
9. **INT-DX-001 (LOW)** — Either build out `apps/playground` into a real working sandbox or soften
   the README's description of it until it is one.
10. **INT-API-002, INT-API-005, INT-API-006, INT-DOC-002, INT-DOC-004, INT-OPENAPI-001, INT-DX-002 (LOW)**
    — polish-tier, address opportunistically.

**No overengineering flag:** an MCP server, a full Developer Portal, and a complex webhook
pub/sub system were all evaluated and are explicitly **not** recommended at this time — see MCP
Gaps and Developer Experience Gaps above for the reasoning. Recommendation #7 above deliberately
scopes any webhook work to a minimal, narrow implementation rather than elaborate infrastructure.

## Priority

- **HIGH:** INT-KEY-001
- **MEDIUM:** INT-SEC-001, INT-KEY-002, INT-WEBHOOK-001, INT-API-001, INT-API-003, INT-API-004,
  INT-API-006, INT-DOC-001, INT-DOC-003
- **LOW:** INT-API-002, INT-API-005, INT-DOC-002, INT-DOC-004, INT-DX-001, INT-DX-002,
  INT-OPENAPI-001
- **CRITICAL:** none found.
