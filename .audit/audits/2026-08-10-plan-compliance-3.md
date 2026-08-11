# Plan Compliance Audit

## Date
2026-08-10T22:15:00

## Auditor
kontrolia-plan-compliance

## Summary
Third audit of this repository today, run after commit `4579870` ("Fix gate re-audit findings:
last-owner suspend lockout and 5 others"), which claimed to fix all four PARTIAL findings from the
second 2026-08-10 audit (REQ-006 invitation resend token rotation + audit gap, REQ-008 audit-trigger
coverage gap, REQ-017 last-owner suspend lockout, REQ-034 unhandled CLI spawn error) plus two smaller
quality items (stale doc comment, missing suspend confirmation). Full re-verification of all 42
requirements was performed. Result: all four targeted fixes are real, correctly implemented, and
close their respective gaps with no half-measures found. No new regression was introduced anywhere
else in the repository. Net result: **42 PASS, 0 PARTIAL, 0 FAIL, 0 BLOCKED, 0 NOT_VERIFIABLE.
Compliance: 100% (up from 90% in the second audit).** Overall result for this run: **PASS**.

This is the first 100%-compliance result across the three audits run today, and it reflects a real,
independently-verified fix cycle, not a claim taken at face value: the last-owner lockout was
re-traced step by step against the new query, the new migration's trigger/function definitions were
read in full and cross-checked against the schema-rename and org-delete-cascade-guard precedents set
by migrations 0020 and 0023, and the token-rotation fix was traced through to the accept route to
confirm the old link genuinely stops working.

## Requirements Audited
All 42 (REQ-001 through REQ-042) re-inspected. REQ-006, REQ-008, REQ-017, REQ-034 received full
Phase 4 depth (fresh code inspection, end-to-end/manual tracing, new evidence, cross-checked against
the exact diff of commit 4579870). The remaining 38 received a targeted regression check: commit
4579870 touched only apps/admin-panel/app/invitations/page.tsx, apps/admin-panel/app/users/page.tsx,
apps/admin-panel/app/users/[membershipId]/page.tsx, apps/admin-panel/lib/supabase-browser.ts
(doc-comment-only change, confirmed no behavior change), apps/auth-server/app/api/organization-members/route.ts,
packages/cli/src/utils/open-browser.ts, and packages/db/migrations/0024_extend_audit_triggers.sql —
none of which any of the other 38 requirements' evidence depends on. Repo-wide build/typecheck/
lint/test all pass, which would surface any accidental breakage from the shared supabase-browser.ts
change.

## PASS
REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011,
REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022,
REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, REQ-033,
REQ-034, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-040, REQ-041, REQ-042 (42 total; see
requirements.json for full evidence per requirement).

- **REQ-006** — moved PARTIAL → PASS. `handleResend` in `apps/admin-panel/app/invitations/page.tsx`
  now generates a fresh 24-byte hex token and writes it alongside the new `expires_at`; the old token
  genuinely stops resolving via `findInvitation()` in the accept route. Revoke and resend are now
  both captured in `audit_logs` via migration 0024.
- **REQ-008** — moved PARTIAL → PASS. Migration `0024_extend_audit_triggers.sql` adds the missing
  `memberships` UPDATE trigger (status changes) and `invitations` DELETE trigger (revoke), and
  extends the existing invitation-accepted trigger to also cover resend. Both new triggers correctly
  reuse the org-delete-cascade guard pattern established in migration 0023.
- **REQ-017** — moved PARTIAL → PASS. `wouldRemoveLastOwner`'s owner-count query in
  `apps/auth-server/app/api/organization-members/route.ts` now filters on `memberships.status='active'`,
  closing the suspend-to-zero-active-owners lockout. Re-traced the exact two-Owner scenario from the
  prior audit and confirmed the second suspend attempt is now correctly blocked. Confirmation dialogs
  before suspend are also now present.
- **REQ-034** — moved PARTIAL → PASS. `openBrowser()` in `packages/cli/src/utils/open-browser.ts`
  now attaches `child.on('error', () => {})`, so a missing browser-opener binary is swallowed instead
  of crashing the CLI process.

## FAIL
None.

## BLOCKED
None.

## NOT_VERIFIABLE
None.

## Evidence
See per-requirement `evidence` arrays in `.audit/plan/requirements.json` (REQ-006, REQ-008, REQ-017,
REQ-034 all have fully updated evidence lists from this run). Headline files/lines re-verified:
- `apps/auth-server/app/api/organization-members/route.ts:107-182` (shared `wouldRemoveLastOwner`,
  now status-filtered; PATCH/DELETE both correctly gated)
- `apps/admin-panel/app/invitations/page.tsx:30-38,124-144` (`randomToken()`, rotated `handleResend`)
- `apps/auth-server/app/api/invitations/accept/route.ts:17-28` (`findInvitation` — confirms rotation
  actually invalidates the old link)
- `packages/db/migrations/0024_extend_audit_triggers.sql` (full file re-read; cross-checked against
  0013, 0020, 0023)
- `apps/admin-panel/app/users/page.tsx:108-113`, `apps/admin-panel/app/users/[membershipId]/page.tsx:91-96`
  (`window.confirm()` before suspend)
- `packages/cli/src/utils/open-browser.ts:12-29` (full file re-read; `child.on('error', ...)` present)
- `apps/admin-panel/lib/supabase-browser.ts:6-17` (doc comment now accurate — describes read+write
  usage)

## Commands Executed
- `pnpm run build` -> PASS -> `.audit/evidence/2026-08-10/build-3.txt`
- `pnpm run typecheck` -> PASS -> `.audit/evidence/2026-08-10/typecheck-3.txt`
- `pnpm run lint` -> PASS (0 errors, 2 pre-existing cosmetic warnings in unrelated files —
  `apps/admin-panel/app/applications/page.tsx` and `apps/admin-panel/app/audit-logs/page.tsx`
  `react-hooks/exhaustive-deps`, unchanged from prior runs, unrelated to commit 4579870) ->
  `.audit/evidence/2026-08-10/lint-3.txt`
- `pnpm run test` -> PASS (only `packages/permissions` has a test script, 5/5 pass) ->
  `.audit/evidence/2026-08-10/tests-3.txt`
- Detection-checklist grep sweep scoped to the files changed by commit 4579870 (TODO/FIXME/HACK,
  empty catch blocks, stale resend callers, duplicate `wouldRemoveLastOwner` definitions) -> no hits
  -> `.audit/evidence/2026-08-10/detection-checklist-sweep-3.txt`
- Manual/static trace of migration 0024's trigger and function definitions against migrations 0006
  (invitations FK), 0013 (original triggers), 0020 (schema-rename mechanics), and 0023
  (org-delete-cascade guard pattern) -> confirmed correct and consistent, documented in
  `.audit/evidence/2026-08-10/detection-checklist-sweep-3.txt`

## Problems Found
None that change any requirement's classification. One purely cosmetic/style observation, not a
functional defect:
1. `packages/db/migrations/0024_extend_audit_triggers.sql:55-57` — the new `audit_invitation_deleted`
   trigger is created with a plain `create trigger`, unlike `audit_membership_change` in the same
   file which is preceded by `drop trigger if exists`. This has no functional effect under the
   current migration runner (`packages/db/src/migrate.ts` tracks applied migrations by filename in a
   `kontrolia_migrations` table and runs each file at most once), so it is not a re-run hazard in
   practice — noted for consistency only, does not affect REQ-008's PASS classification.

## Recommended Actions
1. **Quality (optional, non-blocking)** — For consistency with the rest of the file, add
   `drop trigger if exists audit_invitation_deleted on kontrolia_auth.invitations;` before the
   `create trigger` statement in `packages/db/migrations/0024_extend_audit_triggers.sql`, matching
   the pattern already used for `audit_membership_change` in the same migration. Purely cosmetic
   under the current once-only migration runner — not required.
2. No other outstanding action items from this run. Two pre-existing, previously-noted LOW-priority
   items remain open and unrelated to this run's scope (see `QUALITY_REPORT.md` Outstanding Work):
   near-zero test coverage outside `packages/permissions`, and incomplete Microsoft/TOTP config
   documentation in the social-login guide.

## Final Result
PASS — 100% compliance (42/42 PASS). No requirement is FAIL, PARTIAL, BLOCKED, or NOT_VERIFIABLE.
All four requirements that were PARTIAL in the second audit today (REQ-006, REQ-008, REQ-017,
REQ-034) are now genuinely fixed and verified, and no new regression was introduced by commit
4579870 anywhere else in the 42-requirement scope.
