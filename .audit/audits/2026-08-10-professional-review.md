# Professional Quality Review Audit

## Date
2026-08-10T23:30:00

## Skill
kontrolia-professional-review

## Scope
Whole monorepo: apps/auth-server, apps/admin-panel, apps/documentation; packages/db, cli,
auth-sdk, react-sdk, next-sdk, permissions, shared, ui; examples/nextjs, react, express, nestjs.
First Phase 2 (professional-quality) run — no prior `.audit/review/` state to reconcile against.

Reachability: no live dev server (requires a real Supabase backend with env vars not configured
in this environment) — this is a **static code review**, not a live click-through. Every finding
below is grounded in reading actual source files (25+ files per sub-area, no filename-only
inference), not inferred from structure alone. This limitation is real and is called out
explicitly rather than silently narrowing the review to what was easy to check.

## Quality Score

| Dimension | Score | Capped by |
|---|---|---|
| UX | 40/100 | PQ-UX-001–006 (CRITICAL — 6 destructive actions fire with no confirmation) |
| UI | 60/100 | PQ-UI-001 (HIGH — zero responsive design anywhere) |
| Technical | 65/100 | PQ-TECH-001, PQ-TECH-002 (HIGH — no tests, no observability) |
| Security | 40/100 | PQ-SEC-001 (CRITICAL — last-owner lockout bypassable at the DB layer) |
| Performance | 50/100 | PQ-PERF-001–003 (HIGH — unbounded lists, N+1 admin calls, full-list refetch) |
| Accessibility | 65/100 | PQ-A11Y-001 (HIGH — unlabeled MFA code entry, a primary blocking flow) |
| Maintainability | 70/100 | — (MEDIUM only) |
| **Overall** | **40/100** | Whole-app CRITICAL cap (averaged dimension score was 56; CRITICAL findings in UX and Security cap OVERALL at 40 regardless) |

## Critical Issues

- **PQ-UX-001** — Remove-member fires immediately, no confirmation (admin-panel users list + detail page).
- **PQ-UX-002** — Revoke platform-admin fires immediately, no confirmation, no pending-state guard.
- **PQ-UX-003** — Revoke invitation fires immediately, no confirmation.
- **PQ-UX-004** — Disable application fires immediately, no confirmation.
- **PQ-UX-005** — Remove MFA factor fires immediately, no confirmation.
- **PQ-UX-006** — Revoke device fires immediately, no confirmation.
- **PQ-SEC-001** — Last-active-Owner lockout protection (fixed today at the API-route layer for
  memberships PATCH/DELETE) is missing entirely at the DB/RLS layer for `membership_roles` — an
  org Admin can DELETE the sole Owner's role assignment directly and reproduce the exact lockout
  scenario the earlier fix was meant to close, through a door that fix never covered.

## High Issues

- **PQ-UX-007** — Several list fetches never check the Supabase error, so a real outage renders identically to "empty."
- **PQ-UI-001** — Zero responsive design anywhere (no sm:/md:/lg: breakpoints; fixed sidebar; tables with no scroll wrapper).
- **PQ-A11Y-001** — MFA-challenge 6-digit code entry has no labels/fieldset — a primary, blocking login step.
- **PQ-PERF-001** — No pagination on any list endpoint except audit-logs (hard-capped at 200, no cursor).
- **PQ-PERF-002** — N+1 GoTrue admin API calls resolving member/admin emails (2 route files).
- **PQ-PERF-003** — User-detail page refetches the entire org member list to find one row.
- **PQ-TECH-001** — No automated tests anywhere except packages/permissions; zero coverage on JWT/PKCE/OAuth/middleware/any API route.
- **PQ-TECH-002** — No server-side logging or error-tracking anywhere in the backend.

## Medium Issues

- **PQ-SEC-002** — platform-admins last-admin check is a non-atomic COUNT-then-DELETE (TOCTOU race).
- **PQ-UX-008** — Raw Postgres/PostgREST error text reaches the UI in 2+ places.
- **PQ-UX-009** — No UI to revoke/delete a registered OAuth client.
- **PQ-A11Y-002** — Several inputs rely on placeholder-only or no label (org create/rename/delete-confirm, TOTP enroll, app URL edit).
- **PQ-A11Y-003** — UserMenu dropdown has no ARIA state, no Escape/outside-click close.
- **PQ-A11Y-004** — Active nav item conveyed by color alone, no aria-current.
- **PQ-A11Y-005** — No live-region treatment for any error/success message; no toast component exists.
- **PQ-PERF-004** — No skeleton/loading component; several list pages have no loading indicator.
- **PQ-PERF-005** — Unmemoized AuthProvider context value causes unnecessary re-renders app-wide.
- **PQ-MAINT-001** — corsHeaders() duplicated across 3 route files.
- **PQ-MAINT-002** — authorizePlatformAdmin duplicated with divergent return shapes across 2 files.
- **PQ-MAINT-003** — Error-message extraction pattern duplicated 31 times, no shared helper.
- **PQ-MAINT-004** — Two near-identical useOrganizations hooks (admin-panel + auth-server).
- **PQ-TECH-003** — No uniqueness constraint on invitations (org_id, email).
- **PQ-TECH-004** — Two parallel mutation paths (API-enforced vs RLS-only) — root cause of PQ-SEC-001.
- **PQ-TECH-005** — No index on memberships.status despite being filtered on every RLS check.
- **PQ-TECH-006** — Weak input validation on organizations POST (no slug format/length constraint).
- **PQ-TECH-007** — OAuth code-exchange fetch() calls unwrapped in try/catch in auth-sdk.
- **PQ-TECH-008** — applications/sync silently ignores one update call's error.

## MVP Smells

- **Confirmation gap is systemic, not isolated.** The plan-compliance fix closed exactly 1 of 9
  destructive actions found across both apps (suspend-member). 6 more fire with zero confirmation
  (PQ-UX-001–006); delete-organization is the one other action already done right (type-the-name
  pattern) and is the template the other six should follow. See
  `.audit/evidence/2026-08-10/professional-review/confirmation-audit.txt`.
- **Two enforcement mechanisms for the same kind of data** (server-route business rules vs
  browser-to-Supabase RLS-only) is the direct root cause of the new CRITICAL security finding
  (PQ-SEC-001/PQ-TECH-004) — a system built this way will keep reproducing the same bug class in
  whichever mutation happened to land on the RLS-only side.
- **Zero responsive design** — not "needs polish," genuinely absent (zero Tailwind breakpoint
  usages found repo-wide).
- **Zero test coverage outside one package** (`packages/permissions`) — including for the exact
  logic (JWT/PKCE/OAuth, last-owner enforcement) that already produced two real bugs today.
- **No observability** — no server-side logging, no error tracker, anywhere in the backend.
- One disclosed, already-tracked TODO (`apps/auth-server/app/api/invitations/route.ts:33`, email
  sending deferred to v1.5) — not a smell in the "abandoned work" sense, it's a documented scope
  decision already reflected in `QUALITY_REPORT.md`'s Plan Compliance section.
- No `lorem ipsum`/"coming soon"/hardcoded-fake-data patterns found anywhere. No `any`/`as any`
  escapes anywhere. No empty catch blocks. No dead/orphaned files. Examples are real, hand-written
  reference integrations, not unmodified starter templates. These are genuine positives, not
  smells — noted so the reader can tell they were actually checked.

## Evidence

- `.audit/evidence/2026-08-10/professional-review/mvp-smell-search.txt` — consolidated grep sweep
  (TODO/FIXME, console.log, empty catches, `any`, responsive breakpoints, `window.confirm(`,
  duplicated error-message pattern, test-file enumeration, logging/error-tracker search).
- `.audit/evidence/2026-08-10/professional-review/confirmation-audit.txt` — every destructive
  action found across both apps, cross-referenced against whether it requires confirmation.
- Per-finding evidence (file:line citations) is recorded on each issue in `.audit/review/issues.json`.

## Required Actions

CRITICAL (blocks shipping):
1. Add a confirmation step to remove-member, revoke-platform-admin, revoke-invitation,
   disable-application, remove-MFA-factor, and revoke-device — reuse the existing
   `window.confirm()` pattern from suspend-member, or the type-to-confirm pattern from
   delete-organization for the highest-blast-radius ones (PQ-UX-001–006).
2. Close the last-owner lockout gap at the DB/RLS layer for `membership_roles` — either a
   `BEFORE DELETE` trigger enforcing the same active-owner-count check, or a tightened RLS policy
   — so the protection can't be bypassed by calling PostgREST directly (PQ-SEC-001).

HIGH:
3. Add pagination (or at least a cursor/load-more) to every unbounded list endpoint, starting
   with organization-members, invitations, and audit-logs (PQ-PERF-001).
4. Batch the per-row GoTrue admin `getUserById` calls into one lookup in
   organization-members and platform-admins routes (PQ-PERF-002).
5. Add a `membershipId`-filtered fetch so the user-detail page stops loading the entire org
   member list (PQ-PERF-003).
6. Add responsive Tailwind variants to the admin-panel sidebar and wrap every data table in an
   `overflow-x-auto` container (PQ-UI-001).
7. Add labels/fieldset grouping to the MFA-challenge 6-digit code inputs (PQ-A11Y-001).
8. Check the `error` field on every list fetch and render a distinct error state
   (PQ-UX-007).
9. Add a baseline test suite for JWT verification, PKCE, and the middleware auth-gate at minimum
   (PQ-TECH-001).
10. Wire up server-side logging or an error-tracking service for the backend routes (PQ-TECH-002).

MEDIUM: see the 19 PQ-* entries in `.audit/review/issues.json` for the full list — recommended
next priority after CRITICAL/HIGH is PQ-TECH-004 (unify the two mutation-enforcement paths), since
it structurally prevents the next instance of PQ-SEC-001's bug class.

## Final Verdict

**NOT PRODUCTION READY**

Seven CRITICAL findings are open — six destructive actions across both apps that fire with zero
confirmation, and a security gap that lets an org Admin lock an organization out of Owner-level
access through a DB-layer door the same-day plan-compliance fix didn't cover. Per this skill's own
rubric, any open CRITICAL finding caps the verdict at NOT PRODUCTION READY regardless of the
numeric average (which would otherwise land around 56/100) — this is intentional: "everything's
fine except this one thing that will lock an org out of its own admin" is not a shippable state.
