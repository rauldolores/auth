# Professional Quality Review Audit

## Date
2026-08-11T14:00:00

## Skill
kontrolia-professional-review

## Scope
Narrowly scoped, fifth same-day Phase 2 audit — NOT a full whole-app static/UX/UI/perf/accessibility
re-sweep (that was already done exhaustively in rounds 2-4 today). This round:
(1) read migration 0028's SQL in full and independently verified its trigger logic, including
edge cases (null/invalid role_id, dangling membership_id, cascade interaction with 0025/0026/0027,
trigger-firing order between the two BEFORE UPDATE triggers now on kontrolia_auth.memberships);
(2) independently re-ran live exploit tests for PQ-SEC-006 and PQ-SEC-007 against the running local
Supabase sandbox, rather than trusting this session's own prior-round testing at face value;
(3) spent one more deliberate round hunting for an adjacent gap in the Owner/Admin authorization
model, specifically the hint named in this round's brief: can membership_roles.role_id (or its
sibling PK column, membership_id) be changed via UPDATE, sidestepping both the 0025 DELETE-guard
and the 0028 INSERT-guard? All testing was against the running local Supabase Postgres (docker
container supabase_db_VACIO, port 54322), using real authenticated non-superuser sessions (SET
LOCAL request.jwt.claims + SET LOCAL ROLE authenticated), every exploit attempt wrapped in
BEGIN/ROLLBACK. No code was run in a browser this round (no UX/UI/browser-based testing — that was
explicitly out of scope per the brief).

## Quality Score

| Dimension | Score | Capped by |
|---|---|---|
| UX | 73/100 | — (unchanged, not re-walked this round) |
| UI | 82/100 | — (unchanged, not re-walked this round) |
| Technical | 58/100 | — (below the HIGH cap of 70; PQ-TECH-001 confirmed unchanged, PQ-TECH-009 new this round) |
| Security | 40/100 | PQ-SEC-008 — CRITICAL, new this round |
| Accessibility | 68/100 | — (unchanged, not re-walked this round) |
| Performance | 76/100 | — (unchanged, not re-walked this round) |
| Maintainability | 70/100 | — (unchanged, not re-walked this round) |
| **Overall** | **40/100** | Any open CRITICAL (PQ-SEC-008) caps OVERALL at 40 app-wide, regardless of the ~66 average of the seven dimension scores |

## Critical Issues
- **PQ-SEC-008 (NEW)** — `kontrolia_auth.membership_roles` has zero trigger on UPDATE. Any plain
  org Admin can, via a single UPDATE (not INSERT, not DELETE), self-promote to Owner (variant A,
  reproducing PQ-SEC-006's outcome through the door 0028's INSERT guard doesn't cover), directly
  demote the sole active Owner (variant B, reproducing the original last-owner-lockout bug 0025-0027
  exist to prevent, with no DELETE involved), or hijack an existing Owner role row outright by
  repointing its membership_id to the attacker's own membership (variant C, simultaneously
  de-roling the victim and escalating the attacker in one statement, with zero audit trail). All
  three live-exploited this round against the running sandbox.
- **PQ-SEC-006** — the literal INSERT-of-owner-role vector is genuinely, independently re-verified
  RESOLVED (narrow) by migration 0028. The broader capability it named (unrestricted self-promotion
  to Owner) is not closed — see PQ-SEC-008 variant A.
- **PQ-SEC-007** — independently re-verified fully RESOLVED. The user_id-reassignment vector is
  genuinely, completely closed by migration 0028's unconditional identity-change guard; no adjacent
  bypass of this specific vector was found this round.

## High Issues
- **PQ-TECH-009 (NEW)** — migration 0028's INSERT guard depends on auth.uid(), which is always NULL
  under the service-role backend path invitation-accept actually uses, so any invitation offering
  the 'owner' role (a combination the shipped invite-role dropdown still allows selecting) now
  always silently fails its role grant on acceptance — compounded by the accept route never
  checking that call's error and marking the invitation accepted regardless. Not a security hole
  (fails closed) but a real, silent functional regression from today's own fix.
- **PQ-TECH-001** — re-confirmed unchanged this round (spot-checked, not the round's primary focus):
  zero test files anywhere under apps/auth-server or apps/admin-panel; the finding's originally-
  scoped core gap (API route handler coverage) remains completely untested. Genuinely still HIGH.

## Medium Issues
Unchanged this round (not in scope) — see `.audit/review/issues.json` for the full, still-current
list (PQ-SEC-002, PQ-UX-008/009/010/011, PQ-A11Y-002–006, PQ-PERF-004–007, PQ-MAINT-001–004,
PQ-TECH-003–008), 25 total (24 carried forward + PQ-TECH-009's severity is HIGH, not counted here).

## MVP Smells
Not walked this round (out of scope, per the brief — this round is a scoped security-family
verification pass, not a full MVP-smell sweep; that was done exhaustively in rounds 2-4).

## Evidence
- `.audit/evidence/2026-08-11/professional-review/migration-0028-live-verification-and-membership-roles-update-bypass.txt`
  — full transcript: live pg_trigger inventory, Part A (PQ-SEC-006/007 independent re-verification,
  8 tests including edge cases for null/invalid role_id, dangling membership_id, and combined-attack
  trigger-order sanity check), Part B (PQ-SEC-008's three exploit variants, 3 tests), Part C
  (PQ-TECH-009's service-role/auth.uid() reproduction, 1 test).

## Required Actions
1. **PQ-SEC-008 (CRITICAL)** — add a single new BEFORE UPDATE trigger on
   `kontrolia_auth.membership_roles` that: (a) requires `is_org_owner()` when `role_id` changes TO
   the 'owner' role (mirrors 0028's INSERT guard), (b) requires >1 remaining active Owner when
   `role_id` changes AWAY FROM 'owner' on the org's last active Owner (mirrors 0025's DELETE guard),
   and (c) blocks any change to `membership_id` outright (mirrors 0028's blanket ban on
   `memberships.user_id` — no shipped flow ever needs it; the app's only role-change code path
   already does DELETE-then-INSERT).
2. **PQ-TECH-009 (HIGH)** — fix the invitation-accept role grant to work under the service-role
   context it actually runs in (e.g. an explicit SECURITY DEFINER RPC parameterized by the
   inviter's proven Owner status, rather than relying on `auth.uid()` inside the trigger), or
   restrict the invite-role dropdown to exclude global system roles from self-service invitation.
   Either way, also check and surface the upsert's `error` instead of marking the invitation
   accepted unconditionally.
3. **PQ-TECH-001 (HIGH, carried forward)** — still no test coverage for any API route handler in
   either app; unchanged since round 4.

## Final Verdict
**NOT PRODUCTION READY.** A newly-found CRITICAL (PQ-SEC-008) fully defeats today's entire
membership_roles protection effort (both migration 0025 and migration 0028) via the one SQL event
neither considered — an open CRITICAL caps the verdict regardless of how much else has genuinely
improved. Security is explicitly NOT fully closed this round, which is a materially different (and
worse) outcome than what today's prior rounds' trajectory suggested; see the closing summary in
the conversational report for the security-closed-vs-gate-passable distinction the round's brief
asked to be kept separate.
