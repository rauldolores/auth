# Professional Quality Review Audit

## Date
2026-08-11T10:00:00

## Skill
kontrolia-professional-review

## Scope
Whole KontrolIA Auth monorepo (apps/auth-server, apps/admin-panel, apps/documentation;
packages/db, cli, auth-sdk, react-sdk, next-sdk, permissions, shared, ui; examples/*).
Fourth same-day Phase 2 run, intended as the closing round. Live database testing was
performed against the running local Supabase sandbox (docker container supabase_db_VACIO,
port 54322) for all security findings — not static-only. Build/typecheck/lint/test were
independently re-run from scratch by a background agent. UI/responsive/accessibility areas
were carried forward from the second run's live code inspection (dev server not started
this round) plus a fresh MVP-smells sweep and diff review of everything changed since.

## Quality Score

| Dimension | Score | Capped by |
|---|---|---|
| UX | 73/100 | — (uncapped; multiple MEDIUM gaps: raw error text now in ~7 places, no OAuth-client revoke UI, 2 new pagination error-swallowing instances, one stuck-loading-state gap) |
| UI | 82/100 | — (uncapped, carried forward from second run's verified fix) |
| Technical | 62/100 | PQ-TECH-001 — HIGH (API route handlers still completely untested) |
| Security | 40/100 | PQ-SEC-006, PQ-SEC-007 — CRITICAL |
| Performance | 76/100 | — (uncapped; PQ-PERF-001 now fully resolved, only MEDIUM gaps remain) |
| Accessibility | 68/100 | — (uncapped, carried forward, not re-walked live this round) |
| Maintainability | 70/100 | — (uncapped, MEDIUM findings only) |
| **Overall** | **40/100** | Whole-app cap: 2 CRITICAL findings open anywhere caps OVERALL at 40 regardless of the ~67 averaged score |

## Critical Issues

- **PQ-SEC-006** — A plain org Admin (not Owner) can self-promote to Owner via an
  unrestricted `INSERT` on `kontrolia_auth.membership_roles` (RLS policy from migration
  0010, never touched by any fix today). Chained with the legitimate "suspend one of two
  active Owners" path, this gives any Admin a complete, self-serve route to lock out the
  organization's real Owner without ever touching the victim's row directly. Live-exploited
  end-to-end (self-grant Owner, then suspend the original Owner) in a rolled-back
  transaction.
- **PQ-SEC-007** — A plain org Admin can silently reassign an Owner membership's `user_id`
  to any arbitrary platform user via an unrestricted `UPDATE` on `kontrolia_auth.memberships`
  (same migration-0010 policy). Since `organization_id`/`status` are untouched, none of
  migrations 0025/0026/0027's guards fire. The original Owner ends up with zero membership
  rows in the org; an arbitrary third party the attacker chose becomes sole Owner with no
  consent from anyone, and the audit trigger only logs `status` changes — this is completely
  untraceable. Live-exploited in a rolled-back transaction.

## High Issues

- **PQ-TECH-001** — No automated test coverage exists for any API route handler in either
  app. Real, substantive progress this round (client.ts OAuth exchange: 13 tests;
  react-sdk's AuthProvider state machine: 7 tests; both independently confirmed real, not
  filler) closed the two gaps explicitly named as highest-priority, but the finding's
  original stated scope ("any API route handler in apps/auth-server or apps/admin-panel")
  remains entirely untested — including the very routes carrying the `wouldRemoveLastOwner`
  business logic this whole day has been about.

## Medium Issues

24 open — see `.audit/review/issues.json` for full detail. New this round: PQ-UX-010
(4 newly-paginated admin-panel pages never check the Supabase `error` field on list fetch),
PQ-UX-011 (platform-admins' "Cargar más" can get stuck disabled forever on a raw network
failure), PQ-PERF-007 (every paginated list's mutation handlers reset "Cargar más" progress
back to page 1). Carried forward unchanged: PQ-SEC-002, PQ-UX-008, PQ-UX-009,
PQ-A11Y-002–006, PQ-PERF-004–006, PQ-MAINT-001–004, PQ-TECH-003–008.

## MVP Smells

Fresh repo-wide sweep this round (background agent) found no new smells: all 6
destructive-action `confirm()` dialogs still present and unmodified; no new console.log
leftovers outside legitimate CLI status output and one documentation code sample; the one
TODO found (`invitations/route.ts:33`, deferred email sending) is an explained, intentional
v1.5 scope decision, not a hidden gap; no empty catch blocks found; no new fixed-pixel-width
layouts; no new raw-stack-trace-to-UI instances beyond the already-tracked PQ-UX-008 pattern
(though PQ-UX-010 is an earlier-stage version of the same underlying problem — errors
dropped before they even reach the "raw text" stage).

## Evidence

- `.audit/evidence/2026-08-11/professional-review/migration-0027-live-verification-and-new-bypass-hunt.txt`
  — full transcript of all 9 live SQL tests (5 re-verifying PQ-SEC-005's fix, 4 hunting for
  and confirming the two new CRITICAL findings), transaction-wrapped and rolled back
  throughout.
- Prior evidence from earlier same-day rounds remains under `.audit/evidence/2026-08-10/`.
- Build/typecheck/lint/test independently re-run from scratch by a background agent this
  round: all clean, 50/50 tests passing (matches the fix commit's own claimed count exactly).

## Required Actions

1. **PQ-SEC-006 / PQ-SEC-007 (CRITICAL, blocking)** — Restrict the 'org admins manage
   membership roles' and 'org admins update memberships' RLS policies (or add BEFORE
   triggers) so that (a) granting the 'owner' role requires the caller to already be an
   active Owner (`is_org_owner()`), not merely an Admin, mirroring how "org owners can
   delete their organization" already requires `is_org_owner()`; and (b) `user_id` cannot
   be changed on an existing membership row via UPDATE at all — no legitimate flow needs
   this; membership changes should only ever happen via invite (new row) + remove (delete
   row).
2. **PQ-TECH-001 (HIGH)** — Add test coverage for API route handlers, starting with
   `organization-members` (the `wouldRemoveLastOwner` logic) and `platform-admins`.
3. MEDIUM items per `.audit/review/issues.json`, prioritized at the team's discretion —
   none block a release on their own, but PQ-UX-010/011 are quick, targeted fixes directly
   adjacent to code touched today.

## Final Verdict

**NOT PRODUCTION READY**

Two CRITICAL security findings (PQ-SEC-006, PQ-SEC-007) are open, both live-exploited
against the running database this session, both fully defeating the entire day's
last-owner-protection effort via preconditions no narrower than "any org Admin." Per the
scoring rubric, any open CRITICAL caps the verdict at NOT PRODUCTION READY regardless of the
substantial genuine progress made elsewhere today (0 HIGH security findings remain; only 1
HIGH finding total remains, versus 5 at the start of today; build/lint/typecheck/test are
all clean). Phase 2 does not close today.
