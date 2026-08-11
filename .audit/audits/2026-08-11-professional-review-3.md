# Professional Quality Review Audit

## Date
2026-08-11T18:00:00

## Skill
kontrolia-professional-review

## Scope
Sixth same-day Phase 2 audit. Narrowly scoped closing-verification pass per
explicit instruction — NOT a full-app UX/UI/accessibility/performance/
maintainability re-sweep (rounds 1-3 already did that exhaustively) and NOT
a repeat of the escalating security deep-dive's earlier steps (rounds 3-5
already found and fixed PQ-SEC-001/003/004/005/006/007/008). This round's
brief was four specific things: (1) independently re-run the round-5 exploit
tests against the live sandbox rather than trust the transcript; (2) hunt
for any other write path to memberships/membership_roles, or any other
role/permission table achieving equivalent privilege escalation outside
those two tables; (3) check whether auth.role() behaves correctly in
migrations 0025-0027's other SECURITY DEFINER trigger functions, not just
0028/0029; (4) confirm PQ-TECH-001's status. Ran the app's live local
Supabase sandbox (docker container supabase_db_VACIO, port 54322) directly
via psql, using real RLS-authenticated sessions (SET LOCAL ROLE +
request.jwt.claims), every test transaction-wrapped and rolled back. Not a
static-only review for the security portion — genuinely executed against
the running database. Read source code (migrations 0001-0029, invitations
accept route, RLS policy definitions) directly, not just prior audit
summaries.

## Quality Score
| Dimension | Score | Capped by |
|---|---|---|
| UX | 73/100 | — (unchanged, out of scope this round) |
| UI | 82/100 | — (unchanged, out of scope this round) |
| Technical | 66/100 | HIGH cap 70 — PQ-TECH-001 |
| Security | 40/100 | CRITICAL cap 40 — PQ-SEC-009 (NEW) |
| Performance | 76/100 | — (unchanged, out of scope this round) |
| Accessibility | 68/100 | — (unchanged, out of scope this round) |
| Maintainability | 70/100 | — (unchanged, out of scope this round) |
| **Overall** | **40/100** | Whole-app CRITICAL cap — PQ-SEC-009 |

## Critical Issues
- **PQ-SEC-009 (NEW)** — `kontrolia_auth.roles` has zero triggers and its own
  RLS policies never restrict the `slug` value a role may hold. Every
  last-owner/owner-grant guard added today (0025, 0028, 0029) and both
  permission helpers (`is_org_owner`, `is_org_admin`) identify "the Owner
  role" by bare string match on `roles.slug = 'owner'`. A plain org Admin
  can create/hold an ordinary custom app-scoped role, then relabel its slug
  to `'owner'` via a single UPDATE on `kontrolia_auth.roles` — a table none
  of today's five migrations touch — becoming recognized as Owner with zero
  involvement of `membership_roles`/`memberships`. Live-chained one step
  further into a full, demonstrated organization takeover: the real Owner
  is fully stripped of their role, the attacker becomes the sole recognized
  Owner, with no audit trail.
- **PQ-SEC-008 — RESOLVED, VERIFIED this round.** Independently re-exploited
  all three original UPDATE variants fresh; all now correctly blocked. The
  legitimate Owner-promotes-someone and service-role invitation-accept
  flows both independently re-confirmed still working. This specific vector
  is genuinely closed — see PQ-SEC-009 for the newly-found adjacent one.
- PQ-SEC-001, PQ-SEC-003, PQ-SEC-004, PQ-SEC-005, PQ-SEC-006, PQ-SEC-007 —
  remain RESOLVED/VERIFIED from prior rounds, not re-tested this round
  (unaffected by anything that changed since their own verification), no
  reason found to doubt them.
- PQ-UX-001–006 — remain RESOLVED, carried forward unchanged.

## High Issues
- **PQ-TECH-001** — re-confirmed unchanged this round: zero test files
  anywhere under `apps/auth-server` or `apps/admin-panel`, no test script in
  either app's `package.json`. Genuinely still the only open HIGH finding
  from the technical/testing family. Fresh `find`/`Grep` sweep this round,
  not taken on a prior round's word.
- **PQ-TECH-009 — RESOLVED, VERIFIED this round.** Both halves independently
  re-confirmed: migration 0029's `auth.role() = 'service_role'` short-circuit
  lets the legitimate service-role owner-grant through (re-tested live);
  `apps/auth-server/app/api/invitations/accept/route.ts` now checks the
  role-grant upsert's error and returns 500 instead of silently marking the
  invitation accepted regardless (re-read the current file in full).
- PQ-UX-007, PQ-PERF-001, PQ-TECH-002, PQ-UI-001, PQ-A11Y-001, PQ-PERF-002,
  PQ-PERF-003 — remain RESOLVED, carried forward, not re-touched this round.

## Medium Issues
Unchanged this round (not in scope): 24 open, same set as last round —
PQ-SEC-002, PQ-UX-008/009/010/011, PQ-A11Y-002–006, PQ-PERF-004–007,
PQ-MAINT-001–004, PQ-TECH-003–008. Full detail in `.audit/review/issues.json`.

## MVP Smells
Not re-walked this round (out of scope, narrowly focused per instruction).
The one smell directly surfaced by this round's work: relying on a bare
string comparison (`slug = 'owner'`) as the sole signal of "this membership
holds ultimate authority," with the string itself sitting on a freely
RLS-writable, trigger-free table — a textbook "identity is data the
attacker can also write" pattern, of the same family PQ-SEC-006/007/008
already exposed on the tables the day's fixes did cover.

## Evidence
- `.audit/evidence/2026-08-11/professional-review/round6-membership-roles-update-reverify.txt`
  — independent re-run transcript for all 3 original UPDATE exploit
  variants (Tests 1-3, blocked), the legitimate Owner-promotes-someone case
  (Test 4, succeeds), and the service-role invitation-accept grant (Test 5,
  succeeds), plus the TRUNCATE-grant check and the auth.role()/current_user
  audit of migrations 0025-0027.
- `.audit/evidence/2026-08-11/professional-review/round6-PQ-SEC-009-roles-table-slug-hijack.txt`
  — full live transcript of the new CRITICAL: zero-trigger confirmation on
  `kontrolia_auth.roles`, the 4-step exploit (create custom role → self-grant
  → rename slug to 'owner' → confirmed `is_org_owner()=true`), and the
  full-chain takeover (real Owner fully stripped via the now-legitimate-
  looking 2-owner count).
- Migration source read in full: `packages/db/migrations/0025` through
  `0029`, `0009_helper_functions.sql`, `0019_app_scoped_custom_roles.sql`,
  `0021_org_owner_delete.sql`.
- `apps/auth-server/app/api/invitations/accept/route.ts` (current) read in
  full — confirms the PQ-TECH-009 application-code fix.

## Required Actions
1. **PQ-SEC-009 (CRITICAL, blocks release on its own).** Add a BEFORE
   UPDATE (and ideally BEFORE INSERT) trigger on `kontrolia_auth.roles` that
   blocks any attempt to set `slug` to a reserved value (`'owner'`,
   `'admin'`, `'member'`) on a row that isn't the canonical system role — or,
   more robustly, stop identifying the Owner role by slug string anywhere
   (`is_org_owner`, `is_org_admin`, and the 0025/0028/0029 guards) and
   instead reference the canonical system role's fixed `id`, or an
   `is_owner_role` boolean settable only by migration and never through any
   RLS-writable path.
2. **PQ-TECH-001 (HIGH, known since round 1, unaddressed today).** Add
   automated tests for API route handlers in `apps/auth-server` and
   `apps/admin-panel` — the last named gap in this finding's original scope.
   Not attempted this round per instruction (confirmation-only).

## Final Verdict
**NOT PRODUCTION READY**

A CRITICAL is open (PQ-SEC-009), found and live-exploited this round through
a table (`kontrolia_auth.roles`) completely outside every guard the day's
five migrations added. Security is explicitly **not** closed as of this
round — this is a materially different, more severe outcome than a clean
close would have been, and it is distinct from (and in addition to) the
separately-failing, already-known gate question (PQ-TECH-001, HIGH,
unaddressed since round 1). If PQ-SEC-009 is fixed and independently
re-verified, PQ-TECH-001 would become the only thing standing between this
audit and a PASS — but that is not today's state.
