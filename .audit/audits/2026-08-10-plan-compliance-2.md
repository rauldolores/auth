# Plan Compliance Audit

## Date
2026-08-10T21:00:00

## Auditor
kontrolia-plan-compliance

## Summary
Second audit of this repository today, run after commit `8a05162` ("Implement development quality
gate Phase 1 corrections"), which claimed to fix the three PARTIAL findings from the first
2026-08-10 audit (REQ-006 invitations, REQ-017 admin-panel user management, REQ-034 CLI browser
tabs). Full re-verification of all 42 requirements was performed, not just the three changed ones.
Result: all three targeted fixes are real and substantively close their original gaps, but none
reaches PASS — each re-audit surfaced a new, concrete defect introduced by the fix itself. In
addition, the fix commit introduced a genuine regression in a previously-PASS requirement:
REQ-008 (audit logging) no longer covers the two new mutation types the fix added (membership
suspend/reactivate, invitation revoke/resend). Net result: 38 PASS, 4 PARTIAL, 0 FAIL, 0 BLOCKED,
0 NOT_VERIFIABLE. Compliance: 90% (down from 93% in the first audit, because one requirement
regressed even though the fixes made real progress). Overall result for this run: **PARTIAL**.

## Requirements Audited
All 42 (REQ-001 through REQ-042) re-inspected. REQ-006, REQ-008, REQ-017, REQ-034 received full
Phase 4 depth (fresh code inspection, end-to-end tracing, new evidence). The remaining 38 received
a real spot-check re-open of their cited evidence files plus a specific check for any regression
caused by commit 8a05162's changes to apps/auth-server/app/api/invitations/route.ts,
apps/auth-server/app/api/organization-members/route.ts, and packages/cli/src/index.ts — not a
full from-scratch re-derivation, since those files were untouched by the fix commit.

## PASS
REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-007, REQ-009, REQ-010, REQ-011, REQ-012,
REQ-013, REQ-014, REQ-015, REQ-016, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022, REQ-023,
REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, REQ-033,
REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-040, REQ-041, REQ-042
(38 total; see requirements.json for evidence)

## PARTIAL
- **REQ-006 (Invitations)** — real shareable link + copy + revoke + resend now exist, RLS-gated,
  org-scoped, and revoke genuinely blocks acceptance (verified end-to-end via the accept route).
  Still PARTIAL: resend does not rotate the token (an old leaked link stays valid), and neither
  revoke nor resend is captured by the audit log (see REQ-008).
- **REQ-008 (Audit logging)** — REGRESSED from PASS to PARTIAL. The audit-trigger set was never
  extended to cover the two new mutation types the fix commit introduced: a plain UPDATE to
  `memberships.status` (suspend/reactivate) fires no trigger at all (only INSERT/DELETE are
  covered), and `invitations` has no DELETE trigger and only an accepted_at-scoped UPDATE trigger,
  so revoke and resend are both invisible to the audit trail.
- **REQ-017 (Admin-panel user management)** — suspend/reactivate and a real user-detail page now
  exist, are RLS-gated, and suspension is genuinely enforced downstream (is_org_admin and the
  Custom Access Token Hook both filter on status='active'). Still PARTIAL: the shared
  last-owner-protection helper's owner-count query doesn't filter by membership status, so
  suspending (unlike deleting) doesn't shrink the count — an org can be suspended down to zero
  active Owners, locking out all org-admin-gated management. No confirmation dialog before suspend.
- **REQ-034 (CLI install wizard)** — both URLs now genuinely open as browser tabs after both
  `install` and `deploy`, for local/docker and cloud targets alike, via a real cross-platform
  opener, with URLs always also printed as text. Still PARTIAL: `openBrowser()` has no
  `child.on('error', ...)` handler, so a missing `xdg-open` (realistic on the headless Linux hosts
  this CLI's own docker deploy target is aimed at) becomes an uncaught exception that can crash the
  CLI right after a successful install/deploy — contradicting the function's own "never throws"
  contract.

## FAIL
None.

## BLOCKED
None.

## NOT_VERIFIABLE
None.

## Evidence
See per-requirement `evidence` arrays in `.audit/plan/requirements.json` (all four PARTIAL
requirements have fully updated evidence lists from this run). Headline new files/lines:
- apps/auth-server/app/api/organization-members/route.ts:107-178 (PATCH handler, wouldRemoveLastOwner)
- apps/admin-panel/app/invitations/page.tsx:26-133 (link/copy/revoke/resend)
- apps/admin-panel/app/users/page.tsx:105-127, apps/admin-panel/app/users/[membershipId]/page.tsx
- packages/cli/src/utils/open-browser.ts, packages/cli/src/index.ts:280-289, packages/cli/src/steps/deployment.ts:187-243
- packages/db/migrations/0013_audit_log_triggers.sql:49-51,66-68,85-87 (missing UPDATE/DELETE triggers)
- packages/db/migrations/0007_custom_access_token_hook.sql, 0009_helper_functions.sql,
  0010_rls_policies.sql (confirm real status='active' enforcement)

## Commands Executed
- `pnpm run build` -> PASS -> .audit/evidence/2026-08-10/build-2.txt
- `pnpm run typecheck` -> PASS -> .audit/evidence/2026-08-10/typecheck-2.txt
- `pnpm run lint` -> PASS (0 errors, 2 pre-existing cosmetic warnings, unrelated to this change) -> .audit/evidence/2026-08-10/lint-2.txt
- `pnpm run test` -> PASS (only packages/permissions has a test script, 5/5 pass) -> .audit/evidence/2026-08-10/tests-2.txt
- Detection-checklist grep sweep scoped to the files changed by commit 8a05162, plus the audit-trigger
  migration -> .audit/evidence/2026-08-10/detection-checklist-sweep-2.txt

## Problems Found
1. `packages/cli/src/utils/open-browser.ts:12-24` — missing `child.on('error', ...)` handler; a
   missing `xdg-open`/`open` binary crashes the CLI asynchronously after a successful install.
2. `apps/auth-server/app/api/organization-members/route.ts:107-140` (`wouldRemoveLastOwner`) — owner
   count query not filtered by `status='active'`, allowing an org to be suspended down to zero
   active Owners even though the equivalent DELETE path is correctly protected.
3. `packages/db/migrations/0013_audit_log_triggers.sql` — no UPDATE trigger on `memberships`, no
   DELETE trigger on `invitations`, and the sole invitations UPDATE trigger only matches the
   `accepted_at` transition: three of the new admin actions from this fix (suspend/reactivate,
   revoke, resend) leave zero audit trail.
4. `apps/admin-panel/app/invitations/page.tsx:114-133` (`handleResend`) — does not rotate the
   invitation token, so a previously-shared/leaked link remains valid after "resend."
5. `apps/admin-panel/lib/supabase-browser.ts:6-8` — doc comment claims the browser Supabase client
   is "read-only... no elevated privileges," now stale since the invitations page uses it for
   insert/update/delete.
6. No confirmation dialog before suspending a member in admin-panel (users/page.tsx or the detail
   page) — a meaningful access-removal action fires immediately on click.
7. `apps/auth-server/app/api/invitations/route.ts:33` — the invitation-email TODO(v1.5) is still
   present, now explicitly framed as a documented scope decision (manual link-sharing, no email
   provider configured) rather than a silently-dropped promise — not treated as a fresh problem.

## Recommended Actions
1. **Critical** — Fix `wouldRemoveLastOwner`'s owner-count query in
   `apps/auth-server/app/api/organization-members/route.ts` to filter on `memberships.status='active'`
   so it protects the last *active* Owner, not just the last Owner row, closing the
   suspend-to-zero-owners hole (REQ-017).
2. **Critical** — Add `child.on('error', ...)` to `packages/cli/src/utils/open-browser.ts` so a
   missing browser-opener binary logs a warning and falls back to the already-printed URL text
   instead of crashing the process (REQ-034).
3. **Blocking** — Extend `packages/db/migrations` with a new migration adding: an `AFTER UPDATE`
   trigger on `kontrolia.memberships` (or widen the existing one to `INSERT OR UPDATE OR DELETE`)
   to log status changes, and an `AFTER DELETE` trigger on `kontrolia.invitations` for revocation;
   consider also logging resend (expires_at extension) as a distinct action (REQ-008, REQ-006).
4. **Functional** — Rotate the invitation token on resend in
   `apps/admin-panel/app/invitations/page.tsx` (`handleResend`) so a previously-shared link stops
   working once a new one is issued (REQ-006).
5. **Functional** — Add a confirmation step before suspending a member in both
   `apps/admin-panel/app/users/page.tsx` and `apps/admin-panel/app/users/[membershipId]/page.tsx`
   (REQ-017).
6. **Quality** — Update or remove the stale "read-only, no elevated privileges" comment on
   `apps/admin-panel/lib/supabase-browser.ts:6-8` now that it is used for real writes.

## Final Result
PARTIAL — 90% compliance (38/42 PASS). No requirement reaches FAIL. Four critical requirements
(REQ-006, REQ-008, REQ-017, REQ-034) are PARTIAL, which caps the result below PASS. Real, verified
progress was made on all three originally-targeted gaps, but none fully closed, and the fix
introduced one regression (REQ-008) and two new concrete defects (last-owner bug in REQ-017,
unhandled spawn error in REQ-034) that were not present, or not exercised, before this commit.
