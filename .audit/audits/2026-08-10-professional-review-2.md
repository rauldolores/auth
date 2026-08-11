# Professional Quality Review Audit

## Date
2026-08-10T23:59:00

## Skill
kontrolia-professional-review

## Scope
Whole monorepo: apps/auth-server, apps/admin-panel, apps/documentation; packages/db, cli,
auth-sdk, react-sdk, next-sdk, permissions, shared, ui; examples/nextjs, react, express, nestjs.

Second Phase 2 (professional-quality) run — an independent re-audit of commit `d1bf2cb`
("Fix all 7 CRITICAL and 8 HIGH findings from Phase 2 professional review"), which claimed to
resolve all 15 CRITICAL/HIGH findings from the first run (`.audit/audits/2026-08-10-professional-review.md`).
None of the 15 claims were taken on the commit message's word — each was independently re-verified
against current source, and where possible, against a live running system.

Reachability: **more reachable than the first run.** A local Supabase stack (docker containers,
Postgres on port 54322, Kong/PostgREST on 54321) was found running and fully seeded with real
organizations/memberships. This allowed **live database-level verification** of the security fix
(migration 0025) — exploit attempts run directly against the real Postgres instance inside rolled-back
transactions, not just read from the migration file. Next.js dev servers (auth-server:3000,
admin-panel:3001) were NOT running and were not started for this run — full authenticated UI
click-through (confirmation-dialog clicks, live responsive-viewport screenshots) was not performed;
those areas were verified via rigorous static code reading instead, same limitation as the first run.
This is stated explicitly, not glossed over.

## Quality Score

| Dimension | Score | Capped by |
|---|---|---|
| UX | 70/100 | PQ-UX-007 (HIGH — admin-panel's list-error fix left auth-server's near-identical hook untouched and still silently swallowing failures) |
| UI | 82/100 | — (no CRITICAL/HIGH UI-category finding remains) |
| Technical | 70/100 | PQ-TECH-001, PQ-TECH-002 (HIGH — real test/logging progress, but OAuth-exchange/react-sdk/all-API-routes untested; admin-panel entirely unobserved) |
| Security | 40/100 | PQ-SEC-003, PQ-SEC-004 (CRITICAL — last-owner lockout still live-exploitable via 2 sibling doors migration 0025 didn't cover) |
| Performance | 70/100 | PQ-PERF-001 (HIGH — 3 of 8 unbounded list endpoints fixed; 5 remain fully unbounded) |
| Accessibility | 68/100 | — (no CRITICAL/HIGH remains; PQ-A11Y-001 verified fixed; 6 MEDIUM findings, incl. 1 new) |
| Maintainability | 70/100 | — (MEDIUM only, unchanged from first run) |
| **Overall** | **40/100** | Whole-app CRITICAL cap (averaged dimension score is 67; 2 open CRITICAL security findings cap OVERALL at 40 regardless) |

## Critical Issues

- **PQ-SEC-003** (NEW) — An org Admin can DELETE the sole active Owner's entire `memberships` row
  directly via PostgREST (RLS policy "org admins remove memberships" has no last-owner guard),
  cascading to `membership_roles` — the migration-0025 trigger explicitly no-ops on this cascade
  by design, so the last-owner check never fires. Live-verified exploitable this session.
- **PQ-SEC-004** (NEW) — An org Admin can directly UPDATE `memberships.status` to `'suspended'` for
  the sole active Owner via PostgREST (RLS policy "org admins update memberships" has no last-owner
  guard) — the exact suspend-to-zero-Owners lockout fixed at the API-route layer this same day
  (commit `4579870`), fully reproducible at the DB/RLS layer. Live-verified exploitable this session.
- **PQ-SEC-001** — RESOLVED for its literal, originally-cited vector (`membership_roles` DELETE) —
  live-verified blocked by migration 0025, with the legitimate multi-owner case confirmed to still
  work. Kept on record, not removed: the underlying vulnerability class it was meant to close is
  NOT closed (see PQ-SEC-003/004).
- **PQ-UX-001 through PQ-UX-006** — all 6 RESOLVED. `window.confirm()` verified present on all six
  destructive actions (remove-member, revoke-platform-admin, revoke-invitation, disable-application,
  remove-MFA-factor, revoke-device), each with a specific message naming the affected entity, not a
  generic prompt.

## High Issues

- **PQ-UX-007** — FIXED-but-partial. The 3 admin-panel call sites originally cited now check the
  Supabase error and render a distinct state. `apps/auth-server/lib/use-organizations.ts` — the
  near-identical sibling hook already tracked by PQ-MAINT-004 — was not touched and still silently
  swallows failures, on auth-server's own primary dashboard.
- **PQ-UI-001** — RESOLVED. Hamburger toggle at the `md:` breakpoint confirmed real and functional;
  all 11 admin-panel `<table>` elements confirmed individually wrapped in `overflow-x-auto`. A
  narrower new gap in the toggle's own accessibility is tracked separately (PQ-A11Y-006).
- **PQ-A11Y-001** — RESOLVED. MFA-challenge inputs confirmed wrapped in a `<fieldset>`/`<legend>`
  with per-input `aria-label`.
- **PQ-PERF-001** — FIXED-but-partial. organization-members, invitations, and audit-logs correctly
  paginated (range math and load-more behavior verified with no duplicate/skipped rows). 5 other
  unbounded list surfaces (applications, roles, roles/[roleId], permissions, platform-admins GET)
  were not in scope and remain unbounded.
- **PQ-PERF-002** — RESOLVED. `resolveEmails()` verified to genuinely eliminate the per-row N+1
  call pattern with correct pagination-loop termination. A narrower scaling caveat (full-platform
  rescan per call) is tracked separately (PQ-PERF-006).
- **PQ-PERF-003** — RESOLVED. User-detail page verified to now do a genuine single-row server-side
  lookup.
- **PQ-TECH-001** — FIXED-but-partial. 25 real, substantive tests added (17 auth-sdk + 8 next-sdk,
  all independently re-run and passing) covering JWT verification, PKCE, and the Next.js middleware
  auth-gate. OAuth code exchange, the React SDK's auth state machine, and every API route handler in
  both apps remain completely untested. (Commit message claims "30 new tests" — actual new-test
  count is 25; the other 5 pre-date this commit.)
- **PQ-TECH-002** — FIXED-but-partial. A real structured logger + Next.js 15 instrumentation
  catch-all now covers all 12 of apps/auth-server's API routes. apps/admin-panel has zero
  observability, untouched.

## Medium Issues

21 open — see `.audit/review/issues.json` for full detail. Unchanged from the first run except:
`PQ-UX-008` (raw Postgres error text) gained 3 new instances from the PQ-UX-007 fix itself;
`PQ-TECH-004` (two parallel mutation paths) is now confirmed, via live exploitation of PQ-SEC-003/004,
to be the actual architectural root cause still fully open, not just a theoretical concern;
`PQ-MAINT-004` (duplicate useOrganizations hooks) confirmed to have diverged further, not converged.
Two new MEDIUM findings from this session: `PQ-A11Y-006` (new hamburger toggle missing
aria-expanded/focus management) and `PQ-PERF-006` (resolveEmails scans the full platform user base
on every call).

## MVP Smells

- **Point-fixing a systemic gap, one door at a time, is visibly not keeping up.** In one calendar
  day: the API-route last-owner guard was fixed (commit `4579870`), then a professional review found
  the identical bug reachable via a DB-level door that fix didn't cover (`membership_roles` DELETE),
  then that door was fixed (migration 0025, commit `d1bf2cb`) — and this same-day re-audit found the
  identical bug reachable via two more DB-level doors (`memberships` DELETE, `memberships` UPDATE)
  that migration 0025 didn't cover either. This is the clearest possible evidence that PQ-TECH-004's
  architectural fix (a single application layer that all mutations of this data go through, or a
  genuinely comprehensive DB-level enforcement pass covering every reachable operation on every
  table in the ownership graph) is the actual fix needed, not another point patch.
- **Real, substantive fix effort otherwise.** Unlike a typical "looks fixed but isn't" MVP smell,
  13 of the 15 originally-cited findings are genuine, verified, non-trivial fixes: real confirm()
  dialogs with specific messages, a real paginated API with correct range math, a real N+1 fix with
  correct loop termination, real signature-verification tests against a live JWKS server, a real
  structured logger wired through 12 routes. This is not a rubber-stamp commit.
- **A commit message metric was inflated** (claimed "30 new tests," actual new-test count 25 — the
  other 5 pre-date this commit). Minor, but worth surfacing since the same commit message elsewhere
  makes precise, checkable claims that all held up under verification.
- **A fix for one finding mechanically re-introduced a smaller instance of an already-open one**
  (PQ-UX-007's error-surfacing fix reused PQ-UX-008's raw-error-text pattern in 3 new spots).
- No lorem-ipsum/placeholder copy, no new empty catch blocks, no new stray `console.log`, no new
  dead code found introduced by this commit (confirmed via subagent sweep). `pnpm typecheck`,
  `pnpm lint`, and `pnpm build` all pass cleanly across all 43 changed files.

## Evidence

- `.audit/evidence/2026-08-10/professional-review/sec-001-003-004-live-db-verification.txt` — full
  transcript of 4 live transaction-wrapped tests against the running local Postgres instance.
- `.audit/evidence/2026-08-10/professional-review/confirmation-dialogs-recheck.txt` — grep output
  confirming all 6 confirm() dialogs present with specific messages.
- Per-finding evidence (file:line citations, subagent verification notes) recorded on each issue in
  `.audit/review/issues.json`.
- Command output referenced by subagents this run: `pnpm typecheck` (19/19 tasks pass), `pnpm lint`
  (23/23 tasks pass, 2 pre-existing warnings unrelated to this commit), `pnpm build` (16/16 tasks
  pass), `pnpm test` (30/30 tests pass: 25 new + 5 pre-existing).

## Required Actions

CRITICAL (blocks shipping — same class of bug as before, two new doors):
1. Add a `BEFORE DELETE` trigger on `kontrolia_auth.memberships` enforcing the same active-owner-count
   check as migration 0025, so a direct RLS DELETE of the sole Owner's membership is blocked
   (PQ-SEC-003).
2. Add a `BEFORE UPDATE` trigger (or a tightened RLS `WITH CHECK`) on `kontrolia_auth.memberships`
   blocking a transition away from `status = 'active'` when it would leave zero active Owners
   (PQ-SEC-004).
3. Treat PQ-TECH-004 as the real priority once 1-2 are patched: point-fixing table-by-table has now
   visibly failed to keep pace twice in one day. Consider either routing ALL org-membership/role
   mutations through the Next.js API layer (revoking direct RLS write access to
   `memberships`/`membership_roles` for non-service-role callers) or a single comprehensive DB-level
   audit of every operation reachable on every table in the ownership graph, rather than another
   incremental trigger.

HIGH:
4. Extend PQ-TECH-002's logger/instrumentation pattern to apps/admin-panel.
5. Extend PQ-TECH-001's test suite to OAuth code exchange (`packages/auth-sdk/src/client.ts`) and
   the React SDK's auth state machine (`packages/react-sdk`) at minimum.
6. Paginate the 5 remaining unbounded list endpoints (applications, roles, roles/[roleId],
   permissions, platform-admins GET) using the same pattern already proven on organization-members/
   invitations/audit-logs (PQ-PERF-001).
7. Fix `apps/auth-server/lib/use-organizations.ts` to check and surface fetch errors, matching the
   fix already applied to its admin-panel sibling (PQ-UX-007).

MEDIUM: see `.audit/review/issues.json` for the full list of 21 — recommended next priority after
CRITICAL/HIGH is still PQ-TECH-004 (see Required Action 3), plus translating the now-more-widespread
raw-Postgres-error pattern (PQ-UX-008) into user-facing copy.

## Final Verdict

**NOT PRODUCTION READY**

Two CRITICAL findings are open: an org Admin can still lock an organization out of Owner-level
access by directly deleting or suspending the sole Owner's `memberships` row via PostgREST — the
exact vulnerability class the same-day API-layer fix (commit `4579870`) and DB-layer fix (migration
0025, commit `d1bf2cb`) were both meant to close, reachable through two doors neither fix covers.
Per this skill's own rubric, any open CRITICAL caps the verdict at NOT PRODUCTION READY regardless of
the numeric average (67 across the 7 dimensions before the cap) — "everything's fixed except the org
can still be locked out of its own admin access" is not a shippable state, even though this run
found genuine, substantial, independently-verified progress on 13 of the 15 originally-cited
findings (all 6 CRITICAL UX-confirmation gaps, both remaining UI/A11Y HIGH findings, and 2 of 3 HIGH
performance findings are now VERIFIED resolved).
