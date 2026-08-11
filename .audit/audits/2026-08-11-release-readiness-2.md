# Release Readiness Audit

## Date
2026-08-11T23:45:00

## Skill
kontrolia-release-readiness

## Release Status
READY WITH WARNINGS (Release Score: 90/100)

## Blocking Issues
None.

## Critical Issues
None.

## High Issues
None. All findings this run are WARNING-level: REL-SEC-001, REL-DB-001,
REL-DB-002, REL-DB-003, REL-BE-001 (all carried forward, revised
descriptions for SEC-001/BE-001), plus two new findings: REL-DEPLOY-003,
REL-DEPLOY-004.

## Automated Checks

### Build
`pnpm turbo run build --force`, 0 cache hits (fresh). 16/16 tasks
successful, zero compilation errors. Evidence: `build-2.txt`.

### TypeScript
`pnpm turbo run typecheck --force`, 0 cache hits (fresh). 19/19 tasks
successful, zero type errors. Evidence: `typecheck-2.txt`.

### Lint
`pnpm turbo run lint --force`, 0 cache hits (fresh). 23/23 tasks
successful, 0 errors, **0 warnings** (down from 1 last run — REL-BUILD-001
genuinely fixed). Evidence: `lint-2.txt`.

### Tests
`pnpm turbo run test --force`, 0 cache hits (fresh). 146/146 tests
passing across 5 packages (permissions 5, auth-sdk 30, next-sdk 8,
react-sdk 7, auth-server 96 — up from 95, the new health.test.ts).
Independently re-summed from the fresh raw output rather than trusting
the prior session's reported total. Evidence: `tests-2.txt`.

## Security

No exposed secrets found (spot-checked this run's diff; no new secret
introduced). REL-SEC-001 (rate limiting) re-investigated in depth per this
run's specific brief: commit 7080d4e added
`GOTRUE_RATE_LIMIT_HEADER: X-Forwarded-For` to docker-compose.yml's auth
service. This is a real, directionally-correct improvement — GoTrue
previously had no way to distinguish clients behind Kong at all. But
independent research (WebSearch, since neither Kong's nor GoTrue's
internals are vendored in this repo) found that Kong's actual
configuration in this stack (docker/kong.yml has no ip-restriction
plugin; neither compose file nor kong.yml sets KONG_TRUSTED_IPS or
real_ip_header) does not sanitize an inbound, client-supplied
X-Forwarded-For before appending its own hop — standard nginx
`proxy_add_x_forwarded_for` behavior is to append, not replace — and
GoTrue trusts the leftmost (client-controlled) entry of that header
by convention (Supabase's own docs explicitly note the header "is
expected to be set by a trusted upstream proxy," implying the burden is
on the proxy to have stripped it). On this project's Docker self-host
deploy target, where Kong's proxy port is exposed directly to the
internet, a deliberate attacker can still defeat per-IP rate limiting by
spoofing the header. REL-SEC-001 stays OPEN, not VERIFIED — the fix
closes the gap for honest/non-adversarial traffic but not against a
motivated attacker, contrary to what the commit message implies. Full
detail: `rel-sec-001-kong-xff-review.txt`.

## Database

Unchanged since the last run — commit 7080d4e touched zero files under
`packages/db/`. Re-confirmed REL-DB-001 (trigger-guard style
inconsistency), REL-DB-002 (bookkeeping table schema placement), and
REL-DB-003 (patch-vs-minor semver judgment call) all remain accurately
described and correctly deferred; a fresh look does not change that
judgment. All three stay OPEN, WARNING, non-blocking. Full detail:
`remaining-fixes-and-db-recheck.txt`.

## Authentication

Not independently re-walked this round (out of this round's narrow
closing-verification scope, unchanged since the prior run's PASS). Login/
session/logout code paths were not touched by commit 7080d4e.

## Authorization

Not independently re-walked this round for the same reason. The 3
routes previously spot-checked (organization-members, platform-admins,
oauth-clients) were touched by this commit only for timeout/error-
handling changes (REL-BE-001), not authorization logic — read the full
diffs for both files and confirmed no authorization-check code was
altered, only the fetch-call wrapping.

## Frontend

REL-FE-001 VERIFIED: `apps/admin-panel/app/users/page.tsx`'s initial
member-list load now sets and genuinely renders an error message on
fetch failure (confirmed the `{error && <p>...}` JSX actually exists, not
just a state variable set and forgotten). No new frontend findings this
run.

## Backend

REL-BE-001 only partially fixed — status stays OPEN, description revised.
Commit 7080d4e's diff read line-by-line: `findUserByEmail`
(platform-admins/route.ts) and `callGotrueAdmin` (oauth-clients/route.ts)
— both raw `fetch()` calls — genuinely gained
`AbortSignal.timeout(10_000)`, and `findUserByEmail` also gained a
try/catch it was missing entirely (a real, independent correctness fix).
But `resolveEmails()`'s `admin.auth.admin.listUsers()` calls in BOTH
`organization-members/route.ts` and `platform-admins/route.ts` — go
through the Supabase JS SDK client (`createSupabaseAdminClient()`, which
has no custom fetch/timeout configured) rather than raw `fetch()`, and
were not touched by this commit. These two call sites back the actual
Users list and Platform Admins list pages — likely the highest-traffic
admin screens — and remain completely unbounded against a hung GoTrue
instance. The commit's claim of "every GoTrue admin API call" is not
accurate. Full detail: `rel-be-001-timeout-review.txt`.

## Performance

No change this run; pagination previously confirmed real on all
spot-checked list endpoints, not affected by this commit's diff.

## Documentation

No material drift found in this commit's diff (only .env.example
comments were expanded, which is itself a documentation improvement, not
a regression). Not fully re-walked this round.

## Environment Configuration

REL-ENV-001 VERIFIED: `NEXT_PUBLIC_OAUTH_CLIENT_ID` now documented in
`apps/admin-panel/.env.example` with a substantive explanation (when
needed, what generates it, where it's consumed).
REL-ENV-002 VERIFIED: `GOTRUE_MAILER_AUTOCONFIRM`'s comment in
`docker/.env.example` now explains the real production security
implication and points to where SMTP config would go.

## Deployment

REL-DEPLOY-001 VERIFIED for its original scope: `migrate`/`update` now
genuinely show a confirmation prompt naming the host before applying
against a non-local, URL-format Postgres connection string — live-tested
against 6 real connection-string shapes via `node -e`, confirmed working
correctly for `postgres://`/`postgresql://` URLs including IPs and
uppercase hostnames.

REL-DEPLOY-002 VERIFIED: both apps' `/api/health` routes are genuinely
dependency-free and are not interceptable by any middleware/auth-gate in
either app (auth-server's middleware matcher explicitly excludes `/api`;
admin-panel has no middleware.ts at all).

Two NEW WARNING findings surfaced by this round's deeper scrutiny of the
same CLI change:
- **REL-DEPLOY-003**: `grant-admin` — an even more privileged operation
  than migrate/update (a raw DB write that bypasses the app's
  authorization layer entirely, per its own doc comment) — was not given
  the same non-local-host confirmation gate at all.
- **REL-DEPLOY-004**: `connectionHost()`'s `new URL()`-based parsing fails
  open (treats an unparseable string as "local," skipping confirmation)
  for the libpq keyword/value connection-string format
  (`host=... user=... password=...`), a real, if less common, Postgres
  connection-string shape the free-text prompt does nothing to reject.
  The code's own comment candidly acknowledges this tradeoff.

## Evidence

- `.audit/evidence/2026-08-11/release-readiness/build-2.txt`
- `.audit/evidence/2026-08-11/release-readiness/typecheck-2.txt`
- `.audit/evidence/2026-08-11/release-readiness/lint-2.txt`
- `.audit/evidence/2026-08-11/release-readiness/tests-2.txt`
- `.audit/evidence/2026-08-11/release-readiness/rel-sec-001-kong-xff-review.txt`
- `.audit/evidence/2026-08-11/release-readiness/rel-deploy-001-cli-confirm-review.txt`
- `.audit/evidence/2026-08-11/release-readiness/rel-deploy-002-health-endpoint-review.txt`
- `.audit/evidence/2026-08-11/release-readiness/rel-be-001-timeout-review.txt`
- `.audit/evidence/2026-08-11/release-readiness/remaining-fixes-and-db-recheck.txt`
- `git show 7080d4e` (full diff, read in its entirety across all 12
  changed files)

## Required Actions

None are release-blocking. Recommended before the *next* release, in
priority order:
1. **REL-DEPLOY-003** — extend the non-local-host confirmation gate to
   `grant-admin`, the most privileged of the three connection-string
   commands.
2. **REL-SEC-001** — configure Kong's `real_ip_header`/`trusted_ips` (or
   add an explicit ip-restriction/strip-headers step in kong.yml) so a
   client-supplied X-Forwarded-For can't ride through to GoTrue unaltered
   on the Docker self-host deploy target.
3. **REL-BE-001** — apply the same timeout treatment to
   `resolveEmails()`'s `listUsers()` calls (e.g. a custom `fetch` with
   `AbortSignal.timeout()` passed into `createSupabaseAdminClient()`),
   closing the gap on the two highest-traffic admin routes.
4. **REL-DEPLOY-004** — reject/warn on an unparseable connection string
   instead of silently treating it as local.
5. REL-DB-001/002/003 — unchanged, still fine to defer per their existing
   justification.

## Final Verdict
READY WITH WARNINGS — zero BLOCKERs, zero FAILs in any core category
(AUTHENTICATION/AUTHORIZATION/SECURITY/DATABASE), fresh build/typecheck/
lint/test all green (146/146 tests, 0 lint warnings). Of the 8 fixes
this commit claimed, 6 are genuinely, completely closed (REL-DEPLOY-002,
REL-ENV-001, REL-ENV-002, REL-FE-001, REL-BUILD-001, and REL-DEPLOY-001's
originally-described scope); 2 (REL-SEC-001, REL-BE-001) are real but
partial improvements, not the full closures their commit message
describes — both are refinements of an already-accepted, non-blocking
gap, not regressions or newly-discovered severe issues. This round's
investigation of those two also surfaced 2 new WARNING-level findings
(REL-DEPLOY-003, REL-DEPLOY-004). Net open WARNING count drops from 11 to
7, none of which meet any `release-blockers.md` category. Ship.
