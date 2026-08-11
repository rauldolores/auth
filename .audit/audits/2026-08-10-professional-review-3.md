# Professional Quality Review Audit

## Date
2026-08-11T00:20:00

## Skill
kontrolia-professional-review

## Scope
Third same-day Phase 2 run. Narrowly scoped per this run's brief: independently verify that
migration 0026 (commit b45ab5d, "Close the last-owner lockout at its source: memberships
itself") genuinely closes PQ-SEC-003 and PQ-SEC-004 (the two CRITICAL findings from the second
run), check for any new issue the migration itself introduces, and reconfirm PQ-SEC-001/PQ-SEC-002
are still accurately described. The 4 HIGH findings the user explicitly deferred as accepted
technical debt this round (PQ-UX-007, PQ-PERF-001, PQ-TECH-001, PQ-TECH-002) were carried forward
from `.audit/audits/2026-08-10-professional-review-2.md` without re-litigation, per instruction.
No other area of the whole-monorepo review was re-walked — see the first two same-day audit files
for that full-app coverage. Tested live against the running local Supabase sandbox (docker
container `supabase_db_VACIO`, port 54322), not static-only — all statements run inside
`BEGIN;...ROLLBACK;` transactions, no data permanently modified.

## Quality Score
| Dimension | Score | Capped by |
|---|---|---|
| UX | 70/100 | PQ-UX-007 (HIGH, deferred, unchanged) |
| UI | 82/100 | — (carried forward, not re-walked this run) |
| Technical | 70/100 | PQ-TECH-001, PQ-TECH-002 (HIGH, deferred, unchanged) |
| Security | 70/100 | PQ-SEC-005 (HIGH, NEW this run) — up from 40/100 (capped by CRITICAL) last run, now that PQ-SEC-003/PQ-SEC-004 are VERIFIED resolved |
| Performance | 70/100 | PQ-PERF-001 (HIGH, deferred, unchanged) |
| Accessibility | 68/100 | — (carried forward, not re-walked this run) |
| Maintainability | 70/100 | — (MEDIUM only, unchanged) |
| **Overall** | **70/100** | Whole-app HIGH cap (5 open HIGH findings: PQ-UX-007, PQ-PERF-001, PQ-TECH-001, PQ-TECH-002, PQ-SEC-005) |

## Critical Issues
None open. PQ-SEC-003 and PQ-SEC-004 — both CRITICAL last run — are independently VERIFIED
resolved this run by migration 0026 (commit b45ab5d), live-tested against the running local
Supabase sandbox, not taken on the fix's own claim.

## High Issues
- PQ-SEC-005 (NEW) — Migration 0026's UPDATE trigger (`prevent_last_owner_deactivation`) only
  inspects status transitions, never `organization_id` changes. A caller who is an org-admin of
  both the victim's current organization and some other organization they also administer can
  move the sole active Owner's membership to that other org while leaving `status='active'`
  unchanged, bypassing the owner-count check entirely and leaving the original org with zero
  active Owners. Live-exploited this run under that narrower dual-org-admin precondition;
  confirmed a single-org Admin (PQ-SEC-003/004's precondition) is blocked by RLS's implicit
  `WITH CHECK`. Not reachable via any shipped UI/API flow — only via direct PostgREST access with
  a known membership UUID.
- PQ-UX-007 — carried forward, deferred by explicit user decision. admin-panel's 3 cited call
  sites fixed; `apps/auth-server/lib/use-organizations.ts` still silently swallows fetch errors.
  See `.audit/audits/2026-08-10-professional-review-2.md` for full detail.
- PQ-PERF-001 — carried forward, deferred. 3 of 8 unbounded list endpoints paginated and
  verified; 5 remain unbounded (applications, roles, roles/[roleId], permissions,
  platform-admins GET). See prior audit file.
- PQ-TECH-001 — carried forward, deferred. 25 real passing tests added for JWT/PKCE/middleware;
  OAuth code exchange, react-sdk, and all API route handlers remain untested. See prior audit file.
- PQ-TECH-002 — carried forward, deferred. Structured logger + instrumentation verified wired
  through all 12 auth-server routes; admin-panel has zero observability. See prior audit file.

## Medium Issues
Unchanged from the second run (21 open) — not re-walked in depth this run except PQ-SEC-002,
explicitly re-confirmed unchanged (`apps/auth-server/app/api/platform-admins/route.ts:149-160`
still a non-atomic `SELECT COUNT(*)` then separate `DELETE`, no transaction/lock). Full list
carried forward from `.audit/audits/2026-08-10-professional-review-2.md` and
`QUALITY_REPORT.md`'s `# 2. Professional Quality` / `# 4. Outstanding Work`.

## MVP Smells
Not re-walked this run (narrow scope). See the first two same-day audit files for the full sweep.

## Evidence
- `.audit/evidence/2026-08-10/professional-review/migration-0026-live-verification.txt` — 7
  live-tested scenarios against the running local sandbox this run: PQ-SEC-003 re-verified
  blocked (including on a multi-role membership), PQ-SEC-004 re-verified blocked, legitimate
  2-owner suspend still works, org-deletion cascade still works cleanly, the new organization_id-
  change edge case (PQ-SEC-005, live-exploited under a dual-org-admin precondition, confirmed
  blocked for a single-org Admin), the non-org-deletion-cascade edge case (auth.users deletion
  correctly still blocked, though not reachable via any current app feature), and the 0025/0026
  trigger-interaction check (no conflict, no spurious block).
- `packages/db/migrations/0026_prevent_last_owner_membership_removal.sql` — read in full,
  including edge-case trace of the multi-role, organization_id-change, and cascade-origin
  scenarios named in this run's scope.
- `\d kontrolia_auth.memberships` against the live sandbox — confirmed both new triggers
  (`prevent_last_owner_membership_delete`, `prevent_last_owner_deactivation`) are installed and
  active alongside the existing `audit_membership_change` (0024) trigger, with correct BEFORE/
  AFTER ordering guaranteeing no conflict between the last-owner guard and audit logging.

## Required Actions
- **[HIGH] PQ-SEC-005** — Extend `prevent_last_owner_deactivation` (or add a parallel check) in a
  new migration to also treat `NEW.organization_id <> OLD.organization_id` as a "removal" for
  owner-count purposes, the same way `prevent_last_owner_membership_removal` already treats a
  DELETE. Low implementation cost given the sibling logic already exists as a template.
- **[HIGH, deferred by user decision] PQ-UX-007** — fix `apps/auth-server/lib/use-organizations.ts`
  to match the already-fixed admin-panel hook.
- **[HIGH, deferred by user decision] PQ-PERF-001** — paginate the 5 remaining unbounded list
  endpoints (applications, roles, roles/[roleId], permissions, platform-admins GET).
- **[HIGH, deferred by user decision] PQ-TECH-001** — add tests for OAuth code exchange, the
  React SDK's auth state machine, and API route handlers.
- **[HIGH, deferred by user decision] PQ-TECH-002** — wire the same logger/instrumentation
  pattern into apps/admin-panel.
- MEDIUM items unchanged — see `QUALITY_REPORT.md` `# 4. Outstanding Work` for the full list.

## Final Verdict
**FUNCTIONAL MVP** — no CRITICAL findings remain open (both live-exploited CRITICALs from the
second run are independently verified fixed by migration 0026). But 5 HIGH findings remain open,
spanning core professional-grade concerns for an auth product specifically — a new, narrower
security-trigger gap (PQ-SEC-005), zero test coverage on OAuth code exchange and the React SDK's
auth state machine, no admin-panel observability, an error-swallowing data-fetch hook on
auth-server's own primary dashboard, and 5 of 8 list endpoints still unbounded. These are not "a
few HIGH findings confined to non-core areas" (the bar for PROFESSIONAL BUT NEEDS POLISH) — they
cut across security, testing, and observability, core to what "production quality" means for an
authentication product. Per the gate's own rule (zero open HIGH/CRITICAL required for PASS),
Phase 2 still cannot reach PASS today, even though the two CRITICAL security bypasses that blocked
the prior run are now genuinely closed.
