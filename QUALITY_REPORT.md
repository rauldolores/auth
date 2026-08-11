# Quality Report

<!--
  Owned by kontrolia-plan-compliance: everything down through "4. Outstanding
  Work" (its own rows) and "5. Audit History". Sections "2. Professional
  Quality" and "3. Release Readiness" are owned by kontrolia-professional-review
  and kontrolia-release-readiness respectively — any skill editing this file
  must only touch its own section(s) and must never delete another section's
  content or the historical rows in Audit History / Outstanding Work.
-->

## Project
KontrolIA Auth (monorepo: apps/auth-server, apps/admin-panel, apps/documentation;
packages/db, cli, auth-sdk, react-sdk, next-sdk, permissions, shared, ui;
examples/nextjs, react, express, nestjs)

## Last Audit
2026-08-11T23:45:00

## Overall Status
PARTIAL

## Overall Compliance
100%

---

# 1. Plan Compliance

## Summary

| Status | Count |
|--------|-------|
| PASS | 42 |
| PARTIAL | 0 |
| FAIL | 0 |
| BLOCKED | 0 |
| NOT_VERIFIABLE | 0 |

_(Previous run 2026-08-10T21:00:00: 38 PASS / 4 PARTIAL / 90%. This run re-verified all 42
requirements after fix commit `4579870`, which targeted all four PARTIAL findings from the prior
run (REQ-006, REQ-008, REQ-017, REQ-034) plus two smaller quality items (stale doc comment, missing
suspend confirmation). All four fixes were independently re-verified as real and complete — not
taken on the developer's claim — and no new regression was found anywhere else in the 42-requirement
scope. First 100%-compliance result across the three audits run today. See Audit History and
`.audit/audits/2026-08-10-plan-compliance-3.md` for full detail.)_

## Requirements

| ID | Requirement | Status | Evidence | Verification |
|----|-------------|--------|----------|--------------|
| REQ-001 | Email/password registration, login, recovery, verification | PASS | apps/auth-server/app/(auth)/*, packages/auth-sdk/src/client.ts:78-142 | static inspection |
| REQ-002 | Org creation auto-enrolls creator as Owner | PASS | apps/auth-server/app/api/organizations/route.ts:53-56; migration 0011 | static inspection |
| REQ-003 | OAuth 2.1 + PKCE flow end-to-end (/oauth/consent) | PASS | auth-sdk client.ts:256-352; auth-server oauth/consent, api/oauth-clients | static inspection; cross-checked vs commits be58f93/244fc78/f6d39ef |
| REQ-004 | Social login (Google + Microsoft), config-driven | PASS | auth-sdk client.ts:104-110; login/page.tsx:51; .env.example:33-36 | static inspection |
| REQ-005 | MFA (TOTP) enrollment + login challenge | PASS | app/security/page.tsx; app/mfa-challenge/page.tsx; client.ts:360-416 | static inspection |
| REQ-006 | Invitations (create/accept/expire/revoke/resend) | PASS | admin-panel invitations/page.tsx:26-144 (real link/copy/revoke/resend, RLS-gated, resend now rotates token via randomToken()); migration 0024 (revoke/resend now audit-logged) | static inspection; manual trace revoke->accept returns 404; traced rotation through findInvitation() |
| REQ-007 | Session/device listing + revocation | PASS | api/devices/*; migration 0012:17-34 | static inspection |
| REQ-008 | Audit logging (DB-trigger only, not bypassable) | PASS | migration 0024_extend_audit_triggers.sql — adds memberships UPDATE trigger and invitations DELETE trigger, extends invitation-accepted trigger for resend, reuses 0023's org-delete-cascade guard pattern | static inspection; cross-checked vs migrations 0006, 0013, 0020, 0023 |
| REQ-009 | Platform admin (DB-backed, bootstrapped, JWT claim) | PASS | migrations 0016, 0017; api/oauth-clients, api/platform-admins | static inspection |
| REQ-010 | POST /api/applications/sync Bearer-key validation | PASS | api/applications/sync/route.ts:25-30,74-76 | static inspection |
| REQ-011 | App-scoped custom roles | PASS | migration 0019:52-194; admin-panel roles/page.tsx:95-131 | static inspection |
| REQ-012 | Custom Access Token Hook claims | PASS | migrations 0007, 0016, 0020 | static inspection |
| REQ-013 | RLS enforces documented access model | PASS | migrations 0009, 0010, 0018, 0019, 0021, 0023; PATCH endpoint rides pre-existing "org admins update memberships" policy | static inspection of all 24 migrations |
| REQ-014 | Org rename/delete reachable via real UI | PASS | auth-server app/page.tsx:93-215; api/organizations/[id]/route.ts | static inspection |
| REQ-015 | Cross-domain OAuth 2.1 SSO for third-party apps | PASS | auth-sdk client.ts:256-297; admin-panel oauth/callback | static inspection |
| REQ-016 | App permission-catalog registration distinct from OAuth client registration | PASS | db/src/register-application.ts; api/applications/sync | static inspection |
| REQ-017 | Admin-panel user management (list/remove/suspend/reactivate/detail) | PASS | organization-members/route.ts:107-182 (shared wouldRemoveLastOwner now status-filtered, closing the suspend-to-zero-owners lockout); confirm dialogs before suspend on both admin-panel screens | static inspection; manual re-trace of suspend-two-owners scenario against the fixed query |
| REQ-018 | Admin-panel role management | PASS | admin-panel roles/page.tsx:95-131 | static inspection |
| REQ-019 | Admin-panel permission assignment | PASS | admin-panel roles/[roleId]/page.tsx:108-137; migration 0019:76-83 | static inspection |
| REQ-020 | Admin-panel authenticates via OAuth2.1/SDK (dogfooding) | PASS | admin-panel providers.tsx, dashboard-shell.tsx, oauth/callback | static inspection |
| REQ-021 | Admin-panel mutations enforced server-side | PASS | cross-referenced 5+ mutation paths vs migrations, including PATCH/revoke/resend | static inspection |
| REQ-022 | @kontrolia/auth core SDK | PASS | packages/auth-sdk/src/{client,server,jwt}.ts | static inspection |
| REQ-023 | @kontrolia/react (AuthProvider/AuthGuard/RequirePermission/useAuth) | PASS | packages/react-sdk/src/{context,guards,use-auth}.tsx | static inspection |
| REQ-024 | @kontrolia/next middleware | PASS | packages/next-sdk/src/middleware.ts:41-63 | static inspection |
| REQ-025 | @kontrolia/ui components | PASS | packages/ui/src/index.ts, components/LoginForm.tsx | static inspection |
| REQ-026 | @kontrolia/permissions hierarchical engine + tests | PASS | packages/permissions/src/match.ts:14-32; __tests__/match.test.ts | static inspection + vitest run |
| REQ-027 | @kontrolia/db migrations + runner | PASS | packages/db/src/{migrate,register-application,grant-platform-admin}.ts | static inspection |
| REQ-028 | @kontrolia/shared genuinely consumed | PASS | packages/auth-sdk/src/*, react-sdk/src/context.tsx | grep sweep |
| REQ-029 | SDK-only integration promise (no direct Supabase/JWT) | PASS | repo-wide grep, 2 independent passes | grep sweep |
| REQ-030 | examples/nextjs | PASS | examples/nextjs/middleware.ts, providers.tsx, facturas/page.tsx | static inspection |
| REQ-031 | examples/react | PASS | examples/react/src/main.tsx, App.tsx | static inspection |
| REQ-032 | examples/express | PASS | examples/express/src/index.ts, to-fetch-request.ts | static inspection |
| REQ-033 | examples/nestjs | PASS | examples/nestjs/src/kontrolia-auth.guard.ts, app.controller.ts | static inspection |
| REQ-034 | CLI install wizard (incl. opens 2 browser tabs) | PASS | open-browser.ts real cross-platform opener, wired into install+deploy, now with child.on('error', () => {}) guarding the async spawn failure path | static inspection; grep for uncaughtException handler (still none, but now unnecessary — the fix is scoped correctly) |
| REQ-035 | CLI `update` | PASS | packages/cli/src/index.ts:111-151; utils/update.ts:14-83 | static inspection |
| REQ-036 | CLI `deploy` | PASS | packages/cli/src/index.ts:164-217 | static inspection |
| REQ-037 | CLI `migrate` | PASS | packages/cli/src/index.ts:30-44 | static inspection |
| REQ-038 | CLI `grant-admin <email>` | PASS | packages/cli/src/index.ts:58-94; db/src/grant-platform-admin.ts:24-50 | static inspection |
| REQ-039 | CLI `doctor` (read-only) | PASS | packages/cli/src/index.ts:97-102; utils/preflight.ts:24-70 | static inspection |
| REQ-040 | CLI cross-domain session-sharing auto-config | PASS | packages/cli/src/steps/deployment.ts:239-282; utils/oauth-client.ts:21-40 | static inspection |
| REQ-041 | CLI https:// deploy-URL validation | PASS | packages/cli/src/steps/deployment.ts:19-26,219,232 | static inspection; vs commit bc01e03 |
| REQ-042 | Monorepo build/typecheck/lint/test green | PASS | see Verification Results below | pnpm run build/typecheck/lint/test |

## Critical Gaps

None. All 42 requirements, including all 12 marked `critical` in `.audit/plan/requirements.json`,
are PASS this run.

## Missing Requirements

None found entirely unimplemented (FAIL with zero evidence). All 42 requirements have a real,
working, verified implementation.

## Partial Implementations

None this run. All four requirements that were PARTIAL in the prior audit (REQ-006, REQ-008,
REQ-017, REQ-034) were independently re-verified as fixed:

- **REQ-006 (Invitations)** — `handleResend` in `apps/admin-panel/app/invitations/page.tsx` now
  rotates the token on every resend (`randomToken()`, 24 random bytes hex-encoded, matching the DB
  column's own default shape); traced through `apps/auth-server/app/api/invitations/accept/route.ts`'s
  `findInvitation()` to confirm the old link genuinely 404s once rotated. Revoke and resend are now
  both captured by `audit_logs` via migration 0024.
- **REQ-008 (Audit logging)** — `packages/db/migrations/0024_extend_audit_triggers.sql` adds an
  `AFTER UPDATE` trigger on `kontrolia_auth.memberships` for status changes and an `AFTER DELETE`
  trigger on `kontrolia_auth.invitations` for revocation, and extends the invitation-accepted
  function to also log resends. Both new triggers correctly reuse the org-delete-cascade-safety
  guard (`if exists (select 1 from organizations where id = ...)`) that migration 0023 established,
  and were cross-checked against the schema-rename mechanics in migration 0020 to confirm the
  trigger-to-function bindings survive correctly.
- **REQ-017 (Admin-panel user management)** — `wouldRemoveLastOwner`'s owner-count query in
  `apps/auth-server/app/api/organization-members/route.ts` is now filtered on
  `memberships.status='active'`. Re-traced the exact two-Owner suspend scenario from the prior audit:
  the second suspend attempt is now correctly rejected with a 400 once only one active Owner remains.
  Confirmation dialogs before suspend are now present on both `apps/admin-panel/app/users/page.tsx`
  and `apps/admin-panel/app/users/[membershipId]/page.tsx`.
- **REQ-034 (CLI install wizard)** — `packages/cli/src/utils/open-browser.ts` now attaches
  `child.on('error', () => {})` to the spawned process before `unref()`, so a missing browser-opener
  binary (e.g. `xdg-open` absent on a headless host) is swallowed instead of crashing the CLI right
  after a successful install/deploy.

One purely cosmetic, non-blocking observation from this run (does not affect any requirement's
status): `packages/db/migrations/0024_extend_audit_triggers.sql`'s new `audit_invitation_deleted`
trigger is created with a plain `create trigger`, unlike `audit_membership_change` in the same file
which is preceded by `drop trigger if exists`. Functionally inert under the current migration runner
(`packages/db/src/migrate.ts` tracks applied migrations by filename and runs each file at most once),
flagged only for stylistic consistency.

---

# 2. Professional Quality

<!-- OWNED BY kontrolia-professional-review. kontrolia-plan-compliance must
     never write into this section beyond the initial NOT AUDITED seed. -->

## Overall Score
76/100 — PROFESSIONAL BUT NEEDS POLISH

## UX Score
73/100 (uncapped — unchanged this run; not re-walked, this round was narrowly scoped to
independently verifying commit 07d8ec5's new test suite, not a full UX sweep)

## UI Score
82/100 (uncapped — unchanged this run; not re-walked, out of this round's scope)

## Technical Score
78/100 (uncapped — up from 66. PQ-TECH-001 is now RESOLVED/VERIFIED: commit 07d8ec5 added 95
tests across all 12 of apps/auth-server/app/api/**/route.ts's route files. Independently read
organization-members.test.ts, platform-admins.test.ts, and invitations-accept.test.ts in full
and cross-checked every assertion against the real route.ts implementations — mocks sit at the
correct real boundary, wouldRemoveLastOwner()'s three branches are each distinctly fixtured with
exact status-code and exact response-body assertions matching route.ts's Spanish error strings
verbatim, and the invitations-accept regression test for commit 717bf03 asserts an exact
from()-call count, not a vague "didn't throw" check. Genuinely real coverage, not padding. Held
below "exceptional" only by the 6 still-open MEDIUM technical items — PQ-TECH-003 through
PQ-TECH-008 — none of which changed this round.)

## Security Score
84/100 (uncapped — no CRITICAL or HIGH open in this dimension any longer. PQ-SEC-009 was
independently re-verified this run — not taken on the fix commit's own message — genuinely,
correctly RESOLVED: the exact grant-then-rename chain from round 6 (create ordinary custom role,
self-grant via membership_roles, UPDATE its slug to 'owner') was re-attempted live end-to-end
against migration 0030 and blocked at the rename step by the new
`prevent_custom_role_reserved_slug` trigger, with `is_org_owner()` never reaching TRUE. Direct
slug='owner'/'admin'/'member' hijack attempts were also individually tested and blocked. Migration
0030's SQL was read in full: `is_org_admin()`/`is_org_owner()` now additionally require
`r.is_system_role`, the JWT hook's roles claim now only ever includes system-role slugs, and all
five 0025-0029 owner-counting queries were updated the same way — closing the count-inflation half
of the original exploit. The new trigger correctly exempts genuine system-role rows: live-confirmed
by re-running the real app-enablement bootstrap and observing its auto-created
`admin-facturacion` system role still get created without incident, and ordinary custom-role
slugs still insert/update freely. A fresh hunt for the same general pattern elsewhere in the
schema — `kontrolia_auth.applications.owner_organization_id`, `kontrolia_auth.platform_admins`,
`kontrolia_auth.user_permissions` — found all three genuinely clean: an ownership-reassignment
attempt on an app by a properly-isolated non-owning org admin was blocked (0 rows affected), a raw
self-grant INSERT into `platform_admins` was blocked by RLS (the table has only ever had a SELECT
policy), and a plain non-admin member's attempt to grant themselves a permission override via
`user_permissions` was blocked by RLS. Held below the "exceptional" band only for the one open
MEDIUM (PQ-SEC-002, a non-atomic TOCTOU race on the platform-admins last-admin check) and the
architectural pattern this whole security family exposed — six consecutive rounds of finding one
more adjacent, unguarded door before migration 0030 addressed the actual root cause.)

## Accessibility Score
68/100 (uncapped — unchanged this run; not re-walked, out of this round's scope)

## Performance Score
76/100 (uncapped — unchanged this run; not re-walked, out of this round's scope)

## Maintainability Score
70/100 (uncapped — unchanged this run; not re-walked, out of this round's scope)

## Critical Issues
None open.
- PQ-SEC-009 — remains RESOLVED (verified round 7), carried forward unchanged, not re-tested
  this round (unaffected by anything that changed since — commit 07d8ec5 is test-only).
- PQ-SEC-008 / PQ-SEC-006 / PQ-SEC-007 / PQ-SEC-005 / PQ-SEC-003 / PQ-SEC-004 — remain RESOLVED
  (verified in prior rounds), carried forward unchanged, not re-tested this round.
- PQ-UX-001–006 — remain RESOLVED (destructive-action confirmations), carried forward
  unchanged.

## High Issues
None open.
- PQ-TECH-001 — RESOLVED, VERIFIED this run (eighth same-day round). Independently confirmed
  commit 07d8ec5's 95 new tests across all 12 `apps/auth-server/app/api/**/route.ts` route files
  are genuinely real, not padding: read `organization-members.test.ts`, `platform-admins.test.ts`,
  `invitations-accept.test.ts`, and `test-helpers.ts` in full, cross-checked every assertion
  against the real route implementations. `wouldRemoveLastOwner()`'s three branches (blocks
  sole-active-Owner suspend/remove, allows it with a second active Owner, allows non-Owners
  freely) are each a distinctly-fixtured test case with exact status-code and exact response-body
  assertions, not "doesn't throw." Independently re-ran `pnpm turbo run test` fresh from the repo
  root: 145/145 pass, auth-server's 95 genuinely executed this run (cache miss), not replayed.
  Re-confirmed `apps/admin-panel` has zero `route.ts`/`route.tsx` anywhere and no `app/api`
  directory — PQ-TECH-001's scope was fully addressable by testing auth-server alone. Sanity-
  checked commit 07d8ec5's full diff: 16 files touched, all test files/config/package.json's test
  script/lockfile — zero implementation files modified. This is now the first round of the entire
  8-round Phase 2 sequence with zero open findings of CRITICAL or HIGH severity anywhere.
- PQ-TECH-009, PQ-UX-007, PQ-PERF-001, PQ-TECH-002, PQ-UI-001, PQ-A11Y-001, PQ-PERF-002,
  PQ-PERF-003 — remain RESOLVED (verified prior rounds), carried forward, no longer open.

## Medium Issues
24 open, unchanged this run (no new MEDIUM findings this round): PQ-SEC-002,
PQ-UX-008/009/010/011, PQ-A11Y-002–006, PQ-PERF-004–007, PQ-MAINT-001–004,
PQ-TECH-003–008. Full detail in `.audit/review/issues.json`.

## Polish Opportunities
Carried forward, not re-checked this run unless noted: `getSession()` vs `getUser()`
inconsistency server-side; CORS headers silently omitted (not failed-closed) when
`NEXT_PUBLIC_ADMIN_PANEL_URL` is unset; no rate limiting anywhere; CLI's top-level catch-all
prints a raw error object as a last resort; no configurable JWKS cache TTL in the SDK; duplicated
Supabase select-embed string between `getMemberships()`/`listMemberships()`; PATCH body typed as
loose `{status?: string}` rather than a real union; missing `aria-expanded` on the users-page
access-toggle; no skip-to-content link; a `title`-only tooltip for unconfigured app URLs; inline
date formatting repeated across 7 files; fresh Supabase browser client instantiated per call site
rather than once per module.
---

# 3. Release Readiness

<!-- OWNED BY kontrolia-release-readiness. kontrolia-plan-compliance must
     never write into this section beyond the initial NOT AUDITED seed. -->

## Release Status
READY WITH WARNINGS (Release Score: 90/100)

## Blocking Issues
None.

## Critical Issues
None.

## High Priority Issues
None. All findings this run are WARNING-level: REL-SEC-001, REL-DB-001, REL-DB-002, REL-DB-003,
REL-BE-001 (all carried forward with revised, more precise descriptions), plus two new findings
surfaced this run: REL-DEPLOY-003, REL-DEPLOY-004. Six of the 11 findings from the first run today
(REL-DEPLOY-001's core scope, REL-DEPLOY-002, REL-ENV-001, REL-ENV-002, REL-FE-001, REL-BUILD-001)
were independently re-verified as genuinely, completely fixed by commit `7080d4e`.

## Build
PASS — `pnpm turbo run build --force` (0 cache hits, fresh), 16/16 tasks successful, zero
compilation errors. Evidence: `.audit/evidence/2026-08-11/release-readiness/build-2.txt`.

## TypeScript
PASS — `pnpm turbo run typecheck --force` (0 cache hits, fresh), 19/19 tasks successful, zero type
errors. Evidence: `.audit/evidence/2026-08-11/release-readiness/typecheck-2.txt`.

## Lint
PASS — `pnpm turbo run lint --force` (0 cache hits, fresh), 23/23 tasks successful, 0 errors,
**0 warnings** (down from 1 — REL-BUILD-001 independently confirmed fixed). Evidence:
`.audit/evidence/2026-08-11/release-readiness/lint-2.txt`.

## Tests
PASS — `pnpm turbo run test --force` (0 cache hits, fresh), 146/146 tests passing across 5 packages
(permissions 5, auth-sdk 30, next-sdk 8, react-sdk 7, auth-server 96 — up from 95, the new
health.test.ts). Independently re-summed from this run's fresh raw output. Evidence:
`.audit/evidence/2026-08-11/release-readiness/tests-2.txt`.

## Security
No exposed secrets found. REL-SEC-001 re-investigated in depth per this run's brief (does
`GOTRUE_RATE_LIMIT_HEADER=X-Forwarded-For` actually work given this stack's Kong config?): the
fix is real for non-adversarial traffic, but independent research (WebSearch — neither Kong nor
GoTrue is vendored in this repo) found that `docker/kong.yml` has no ip-restriction plugin and
neither compose file configures `KONG_TRUSTED_IPS`/`real_ip_header`, so Kong does not sanitize a
client-supplied `X-Forwarded-For` before appending its own hop (standard nginx
`proxy_add_x_forwarded_for` behavior), and GoTrue trusts the leftmost, client-controlled entry of
that header. On the Docker self-host deploy target, a deliberate attacker can still bypass per-IP
rate limiting by spoofing the header. Stays WARNING/OPEN, not resolved as the commit message
implies — see `.audit/evidence/2026-08-11/release-readiness/rel-sec-001-kong-xff-review.txt`.

## Database
Unchanged since the prior run — commit `7080d4e` touched zero files under `packages/db/`.
REL-DB-001 (trigger-guard style inconsistency), REL-DB-002 (bookkeeping table schema location),
REL-DB-003 (patch-vs-minor semver judgment call) all re-confirmed accurate and correctly still
deferred; a fresh look does not change that judgment. Full detail:
`.audit/evidence/2026-08-11/release-readiness/remaining-fixes-and-db-recheck.txt`.

## Authentication
Not independently re-walked this round (unchanged since the prior PASS; commit `7080d4e` did not
touch login/session/logout code paths).

## Authorization
Not independently re-walked this round for the same reason. Confirmed by reading the full diffs of
`organization-members/route.ts`, `platform-admins/route.ts`, and `oauth-clients/route.ts` that this
commit changed only fetch-call timeout/error-handling, not authorization logic.

## Frontend
VERIFIED — REL-FE-001: `apps/admin-panel/app/users/page.tsx`'s initial member-list load now sets and
genuinely renders (`{error && <p>...}`, confirmed in the JSX, not just a forgotten state variable) an
error message on fetch failure. No new frontend findings this run.

## Backend
WARNING — REL-BE-001 only partially fixed, stays OPEN. `findUserByEmail` and `callGotrueAdmin` (raw
`fetch()` calls) genuinely gained `AbortSignal.timeout(10_000)`, and `findUserByEmail` also gained a
try/catch it was missing entirely — both real fixes. But `resolveEmails()`'s
`admin.auth.admin.listUsers()` calls in both `organization-members/route.ts` and
`platform-admins/route.ts` — likely the highest-traffic admin-panel routes — go through the Supabase
SDK client (no custom fetch/timeout configured) and remain completely unbounded. The commit's claim
of covering "every GoTrue admin API call" is not accurate. Full detail:
`.audit/evidence/2026-08-11/release-readiness/rel-be-001-timeout-review.txt`.

## Performance
PASS — unaffected by this commit's diff; pagination previously confirmed real on all spot-checked
list endpoints.

## Documentation
No material drift found in this commit's diff; the two `.env.example` comment expansions are
themselves documentation improvements. Not fully re-walked this round.

## Environment Configuration
VERIFIED — REL-ENV-001 (`NEXT_PUBLIC_OAUTH_CLIENT_ID` now documented in
`apps/admin-panel/.env.example` with a substantive explanation) and REL-ENV-002
(`GOTRUE_MAILER_AUTOCONFIRM`'s comment now explains the real production security implication and
points to SMTP config). Both diffs read directly and confirmed genuine, not cosmetic.

## Deployment
REL-DEPLOY-001 VERIFIED for its original scope: `migrate`/`update` now genuinely show a confirmation
prompt naming the host before applying against a non-local, URL-format connection string —
live-tested against 6 real connection-string shapes. REL-DEPLOY-002 VERIFIED: both apps' `/api/health`
routes are dependency-free and confirmed not interceptable by either app's middleware/auth-gate
(specifically checked per this run's brief). Two NEW WARNING findings from this round's deeper
scrutiny of the same change: **REL-DEPLOY-003** (`grant-admin` — an even more privileged operation
than migrate/update — was not given the same non-local-host confirmation gate at all) and
**REL-DEPLOY-004** (the new host parser fails open — treats an unparseable connection string as
local, skipping confirmation — for the libpq keyword/value connection-string format).

## Final Recommendation
Ship. Zero BLOCKERs and zero FAILs in any core category (AUTHENTICATION, AUTHORIZATION, SECURITY,
DATABASE) this run either. Of commit `7080d4e`'s 8 claimed fixes, 6 are independently verified as
genuinely, completely closed; 2 (REL-SEC-001, REL-BE-001) are real but partial improvements — both
refinements of an already-accepted, non-blocking gap, not regressions or newly-discovered severe
issues — now tracked with corrected, narrower descriptions instead of closed outright. This same
closing-verification pass surfaced 2 new WARNING findings (REL-DEPLOY-003, REL-DEPLOY-004), both
minor and non-blocking. Net: 11 open WARNINGs at the start of today are now 7. Recommend shipping
this release as-is; prioritize REL-DEPLOY-003 (extend the CLI confirmation gate to `grant-admin`)
and REL-SEC-001's Kong `trusted_ips`/`real_ip_header` configuration first in the next round, since
both are the closest of the 7 remaining items to a genuine security/production-safety concern.

---

# 4. Outstanding Work

| Priority | ID | Issue | Source | Status |
|----------|----|----|--------|--------|
| MEDIUM | REQ-006 | Invitation emails are never sent (TODO v1.5); no revoke/resend UI | Plan Compliance | VERIFIED (2026-08-10) — link/copy/revoke/resend real since commit 8a05162; remaining gap (token rotation) closed by commit 4579870, re-verified 2026-08-10T22:15:00 |
| MEDIUM | REQ-017 | No member suspend/deactivate action; no user-detail page in admin-panel | Plan Compliance | VERIFIED (2026-08-10) — suspend/reactivate + detail page real since commit 8a05162; remaining gap (last-owner bug) closed by commit 4579870, re-verified 2026-08-10T22:15:00 |
| LOW | REQ-034 | CLI install wizard never opens the two promised browser tabs at completion | Plan Compliance | VERIFIED (2026-08-10) — both tabs open since commit 8a05162; remaining gap (unhandled spawn error) closed by commit 4579870, re-verified 2026-08-10T22:15:00 |
| LOW | — | Test coverage is ~0% outside packages/permissions; JWT/OAuth/PKCE security logic has no automated tests | Plan Compliance | OPEN |
| LOW | — | social-login doc guide only covers Google in prose; Microsoft/TOTP config undocumented (code for both is real) | Plan Compliance | OPEN |
| CRITICAL | REQ-017 | `wouldRemoveLastOwner` owner-count query not filtered by `status='active'` — suspend can be used to lock an org out of all admin management (zero active Owners) | Plan Compliance | VERIFIED (2026-08-10T22:15:00, commit 4579870) — query now filters `memberships.status='active'`; suspend-two-owners lockout re-traced and confirmed blocked |
| CRITICAL | REQ-034 | `openBrowser()` has no `child.on('error', ...)` — missing `xdg-open` on headless Linux can crash the CLI right after a successful install/deploy | Plan Compliance | VERIFIED (2026-08-10T22:15:00, commit 4579870) — `child.on('error', () => {})` now attached before `unref()` |
| HIGH | REQ-008 | Audit-log triggers (migration 0013) don't cover `memberships` UPDATE (suspend/reactivate) or `invitations` DELETE (revoke) — these new admin actions leave no audit trail | Plan Compliance | VERIFIED (2026-08-10T22:15:00, commit 4579870) — migration 0024 adds both triggers, extends invitation-accepted trigger for resend |
| MEDIUM | REQ-006 | Invitation resend does not rotate the token — a previously-shared/leaked link stays valid after resend | Plan Compliance | VERIFIED (2026-08-10T22:15:00, commit 4579870) — `handleResend` now generates and persists a fresh 24-byte hex token; old link confirmed to 404 via `findInvitation()` |
| LOW | REQ-017 | No confirmation dialog before suspending a member in admin-panel | Plan Compliance | VERIFIED (2026-08-10T22:15:00, commit 4579870) — `window.confirm()` added on both `users/page.tsx` and `users/[membershipId]/page.tsx` |
| LOW | — | `apps/admin-panel/lib/supabase-browser.ts:6-8` doc comment claims the browser Supabase client is "read-only, no elevated privileges" — stale now that invitations page uses it for writes | Plan Compliance | VERIFIED (2026-08-10T22:15:00, commit 4579870) — comment corrected to describe read+write RLS-scoped usage |
| LOW | — | `packages/db/migrations/0024_extend_audit_triggers.sql`'s new `audit_invitation_deleted` trigger is created with a plain `create trigger`, unlike `audit_membership_change` in the same file which is preceded by `drop trigger if exists` — stylistic inconsistency only, no functional effect under the current filename-tracked migration runner | Plan Compliance | OPEN (non-blocking, optional cleanup) |
| CRITICAL | PQ-UX-001 | Remove-member fires immediately, no confirmation (admin-panel users list + detail page) | Professional Review | VERIFIED (2026-08-10T23:59:00) — window.confirm() with specific message confirmed present |
| CRITICAL | PQ-UX-002 | Revoke platform-admin fires immediately, no confirmation, no pending-state guard | Professional Review | VERIFIED (2026-08-10T23:59:00) — window.confirm() confirmed present |
| CRITICAL | PQ-UX-003 | Revoke invitation fires immediately, no confirmation | Professional Review | VERIFIED (2026-08-10T23:59:00) — window.confirm() confirmed present |
| CRITICAL | PQ-UX-004 | Disable application fires immediately, no confirmation | Professional Review | VERIFIED (2026-08-10T23:59:00) — window.confirm() confirmed present |
| CRITICAL | PQ-UX-005 | Remove MFA factor fires immediately, no confirmation | Professional Review | VERIFIED (2026-08-10T23:59:00) — window.confirm() confirmed present |
| CRITICAL | PQ-UX-006 | Revoke device fires immediately, no confirmation | Professional Review | VERIFIED (2026-08-10T23:59:00) — window.confirm() confirmed present |
| CRITICAL | PQ-SEC-001 | Last-owner lockout protection bypassable via direct DELETE on `kontrolia_auth.membership_roles` — the DB/RLS layer has no equivalent of the API-layer `wouldRemoveLastOwner` guard fixed earlier today | Professional Review | VERIFIED (2026-08-10T23:59:00) — migration 0025 live-tested against the running local DB, blocked as designed. NOTE: underlying vulnerability class NOT closed — see new rows PQ-SEC-003/PQ-SEC-004 below |
| CRITICAL | PQ-SEC-003 | Direct RLS DELETE on `kontrolia_auth.memberships` deletes the sole active Owner's membership entirely, cascading past migration 0025's last-owner check (which explicitly no-ops on cascade) | Professional Review | VERIFIED (2026-08-11T00:20:00, commit b45ab5d) — migration 0026 live-tested against the running local DB, blocked as designed, including on a multi-role membership |
| CRITICAL | PQ-SEC-004 | Direct RLS UPDATE of `memberships.status` to `'suspended'` for the sole active Owner has zero last-owner check at the DB layer | Professional Review | VERIFIED (2026-08-11T00:20:00, commit b45ab5d) — migration 0026 live-tested against the running local DB, blocked as designed |
| CRITICAL | PQ-SEC-006 | Unrestricted INSERT on kontrolia_auth.membership_roles lets any plain org Admin self-promote to Owner with zero authorization check, live-chained end-to-end with the legitimate 2-owner suspend path to fully lock out the org's real Owner | Professional Review | VERIFIED (narrow, 2026-08-11T14:00:00, migration 0028 / commit 0e615d9) — the literal INSERT vector is genuinely blocked; the broader self-promotion capability is not closed, see PQ-SEC-008 |
| CRITICAL | PQ-SEC-007 | Unrestricted UPDATE of memberships.user_id lets any plain org Admin silently reassign the sole Owner's membership to an arbitrary platform user with zero audit trail — a complete, untraceable organization takeover | Professional Review | VERIFIED (2026-08-11T14:00:00, migration 0028 / commit 0e615d9) — independently re-tested, fully and genuinely resolved, no adjacent bypass of this vector found |
| CRITICAL | PQ-SEC-008 | kontrolia_auth.membership_roles has zero trigger on UPDATE — a plain org Admin can self-promote to Owner, demote the sole active Owner, or hijack an existing Owner role row entirely via a single UPDATE, bypassing both migration 0025's DELETE-guard and migration 0028's INSERT-guard at once | Professional Review | VERIFIED (2026-08-11T18:00:00, migration 0029 / commit 717bf03) — all three UPDATE exploit variants independently re-exploited fresh, all now correctly blocked with clear errors; legitimate Owner-promotes-someone and service-role invitation-accept flows both re-confirmed still working. Broader escalation capability re-emerged via a different table — see new row PQ-SEC-009 |
| CRITICAL | PQ-SEC-009 | kontrolia_auth.roles has zero triggers of any kind, and its own custom-role RLS policies never restrict the `slug` value — a plain org Admin can create/hold an ordinary custom role and relabel its slug to 'owner' via a single UPDATE on kontrolia_auth.roles, becoming recognized as Owner (is_org_owner()=true) with zero involvement of membership_roles/memberships, a complete bypass of migrations 0025/0028/0029. Live-chained into a full org takeover: the real Owner's role was fully stripped once the fake 'owner' inflated the active-owner count past 1 | Professional Review | VERIFIED (2026-08-11T19:30:00, migration 0030 / commit 1549077) — independently re-exploited fresh (not taken on the commit's own message): full grant-then-rename chain and direct slug='owner'/'admin'/'member' hijack attempts all now blocked by the new prevent_custom_role_reserved_slug trigger plus is_system_role-anchored is_org_owner()/is_org_admin(); legitimate system-role bootstrap (app-enablement) and ordinary custom-role slugs both re-confirmed still working. Genuinely, fully resolved — no adjacent bypass found |
| HIGH | PQ-SEC-005 | Migration 0026's UPDATE trigger only inspects `status` transitions, never `organization_id` changes — a dual-org admin can move the sole active Owner's membership to another org they also administer, bypassing the owner-count check | Professional Review | VERIFIED (2026-08-11T10:00:00, migration 0027 / commit f44d3eb) — 5 live transaction-wrapped tests confirmed the fix, including a real RLS-authenticated dual-org-admin exploit attempt that no longer succeeds |
| HIGH | PQ-UX-007 | List fetches (organizations, use-organizations hook, audit-logs) never check the Supabase error — a real outage renders identically to "empty" | Professional Review | VERIFIED (2026-08-11T10:00:00, commit acb0c8a) — apps/auth-server/lib/use-organizations.ts now checks response.ok and surfaces the error, gating the create-org prompt correctly; all originally-cited call sites now fixed |
| HIGH | PQ-UI-001 | Zero responsive design anywhere — no sm:/md:/lg: breakpoints in either app or packages/ui; tables have no overflow-x-auto | Professional Review | VERIFIED (2026-08-10T23:59:00) — hamburger toggle + all 11 tables confirmed wrapped |
| HIGH | PQ-A11Y-001 | MFA-challenge 6-digit code entry has no labels/fieldset — a primary, blocking login step | Professional Review | VERIFIED (2026-08-10T23:59:00) — fieldset/legend/aria-label confirmed present |
| HIGH | PQ-PERF-001 | No pagination on any list endpoint except audit-logs (hard-capped at 200, no cursor) | Professional Review | VERIFIED (2026-08-11T10:00:00, commit acb0c8a) — all 5 remaining endpoints (applications, roles, roles/[roleId], permissions, platform-admins GET) now paginated with correct range math, confirmed via fresh code read |
| HIGH | PQ-PERF-002 | N+1 GoTrue admin API calls resolving emails in organization-members and platform-admins routes | Professional Review | VERIFIED (2026-08-10T23:59:00) — resolveEmails() confirmed to eliminate the N+1 call pattern |
| HIGH | PQ-PERF-003 | User-detail page refetches the entire org member list to find one row | Professional Review | VERIFIED (2026-08-10T23:59:00) — genuine single-row server lookup confirmed |
| HIGH | PQ-TECH-001 | No automated tests anywhere except packages/permissions — zero coverage on JWT/PKCE/OAuth/middleware/any API route | Professional Review | VERIFIED (2026-08-11T21:00:00, commit 07d8ec5) — 95 real tests added across all 12 apps/auth-server/app/api/**/route.ts route files; independently read the 3 highest-risk test files in full and cross-checked every assertion against the real route.ts implementations, confirmed genuinely real, distinctly-branched coverage (not padding); fresh `pnpm turbo run test` re-run confirms 145/145 pass with auth-server's 95 genuinely executed (cache miss); apps/admin-panel re-confirmed to have zero API routes of its own |
| HIGH | PQ-TECH-009 | Migration 0028's owner-grant guard depends on auth.uid(), which is always NULL under the service-role context invitation-accept actually runs in — any invitation offering the 'owner' role now always silently fails its role grant on acceptance, and the accept route never checks that call's error | Professional Review | VERIFIED (2026-08-11T18:00:00, migration 0029 / commit 717bf03) — both halves independently re-confirmed: auth.role()='service_role' short-circuit lets the legitimate grant through; accept route now checks the upsert's error and returns 500 instead of silently discarding it |
| HIGH | PQ-TECH-002 | No server-side logging or error-tracking anywhere in the backend | Professional Review | VERIFIED (2026-08-11T10:00:00, commit acb0c8a) — admin-panel gained logger.ts+instrumentation.ts; independently confirmed admin-panel genuinely has zero route.ts files and exactly one Server Component, validating the fix's completeness claim |
| MEDIUM | PQ-SEC-002 | platform-admins last-admin check is a non-atomic COUNT-then-DELETE (TOCTOU race) | Professional Review | OPEN — re-confirmed unchanged 2026-08-11T00:20:00 |
| MEDIUM | PQ-UX-010 | 4 newly-paginated admin-panel pages (applications, roles, roles/[roleId], permissions) never check the Supabase error field on list fetch | Professional Review | OPEN — new 2026-08-11T10:00:00 |
| MEDIUM | PQ-UX-011 | platform-admins' "Cargar más" can get stuck disabled forever on a raw network failure (no try/catch around fetch) | Professional Review | OPEN — new 2026-08-11T10:00:00 |
| MEDIUM | PQ-PERF-007 | Every paginated admin-panel list's mutation handlers reload at offset=0, silently resetting "Cargar más" progress | Professional Review | OPEN — new 2026-08-11T10:00:00 |
| MEDIUM | PQ-UX-008 | Raw Postgres/PostgREST error text reaches the UI (roles page, organization-members route) | Professional Review | OPEN — 3 new instances added by this run's PQ-UX-007 fix, confirmed 2026-08-10T23:59:00 |
| MEDIUM | PQ-UX-009 | No UI to revoke/delete a registered OAuth client | Professional Review | OPEN |
| MEDIUM | PQ-A11Y-002 | Several inputs rely on placeholder-only or no label (org create/rename/delete-confirm, TOTP enroll, app URL edit) | Professional Review | OPEN |
| MEDIUM | PQ-A11Y-003 | UserMenu dropdown has no ARIA state, no Escape/outside-click close | Professional Review | OPEN |
| MEDIUM | PQ-A11Y-004 | Active nav item conveyed by color alone, no aria-current | Professional Review | OPEN |
| MEDIUM | PQ-A11Y-005 | No live-region treatment for any error/success message; no toast component exists | Professional Review | OPEN |
| MEDIUM | PQ-A11Y-006 | New hamburger toggle missing aria-expanded and focus management | Professional Review | OPEN — new 2026-08-10T23:59:00 |
| MEDIUM | PQ-PERF-004 | No skeleton/loading component; several list pages show no loading indicator | Professional Review | OPEN |
| MEDIUM | PQ-PERF-005 | Unmemoized AuthProvider context value causes app-wide unnecessary re-renders | Professional Review | OPEN — confirmed unchanged 2026-08-10T23:59:00 |
| MEDIUM | PQ-PERF-006 | resolveEmails() rescans the entire platform user base on every call | Professional Review | OPEN — new 2026-08-10T23:59:00 |
| MEDIUM | PQ-MAINT-001 | corsHeaders() duplicated across 3 route files | Professional Review | OPEN |
| MEDIUM | PQ-MAINT-002 | authorizePlatformAdmin duplicated with divergent return shapes across 2 files | Professional Review | OPEN |
| MEDIUM | PQ-MAINT-003 | Error-message extraction pattern duplicated 31 times, no shared helper | Professional Review | OPEN |
| MEDIUM | PQ-MAINT-004 | Two near-identical useOrganizations hooks (admin-panel + auth-server) | Professional Review | OPEN — confirmed further diverged 2026-08-10T23:59:00 |
| MEDIUM | PQ-TECH-003 | No uniqueness constraint on invitations (org_id, email) | Professional Review | OPEN |
| MEDIUM | PQ-TECH-004 | Two parallel mutation paths (API-enforced vs RLS-only) — root cause of PQ-SEC-001 | Professional Review | OPEN — confirmed 2026-08-10T23:59:00 to be the real unresolved architectural root cause of PQ-SEC-003/PQ-SEC-004 |
| MEDIUM | PQ-TECH-005 | No index on memberships.status despite being filtered on every RLS check | Professional Review | OPEN |
| MEDIUM | PQ-TECH-006 | Weak input validation on organizations POST (no slug format/length constraint) | Professional Review | OPEN |
| MEDIUM | PQ-TECH-007 | OAuth code-exchange fetch() calls unwrapped in try/catch in auth-sdk | Professional Review | OPEN |
| MEDIUM | PQ-TECH-008 | applications/sync silently ignores one update call's error | Professional Review | OPEN |
| MEDIUM | REL-SEC-001 | No application-level rate limiting on login/register/password-reset; GoTrue's own per-IP limiter now enabled via `GOTRUE_RATE_LIMIT_HEADER` but bypassable by a deliberate attacker spoofing X-Forwarded-For given this stack's Kong config (no trusted_ips/real_ip_header set) | Release Readiness | OPEN — re-audited 2026-08-11T23:45:00, partial fix only (commit 7080d4e), not VERIFIED |
| LOW | REL-DB-001 | 6 of 7 new migrations (0024-0026, 0028, 0029) create triggers without `drop trigger if exists`, unlike the codebase's own pattern — harmless under the filename-tracked runner | Release Readiness | OPEN — re-confirmed unchanged 2026-08-11T23:45:00 |
| LOW | REL-DB-002 | `kontrolia_migrations` bookkeeping table created without a schema qualifier, lands outside `kontrolia_auth` | Release Readiness | OPEN — re-confirmed unchanged 2026-08-11T23:45:00 |
| LOW | REL-DB-003 | Migrations 0028-0030's security-hardening behavior changes are tagged `patch`, arguably `minor` under strict semver — defensible industry convention, flagged as a deliberate release-notes decision point | Release Readiness | OPEN — re-confirmed unchanged 2026-08-11T23:45:00 |
| MEDIUM | REL-DEPLOY-001 | `npx create-kontrolia-auth migrate`/`update` apply directly to any typed Postgres connection string with zero confirmation/dry-run/backup step | Release Readiness | VERIFIED (2026-08-11T23:45:00, commit 7080d4e) — migrate/update now show a confirmation prompt naming the host for any non-local URL-format connection string; live-tested against 6 real connection-string shapes |
| MEDIUM | REL-DEPLOY-002 | No health-check endpoint anywhere in apps/auth-server or apps/admin-panel; relevant to Docker/Railway/Coolify deploy targets the CLI supports | Release Readiness | VERIFIED (2026-08-11T23:45:00, commit 7080d4e) — GET /api/health added to both apps, dependency-free, confirmed not interceptable by either app's middleware/auth-gate |
| LOW | REL-DEPLOY-003 | `grant-admin` — a more privileged raw-DB-write command than migrate/update — was not given the same non-local-host confirmation gate they just received | Release Readiness | OPEN — new 2026-08-11T23:45:00, found while re-verifying REL-DEPLOY-001's fix |
| LOW | REL-DEPLOY-004 | The new CLI host-parser (`connectionHost()`) fails open — treats an unparseable connection string as local, skipping confirmation — for the libpq keyword/value connection-string format | Release Readiness | OPEN — new 2026-08-11T23:45:00, found while re-verifying REL-DEPLOY-001's fix |
| LOW | REL-ENV-001 | `NEXT_PUBLIC_OAUTH_CLIENT_ID` undocumented in `apps/admin-panel/.env.example` specifically (correctly documented/generated via docker/.env.example and the CLI installer) | Release Readiness | VERIFIED (2026-08-11T23:45:00, commit 7080d4e) — now documented with a substantive explanation |
| MEDIUM | REL-ENV-002 | `GOTRUE_MAILER_AUTOCONFIRM` defaults `true` in docker-compose, flagged only by a comment, not enforced off for production | Release Readiness | VERIFIED (2026-08-11T23:45:00, commit 7080d4e) — comment now explains the real production security implication and points to SMTP config |
| MEDIUM | REL-BE-001 | No explicit timeout on any external GoTrue admin API call (findUserByEmail, callGotrueAdmin, resolveEmails' listUsers loop) — a hung GoTrue instance could hang a route handler indefinitely | Release Readiness | OPEN — re-audited 2026-08-11T23:45:00, partial fix only (commit 7080d4e fixed findUserByEmail/callGotrueAdmin's raw fetch() calls but not resolveEmails()'s SDK-mediated listUsers() calls), not VERIFIED |
| MEDIUM | REL-FE-001 | `apps/admin-panel/app/users/page.tsx`'s initial member-list load silently shows an empty state on fetch failure instead of an error (same class as PQ-UX-010, one additional occurrence) | Release Readiness | VERIFIED (2026-08-11T23:45:00, commit 7080d4e) — error state now set and genuinely rendered in the JSX |
| LOW | REL-BUILD-001 | ESLint warning: `packages/react-sdk/src/context.tsx:27` useMemo missing dependency `config` — 0 errors repo-wide, this is the only warning | Release Readiness | VERIFIED (2026-08-11T23:45:00, commit 7080d4e) — silenced with a genuine explanatory comment; fresh lint run confirms 0 warnings anywhere |

Priority: BLOCKER, CRITICAL, HIGH, MEDIUM, LOW.
Status: OPEN, IN_PROGRESS, FIXED, VERIFIED, WONT_FIX, BLOCKED.
Source: which audit raised it (Plan Compliance / Professional Review /
Release Readiness), so each skill knows which rows are its own to update.

A row is not done because it says FIXED — it's done when a later audit
moves it to VERIFIED.

---

# 5. Audit History

| Date | Skill | Result | Compliance | Critical Issues |
|------|-------|--------|------------|------------------|
| 2026-08-10 | kontrolia-plan-compliance | PARTIAL | 93% | 0 FAIL, 3 PARTIAL (REQ-006, REQ-017, REQ-034) |
| 2026-08-10 (re-audit after commit 8a05162) | kontrolia-plan-compliance | PARTIAL | 90% | 0 FAIL, 4 PARTIAL (REQ-006, REQ-008 [new regression], REQ-017, REQ-034) — three targeted fixes made real progress but each introduced a new defect; REQ-008 regressed from PASS |
| 2026-08-10T22:15:00 (re-audit after commit 4579870) | kontrolia-plan-compliance | PASS | 100% | 0 FAIL, 0 PARTIAL — all four prior PARTIAL findings (REQ-006, REQ-008, REQ-017, REQ-034) independently re-verified as fixed; no new regression found |
| 2026-08-10T23:30:00 | kontrolia-professional-review | NOT PRODUCTION READY | — | 7 (6 destructive UI actions with no confirmation across both apps; last-owner lockout bypassable at the DB/RLS layer via `membership_roles`, a door the same-day plan-compliance fix didn't cover) |
| 2026-08-10T23:59:00 (re-audit after commit d1bf2cb) | kontrolia-professional-review | NOT PRODUCTION READY | — | 2 (down from 7 — all 6 UX-confirmation CRITICALs and the specific membership_roles vector of PQ-SEC-001 independently VERIFIED fixed via live DB testing; but 2 NEW CRITICAL findings, PQ-SEC-003/PQ-SEC-004, live-exploited this session — the identical last-owner-lockout outcome is still reachable via direct RLS DELETE/UPDATE on `kontrolia_auth.memberships`, doors migration 0025 didn't cover) |
| 2026-08-11T00:20:00 (re-audit after commit b45ab5d) | kontrolia-professional-review | FUNCTIONAL MVP | — | 0 (down from 2 — PQ-SEC-003/PQ-SEC-004 independently VERIFIED resolved via live DB testing against migration 0026, including a multi-role-membership edge case; 1 NEW HIGH finding, PQ-SEC-005, live-exploited this session under a narrower dual-org-admin precondition migration 0026 doesn't cover. 4 additional HIGH findings — PQ-UX-007, PQ-PERF-001, PQ-TECH-001, PQ-TECH-002 — deliberately deferred by explicit user decision as accepted technical debt, not re-verified in depth. Phase 2 still cannot PASS: 5 HIGH findings remain open) |
| 2026-08-11T10:00:00 (re-audit after commits f44d3eb, acb0c8a) | kontrolia-professional-review | NOT PRODUCTION READY | — | 2 (PQ-SEC-005 independently VERIFIED resolved via 5 live DB tests against migration 0027, including a real RLS-authenticated dual-org-admin exploit attempt; all 4 deferred HIGH findings from the third run — PQ-UX-007, PQ-PERF-001, PQ-TECH-002 fully VERIFIED, PQ-TECH-001 substantively improved but held at HIGH for its original untested-API-routes scope. But this round's explicit "check hard" instruction — testing role-assignment INSERT and membership user_id UPDATE, operations none of today's three migrations constrain — found and live-exploited 2 NEW CRITICAL findings, PQ-SEC-006 and PQ-SEC-007, that together fully defeat the entire day's last-owner-protection effort via a plain single-org-Admin precondition. Both root causes are day-one RLS policies (migration 0010) never touched by any fix today. Verdict returns to NOT PRODUCTION READY; Phase 2 does not close today) |
| 2026-08-11T14:00:00 (re-audit after commit 0e615d9, fifth same-day run) | kontrolia-professional-review | NOT PRODUCTION READY | — | 1 (PQ-SEC-006 and PQ-SEC-007 both independently re-verified this round, not taken on the prior round's own testing — genuinely closed for their narrowly-scoped vectors, with all legitimate flows re-confirmed still working. But hunting the exact adjacent-door class this round's brief named — role_id/membership_id changed via UPDATE instead of DELETE+INSERT on kontrolia_auth.membership_roles — found and live-exploited a NEW CRITICAL, PQ-SEC-008: that table has zero UPDATE trigger of any kind, fully defeating both migration 0025's DELETE-guard and migration 0028's INSERT-guard at once, via a plain single-org-Admin precondition, live-demonstrated three distinct ways (self-promotion, direct Owner demotion, role-row hijack). A secondary, non-security functional regression was also found (PQ-TECH-009, HIGH): migration 0028's owner-grant guard silently breaks the legitimate "invite as Owner" flow because auth.uid() is always NULL under the service-role context invitation-accept actually runs in. PQ-TECH-001 spot-checked, reconfirmed unchanged. Verdict remains NOT PRODUCTION READY — security is explicitly NOT fully closed this round, distinct from (and in addition to) the separate gate-passable question, which also fails independently on PQ-TECH-001) |
| 2026-08-11T18:00:00 (re-audit after commit 717bf03, sixth same-day run) | kontrolia-professional-review | NOT PRODUCTION READY | — | 1 (PQ-SEC-008 and PQ-TECH-009 both independently re-verified this round, not taken on the fifth round's own testing — genuinely, fully RESOLVED: all three membership_roles UPDATE exploit variants re-exploited fresh and blocked by migration 0029, legitimate flows re-confirmed working, and both halves of the service-role invitation-accept regression confirmed fixed. But directly pursuing the round's brief — hunt any other role/permission table that could achieve equivalent privilege escalation outside memberships/membership_roles entirely — found and live-exploited a NEW CRITICAL, PQ-SEC-009: kontrolia_auth.roles has zero triggers and its own custom-role RLS policies never restrict the slug value a role may hold, while every guard added today trusts roles.slug='owner' as a bare string. A plain Admin can create/hold an ordinary custom role, then relabel its slug to 'owner' via a plain UPDATE on kontrolia_auth.roles — a table none of today's five migrations touch — becoming recognized as Owner outside every guard built today. Live-chained into a full, demonstrated organization takeover (real Owner fully stripped, zero audit trail). PQ-TECH-001 re-confirmed unchanged (still HIGH, zero test files under apps/). Verdict remains NOT PRODUCTION READY: security is explicitly NOT closed this round — a sixth, more severe door was found through honest adversarial verification directly answering the round's own brief, not a repeat sweep. If PQ-SEC-009 is fixed and independently re-verified, PQ-TECH-001 would become the sole remaining item separating this app from a clean Phase 2 PASS — but that is not today's state) |
| 2026-08-11T19:30:00 (re-audit after commit 1549077, seventh same-day run, security-verification-only scope) | kontrolia-professional-review | PROFESSIONAL BUT NEEDS POLISH | — | 0 (PQ-SEC-009 independently re-exploited fresh this round against migration 0030, not taken on the fix commit's own message — genuinely, fully RESOLVED: the full grant-then-rename chain and direct slug='owner'/'admin'/'member' hijack attempts are all blocked by the new prevent_custom_role_reserved_slug trigger plus the is_system_role-anchored is_org_owner()/is_org_admin(); legitimate system-role bootstrap and ordinary custom-role slugs both re-confirmed still working. Migration 0030's SQL read in full for correctness. One more live-exploit hunt for the same general pattern elsewhere in the schema — applications.owner_organization_id, platform_admins, user_permissions — found all three genuinely clean under live adversarial testing (properly org-isolated non-owning admin for the ownership test, after self-catching and correcting an initial test-data mistake). Zero CRITICAL and zero new HIGH/MEDIUM findings this round. PQ-TECH-001 re-confirmed unchanged and is now the sole open finding of any severity — CRITICAL or HIGH — across the entire seven-round Phase 2 sequence. Verdict rises from NOT PRODUCTION READY to PROFESSIONAL BUT NEEDS POLISH: security is genuinely closed as of this round, subject to the honest caveat that this round did not re-walk UX/UI/accessibility/performance/maintainability, which are carried forward unchanged from round 6 and still contain 24 open MEDIUM findings) |
| 2026-08-11T21:00:00 (re-audit after commit 07d8ec5, eighth same-day run, narrow closing-verification scope) | kontrolia-professional-review | PROFESSIONAL BUT NEEDS POLISH | — | 0 (PQ-TECH-001 independently VERIFIED RESOLVED this round, not taken on the prior session's own claim of "145/145 pass": read organization-members.test.ts, platform-admins.test.ts, invitations-accept.test.ts, and test-helpers.ts in full and cross-checked every assertion against the real route.ts implementations — mocks sit at the correct real boundary, wouldRemoveLastOwner()'s three branches are each distinctly fixtured with exact status-code/response-body assertions matching route.ts's Spanish error strings verbatim, and the invitations-accept regression test for commit 717bf03 asserts an exact from()-call count rather than a vague "didn't throw" check — genuinely real, meaningfully-branched tests, not padding. Independently re-ran `pnpm turbo run test` fresh: 145/145 pass, auth-server's 95 tests genuinely executed this run (cache miss, not replayed). Re-confirmed apps/admin-panel has zero route.ts/route.tsx anywhere and no app/api directory — PQ-TECH-001's scope was fully addressable by testing auth-server alone. Sanity-checked commit 07d8ec5's full diff: 16 files touched, all test files/vitest.config.ts/package.json's test script and vitest devDependency/pnpm-lock.yaml — zero implementation files modified, confirming the change was genuinely test-only. This is the first round of the entire 8-round Phase 2 sequence with zero open CRITICAL or HIGH findings anywhere. Technical Score revised 66->78, Overall Score 76 (up from 75). Verdict remains PROFESSIONAL BUT NEEDS POLISH under this skill's own rubric only because Overall (76) sits below the 85 threshold required for PRODUCTION QUALITY — driven entirely by 24 still-open, non-blocking MEDIUM findings across UX/accessibility/performance/maintainability, none new this round, none CRITICAL/HIGH. Per the quality gate's own simpler pass rule (zero open HIGH/CRITICAL), Phase 2 now cleanly PASSES for the first time across all 8 rounds run today) |
| 2026-08-11T22:30:00 | kontrolia-release-readiness | READY WITH WARNINGS | Release Score: 91/100 | 0 blockers, 0 critical (first release-readiness run on this project — full fresh re-verification, not trusting Phase 1/2's same-day results: `pnpm turbo run build/typecheck/lint/test --force` all re-run with 0 cache hits — 16/16 build, 19/19 typecheck, 23/23 lint (1 warning), 145/145 tests all pass. Independent deep-dive on this run's unique Phase 3 scope — migrations 0024-0030 and the CLI's fresh-install/incremental-upgrade paths — found zero destructive operations, correct filename-tracked ordering, full per-file transactional safety, and all 7 changesets accurate and complete. Independent security/authn/authz spot-check found zero exposed secrets, zero client-exposed server secrets, RLS enabled on all 14 kontrolia_auth tables, and real server-side authorization on every route checked. Independent backend/frontend/env/deploy/docs pass found no BLOCKER or FAIL. 11 WARNING-level findings recorded (REL-SEC-001, REL-DB-001/002/003, REL-DEPLOY-001/002, REL-ENV-001/002, REL-BE-001, REL-FE-001, REL-BUILD-001) — none match a release-blocker category. Zero BLOCKERs, zero FAILs in any core category -> READY WITH WARNINGS) |
| 2026-08-11T23:45:00 (re-audit after commit 7080d4e, second same-day release-readiness run) | kontrolia-release-readiness | READY WITH WARNINGS | Release Score: 90/100 | 0 blockers, 0 critical (closing verification of commit 7080d4e, which claimed to close 8 of the first run's 11 WARNING findings. Fresh full-monorepo re-verification again, 0 cache hits: 16/16 build, 19/19 typecheck, 23/23 lint with 0 warnings (down from 1), 146/146 tests (up from 145, the new health.test.ts). Independently read every diff in the commit rather than trusting its message. 6 of 8 claimed fixes VERIFIED as genuine and complete: REL-DEPLOY-001's originally-described migrate/update confirmation gap (live-tested against 6 connection-string shapes), REL-DEPLOY-002 health endpoints (confirmed not interceptable by either app's middleware, specifically checked per this run's brief), REL-ENV-001/002 doc expansions, REL-FE-001's error-state fix (confirmed genuinely rendered, not just set), and REL-BUILD-001's lint fix. 2 of 8 (REL-SEC-001, REL-BE-001) found to be real but incomplete fixes, not full closures: REL-SEC-001's GOTRUE_RATE_LIMIT_HEADER addition is a genuine improvement for honest traffic, but independent research via WebSearch on Kong's and GoTrue's actual external behavior (neither is vendored in this repo) found this stack's kong.yml has no ip-restriction plugin and no trusted_ips/real_ip_header configured, so a deliberate attacker can still spoof X-Forwarded-For to defeat per-IP rate limiting on the Docker self-host deploy target; REL-BE-001's AbortSignal.timeout() fix covers only 2 of 4 GoTrue admin API call sites (the 2 raw fetch() calls), missing resolveEmails()'s SDK-mediated listUsers() calls on what are likely the highest-traffic admin-panel routes. Both stay OPEN with corrected, narrower descriptions. This same investigation surfaced 2 new WARNING findings: REL-DEPLOY-003 (grant-admin — more privileged than migrate/update — wasn't given the same confirmation gate) and REL-DEPLOY-004 (the new host-parser fails open, treating unparseable connection strings as local, for the libpq keyword/value format). REL-DB-001/002/003 re-confirmed unchanged and correctly still deferred (commit touched zero files under packages/db/). Net: 11 open WARNINGs -> 7 open WARNINGs. Zero BLOCKERs, zero FAILs in any core category throughout -> READY WITH WARNINGS, recommend ship) |

Append-only. Never delete or edit a previous row — a new audit adds a new
row, it doesn't replace the old one.

---

# 6. Important Evidence

- Data model / access control authority: `packages/db/migrations/0001` through `0023`
  (schema renamed from `kontrolia` to `kontrolia_auth` at 0020 — all current code must
  reference `kontrolia_auth.*`).
- Custom Access Token Hook (JWT claims `organization_id`/`roles`/`permissions`/
  `is_platform_admin`): authoritative body in `packages/db/migrations/0020_rename_schema_to_kontrolia_auth.sql`.
- OAuth 2.1 consent path fix (`be58f93`) confirmed live: `docker/docker-compose.yml:71`,
  `packages/cli/src/utils/supabase-management-api.ts:13,121`.
- `POST /api/applications/sync` key validation: `apps/auth-server/app/api/applications/sync/route.ts:25-30,74-76`
  (timing-safe SHA-256 compare against stored hash).
- Permission hierarchy engine + only real test suite in the repo: `packages/permissions/src/match.ts:14-32`,
  `packages/permissions/src/__tests__/match.test.ts`.
- Invitation-email gap: `apps/auth-server/app/api/invitations/route.ts:33` (now an explicit documented
  scope decision — manual link-sharing via `apps/admin-panel/app/invitations/page.tsx` — not a silent gap).
- CLI browser auto-open: real cross-platform opener — `packages/cli/src/utils/open-browser.ts`, wired
  at `packages/cli/src/index.ts:280-289` (install) and `:217-222` (deploy). As of commit `4579870`,
  `child.on('error', () => {})` is attached before `unref()`, closing the async-spawn-failure crash risk.
- Organization-members suspend/reactivate: `apps/auth-server/app/api/organization-members/route.ts:142-182`
  (PATCH), real enforcement via `is_org_admin`/Custom Access Token Hook filtering on `status='active'`
  (`packages/db/migrations/0007_custom_access_token_hook.sql`, `0009_helper_functions.sql`). As of
  commit `4579870`, the shared `wouldRemoveLastOwner` helper (`apps/auth-server/app/api/organization-members/route.ts:107-144`)
  filters its owner-count query on `memberships.status='active'`, closing the suspend-to-zero-active-owners
  lockout — re-traced against the exact two-Owner scenario that exposed the bug and confirmed fixed.
- Audit-log trigger coverage: `packages/db/migrations/0024_extend_audit_triggers.sql` (added by commit
  `4579870`) extends `packages/db/migrations/0013_audit_log_triggers.sql`'s trigger set with an
  `AFTER UPDATE` trigger on `kontrolia_auth.memberships` (status changes) and an `AFTER DELETE` trigger
  on `kontrolia_auth.invitations` (revocation), plus a resend branch on the existing invitation-accepted
  trigger. Both new triggers correctly reuse the org-delete-cascade guard pattern from
  `packages/db/migrations/0023_fix_audit_triggers_on_org_delete.sql`.
- Invitation token rotation on resend: `apps/admin-panel/app/invitations/page.tsx:30-38,124-144`
  (`randomToken()` + `handleResend`, added by commit `4579870`) — traced through
  `apps/auth-server/app/api/invitations/accept/route.ts`'s `findInvitation()` to confirm the previous
  token genuinely stops resolving once rotated.
- Verification command output (first run): `.audit/evidence/2026-08-10/{build,typecheck,lint,tests,detection-checklist-sweep}.txt`.
- Verification command output (second run): `.audit/evidence/2026-08-10/{build,typecheck,lint,tests,detection-checklist-sweep}-2.txt`.
- Verification command output (third run): `.audit/evidence/2026-08-10/{build,typecheck,lint,tests,detection-checklist-sweep}-3.txt`.
- Full requirement definitions, evidence, and history: `.audit/plan/requirements.json`.
