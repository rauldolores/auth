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
2026-08-10T23:59:00

## Overall Status
NOT READY

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
40/100 — NOT PRODUCTION READY

## UX Score
70/100 (capped by: PQ-UX-007 — HIGH, admin-panel's list-error fix left the near-identical
auth-server hook untouched, still silently swallowing failures. All 6 destructive-action
confirmation CRITICALs — PQ-UX-001–006 — VERIFIED resolved this run.)

## UI Score
82/100 (uncapped — PQ-UI-001 VERIFIED resolved: responsive hamburger toggle and all 11
admin-panel tables wrapped in overflow-x-auto, confirmed this run)

## Technical Score
70/100 (capped by: PQ-TECH-001, PQ-TECH-002 — HIGH, real progress (25 new passing tests for
JWT/PKCE/middleware; structured logger wired through all 12 auth-server routes) but OAuth
exchange/react-sdk/all API routes still untested, admin-panel still entirely unobserved)

## Security Score
40/100 (capped by: PQ-SEC-003, PQ-SEC-004 — CRITICAL, NEW this run. PQ-SEC-001's specific
cited vector — membership_roles DELETE — is live-verified fixed by migration 0025, but the same
last-owner-lockout outcome is live-exploitable via 2 sibling doors migration 0025 doesn't cover:
a direct RLS DELETE and a direct RLS UPDATE(status) on kontrolia_auth.memberships itself)

## Accessibility Score
68/100 (uncapped — PQ-A11Y-001 VERIFIED resolved: MFA-challenge fieldset/legend/aria-labels
confirmed present. 6 MEDIUM findings remain, including 1 new: PQ-A11Y-006, the new hamburger
toggle missing aria-expanded/focus management)

## Performance Score
70/100 (capped by: PQ-PERF-001 — HIGH, organization-members/invitations/audit-logs correctly
paginated and verified this run, but 5 other list endpoints remain unbounded. PQ-PERF-002 and
PQ-PERF-003 VERIFIED resolved.)

## Maintainability Score
70/100 (capped by: — MEDIUM findings only, unchanged this run — duplicated corsHeaders/
authorizePlatformAdmin/error-message-extraction/useOrganizations; the useOrganizations
duplication (PQ-MAINT-004) is confirmed to have diverged further, not converged, this run)

## Critical Issues
- PQ-SEC-003 (NEW) — Direct RLS DELETE on `kontrolia_auth.memberships` deletes the sole active
  Owner's membership entirely, cascading past the last-owner check migration 0025 added — live-
  exploited this session against the running local DB.
- PQ-SEC-004 (NEW) — Direct RLS UPDATE of `memberships.status` to `'suspended'` for the sole
  active Owner has zero last-owner check at the DB layer — live-exploited this session.
- PQ-SEC-001 — RESOLVED for its literal cited vector (membership_roles DELETE, live-verified
  blocked); the underlying vulnerability class is NOT resolved — see PQ-SEC-003/004. Kept CRITICAL
  on record per the no-silent-rewrite rule; see `.audit/review/issues.json` history.
- PQ-UX-001–006 — RESOLVED. All 6 destructive-action confirmations verified present with specific
  messages (remove-member, revoke-platform-admin, revoke-invitation, disable-application,
  remove-MFA-factor, revoke-device).

## High Issues
- PQ-UX-007 — FIXED-but-partial: admin-panel's 3 cited call sites fixed; auth-server's near-
  identical use-organizations.ts hook untouched, still silently swallows failures.
- PQ-UI-001 — RESOLVED (verified: hamburger toggle + all 11 tables wrapped).
- PQ-A11Y-001 — RESOLVED (verified: fieldset/legend/aria-label).
- PQ-PERF-001 — FIXED-but-partial: 3 of 8 unbounded list endpoints paginated and verified; 5 remain
  unbounded (applications, roles, roles/[roleId], permissions, platform-admins GET).
- PQ-PERF-002 — RESOLVED (verified: N+1 call pattern genuinely eliminated).
- PQ-PERF-003 — RESOLVED (verified: genuine single-row server lookup).
- PQ-TECH-001 — FIXED-but-partial: 25 real passing tests added for JWT/PKCE/middleware; OAuth
  code exchange, react-sdk, and all API route handlers remain untested.
- PQ-TECH-002 — FIXED-but-partial: structured logger + instrumentation verified wired through all
  12 auth-server routes; admin-panel has zero observability, untouched.

## Medium Issues
- PQ-SEC-002 — platform-admins last-admin check is a non-atomic COUNT-then-DELETE (TOCTOU race) — confirmed unchanged this run
- PQ-UX-008 — Raw Postgres/PostgREST error text reaches the UI — now in 5 places (2 original + 3 new, introduced by this run's PQ-UX-007 fix reusing the same anti-pattern)
- PQ-UX-009 — No UI to revoke/delete a registered OAuth client
- PQ-A11Y-002 — Several inputs rely on placeholder-only or no label
- PQ-A11Y-003 — UserMenu dropdown has no ARIA state, no Escape/outside-click close
- PQ-A11Y-004 — Active nav item conveyed by color alone, no aria-current
- PQ-A11Y-005 — No live-region treatment for any error/success message; no toast component exists
- PQ-A11Y-006 (NEW) — New hamburger toggle missing aria-expanded and focus management
- PQ-PERF-004 — No skeleton/loading component; several list pages show no loading indicator
- PQ-PERF-005 — Unmemoized AuthProvider context value causes app-wide unnecessary re-renders (confirmed unchanged this run)
- PQ-PERF-006 (NEW) — resolveEmails() rescans the entire platform user base on every call
- PQ-MAINT-001 — corsHeaders() duplicated across 3 route files
- PQ-MAINT-002 — authorizePlatformAdmin duplicated with divergent return shapes across 2 files
- PQ-MAINT-003 — Error-message extraction pattern duplicated 31 times, no shared helper
- PQ-MAINT-004 — Two near-identical useOrganizations hooks — confirmed further diverged this run (one fixed, one not)
- PQ-TECH-003 — No uniqueness constraint on invitations (org_id, email)
- PQ-TECH-004 — Two parallel mutation paths (API-enforced vs RLS-only) — CONFIRMED this run, via live exploitation of PQ-SEC-003/004, to be the actual unresolved architectural root cause, not a theoretical concern
- PQ-TECH-005 — No index on memberships.status despite being filtered on every RLS check
- PQ-TECH-006 — Weak input validation on organizations POST (no slug format/length constraint)
- PQ-TECH-007 — OAuth code-exchange fetch() calls unwrapped in try/catch in auth-sdk
- PQ-TECH-008 — applications/sync silently ignores one update call's error

## Polish Opportunities
LOW/POLISH items not individually tracked (carried forward, not re-checked this run unless noted):
`getSession()` vs `getUser()` inconsistency server-side; CORS headers silently omitted (not
failed-closed) when `NEXT_PUBLIC_ADMIN_PANEL_URL` is unset; no rate limiting anywhere; CLI's
top-level catch-all prints a raw error object as a last resort; no configurable JWKS cache TTL in
the SDK; duplicated Supabase select-embed string between `getMemberships()`/`listMemberships()`;
PATCH body typed as loose `{status?: string}` rather than a real union; missing `aria-expanded` on
the users-page access-toggle; no skip-to-content link; a `title`-only tooltip for unconfigured app
URLs; inline date formatting repeated across 7 files; `dashboard-shell.tsx` grew further with the
new mobile-nav logic (still not a real complexity problem); fresh Supabase browser client
instantiated per call site rather than once per module; commit d1bf2cb's message claims "30 new
tests" where the actual new-test count is 25 (5 pre-existing permissions tests were included in
the claimed total) — minor inaccuracy, not fabrication, noted for the record.

---

# 3. Release Readiness

<!-- OWNED BY kontrolia-release-readiness. kontrolia-plan-compliance must
     never write into this section beyond the initial NOT AUDITED seed. -->

NOT AUDITED

- Release Status: —
- Blocking Issues: —
- Critical Issues: —
- Build: —
- TypeScript: —
- Lint: —
- Tests: —
- Security: —
- Database: —
- Authentication: —
- Frontend: —
- Backend: —
- Performance: —
- Documentation: —

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
| CRITICAL | PQ-SEC-003 | Direct RLS DELETE on `kontrolia_auth.memberships` deletes the sole active Owner's membership entirely, cascading past migration 0025's last-owner check (which explicitly no-ops on cascade) | Professional Review | OPEN — live-exploited 2026-08-10T23:59:00 against the running local DB |
| CRITICAL | PQ-SEC-004 | Direct RLS UPDATE of `memberships.status` to `'suspended'` for the sole active Owner has zero last-owner check at the DB layer | Professional Review | OPEN — live-exploited 2026-08-10T23:59:00 against the running local DB |
| HIGH | PQ-UX-007 | List fetches (organizations, use-organizations hook, audit-logs) never check the Supabase error — a real outage renders identically to "empty" | Professional Review | IN_PROGRESS (2026-08-10T23:59:00) — 3 admin-panel call sites fixed and verified; apps/auth-server/lib/use-organizations.ts (near-duplicate hook) untouched, still silent |
| HIGH | PQ-UI-001 | Zero responsive design anywhere — no sm:/md:/lg: breakpoints in either app or packages/ui; tables have no overflow-x-auto | Professional Review | VERIFIED (2026-08-10T23:59:00) — hamburger toggle + all 11 tables confirmed wrapped |
| HIGH | PQ-A11Y-001 | MFA-challenge 6-digit code entry has no labels/fieldset — a primary, blocking login step | Professional Review | VERIFIED (2026-08-10T23:59:00) — fieldset/legend/aria-label confirmed present |
| HIGH | PQ-PERF-001 | No pagination on any list endpoint except audit-logs (hard-capped at 200, no cursor) | Professional Review | IN_PROGRESS (2026-08-10T23:59:00) — organization-members/invitations/audit-logs paginated and verified; 5 other endpoints remain unbounded |
| HIGH | PQ-PERF-002 | N+1 GoTrue admin API calls resolving emails in organization-members and platform-admins routes | Professional Review | VERIFIED (2026-08-10T23:59:00) — resolveEmails() confirmed to eliminate the N+1 call pattern |
| HIGH | PQ-PERF-003 | User-detail page refetches the entire org member list to find one row | Professional Review | VERIFIED (2026-08-10T23:59:00) — genuine single-row server lookup confirmed |
| HIGH | PQ-TECH-001 | No automated tests anywhere except packages/permissions — zero coverage on JWT/PKCE/OAuth/middleware/any API route | Professional Review | IN_PROGRESS (2026-08-10T23:59:00) — 25 real passing tests added for JWT/PKCE/middleware; OAuth exchange/react-sdk/API routes still untested |
| HIGH | PQ-TECH-002 | No server-side logging or error-tracking anywhere in the backend | Professional Review | IN_PROGRESS (2026-08-10T23:59:00) — logger+instrumentation wired through all 12 auth-server routes; admin-panel still unobserved |
| MEDIUM | PQ-SEC-002 | platform-admins last-admin check is a non-atomic COUNT-then-DELETE (TOCTOU race) | Professional Review | OPEN — confirmed unchanged 2026-08-10T23:59:00 |
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
