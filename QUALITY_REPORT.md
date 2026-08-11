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
2026-08-10T21:00:00

## Overall Status
PARTIAL

## Overall Compliance
90%

---

# 1. Plan Compliance

## Summary

| Status | Count |
|--------|-------|
| PASS | 38 |
| PARTIAL | 4 |
| FAIL | 0 |
| BLOCKED | 0 |
| NOT_VERIFIABLE | 0 |

_(Previous run 2026-08-10T00:00:00: 39 PASS / 3 PARTIAL / 93%. This run re-verified all 42
requirements after fix commit `8a05162`. Net change: REQ-006, REQ-017, REQ-034 all made real
progress but remain PARTIAL for new reasons; REQ-008 regressed from PASS to PARTIAL. See
Audit History and `.audit/audits/2026-08-10-plan-compliance-2.md` for full detail.)_

## Requirements

| ID | Requirement | Status | Evidence | Verification |
|----|-------------|--------|----------|--------------|
| REQ-001 | Email/password registration, login, recovery, verification | PASS | apps/auth-server/app/(auth)/*, packages/auth-sdk/src/client.ts:78-142 | static inspection |
| REQ-002 | Org creation auto-enrolls creator as Owner | PASS | apps/auth-server/app/api/organizations/route.ts:53-56; migration 0011 | static inspection |
| REQ-003 | OAuth 2.1 + PKCE flow end-to-end (/oauth/consent) | PASS | auth-sdk client.ts:256-352; auth-server oauth/consent, api/oauth-clients | static inspection; cross-checked vs commits be58f93/244fc78/f6d39ef |
| REQ-004 | Social login (Google + Microsoft), config-driven | PASS | auth-sdk client.ts:104-110; login/page.tsx:51; .env.example:33-36 | static inspection |
| REQ-005 | MFA (TOTP) enrollment + login challenge | PASS | app/security/page.tsx; app/mfa-challenge/page.tsx; client.ts:360-416 | static inspection |
| REQ-006 | Invitations (create/accept/expire/revoke/resend) | PARTIAL | admin-panel invitations/page.tsx:26-133 (real link/copy/revoke/resend, RLS-gated); resend doesn't rotate token; revoke/resend not audit-logged | static inspection; manual trace revoke->accept returns 404 |
| REQ-007 | Session/device listing + revocation | PASS | api/devices/*; migration 0012:17-34 | static inspection |
| REQ-008 | Audit logging (DB-trigger only, not bypassable) | PARTIAL | migration 0013:49-51,66-68,85-87 — no UPDATE trigger on memberships, no DELETE trigger on invitations; new suspend/revoke/resend actions leave no audit trail | static inspection + grep sweep of trigger definitions |
| REQ-009 | Platform admin (DB-backed, bootstrapped, JWT claim) | PASS | migrations 0016, 0017; api/oauth-clients, api/platform-admins | static inspection |
| REQ-010 | POST /api/applications/sync Bearer-key validation | PASS | api/applications/sync/route.ts:25-30,74-76 | static inspection |
| REQ-011 | App-scoped custom roles | PASS | migration 0019:52-194; admin-panel roles/page.tsx:95-131 | static inspection |
| REQ-012 | Custom Access Token Hook claims | PASS | migrations 0007, 0016, 0020 | static inspection |
| REQ-013 | RLS enforces documented access model | PASS | migrations 0009, 0010, 0018, 0019, 0021, 0023; new PATCH endpoint rides pre-existing "org admins update memberships" policy | static inspection of all 23 migrations |
| REQ-014 | Org rename/delete reachable via real UI | PASS | auth-server app/page.tsx:93-215; api/organizations/[id]/route.ts | static inspection |
| REQ-015 | Cross-domain OAuth 2.1 SSO for third-party apps | PASS | auth-sdk client.ts:256-297; admin-panel oauth/callback | static inspection |
| REQ-016 | App permission-catalog registration distinct from OAuth client registration | PASS | db/src/register-application.ts; api/applications/sync | static inspection |
| REQ-017 | Admin-panel user management (list/remove/suspend/reactivate/detail) | PARTIAL | organization-members/route.ts:142-178 (real PATCH, real enforcement via status='active' checks); wouldRemoveLastOwner not status-filtered, can suspend org to zero active Owners | static inspection; manual trace of suspend-two-owners scenario |
| REQ-018 | Admin-panel role management | PASS | admin-panel roles/page.tsx:95-131 | static inspection |
| REQ-019 | Admin-panel permission assignment | PASS | admin-panel roles/[roleId]/page.tsx:108-137; migration 0019:76-83 | static inspection |
| REQ-020 | Admin-panel authenticates via OAuth2.1/SDK (dogfooding) | PASS | admin-panel providers.tsx, dashboard-shell.tsx, oauth/callback | static inspection |
| REQ-021 | Admin-panel mutations enforced server-side | PASS | cross-referenced 5+ mutation paths vs migrations, including new PATCH/revoke/resend | static inspection |
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
| REQ-034 | CLI install wizard (incl. opens 2 browser tabs) | PARTIAL | open-browser.ts real cross-platform opener, wired into install+deploy; missing child.on('error'), can crash CLI if xdg-open absent | static inspection; grep for uncaughtException handler (none found) |
| REQ-035 | CLI `update` | PASS | packages/cli/src/index.ts:111-151; utils/update.ts:14-83 | static inspection |
| REQ-036 | CLI `deploy` | PASS | packages/cli/src/index.ts:164-217 | static inspection |
| REQ-037 | CLI `migrate` | PASS | packages/cli/src/index.ts:30-44 | static inspection |
| REQ-038 | CLI `grant-admin <email>` | PASS | packages/cli/src/index.ts:58-94; db/src/grant-platform-admin.ts:24-50 | static inspection |
| REQ-039 | CLI `doctor` (read-only) | PASS | packages/cli/src/index.ts:97-102; utils/preflight.ts:24-70 | static inspection |
| REQ-040 | CLI cross-domain session-sharing auto-config | PASS | packages/cli/src/steps/deployment.ts:239-282; utils/oauth-client.ts:21-40 | static inspection |
| REQ-041 | CLI https:// deploy-URL validation | PASS | packages/cli/src/steps/deployment.ts:19-26,219,232 | static inspection; vs commit bc01e03 |
| REQ-042 | Monorepo build/typecheck/lint/test green | PASS | see Verification Results below | pnpm run build/typecheck/lint/test |

## Critical Gaps

None reach FAIL severity. Four critical requirements are PARTIAL:

- **REQ-017** — `wouldRemoveLastOwner`'s owner-count query (`apps/auth-server/app/api/organization-members/route.ts:132-137`)
  is not filtered by `status='active'`, so it can be used to suspend an organization down to zero
  active Owners (locking out all org-admin-gated management) even though the equivalent DELETE
  path correctly refuses to remove the last Owner. This is the most severe finding this run —
  a real access-lockout bug in newly-shipped code, not merely a missing feature.
- **REQ-008** — audit-log triggers do not cover the two new mutation types (`memberships` UPDATE,
  `invitations` DELETE) the fix commit introduced, so suspend/reactivate and revoke leave zero
  audit trail — undercutting this requirement's own "cannot be bypassed or faked" premise for
  these specific new actions.
- **REQ-006**, **REQ-034** — see Partial Implementations below; both are real, working
  implementations with one concrete residual defect each, not broken/faked features.

## Missing Requirements

None found entirely unimplemented (FAIL with zero evidence). All 42 requirements have at
least a real, working partial-or-better implementation.

## Partial Implementations

- **REQ-006 (Invitations)** — a real shareable invitation link with copy/revoke/resend now exists
  in `apps/admin-panel/app/invitations/page.tsx`, is RLS-gated and org-scoped, and revoke genuinely
  blocks acceptance (verified end-to-end). Still partial: resend does not rotate the token (a
  previously-leaked link stays valid), and neither revoke nor resend is captured by the audit log.
  The email-send TODO (`apps/auth-server/app/api/invitations/route.ts:33`) is now an explicit,
  documented scope decision (no email provider configured; manual link-sharing instead), not a
  silently-dropped promise.
- **REQ-008 (Audit logging)** — REGRESSED this run. `packages/db/migrations/0013_audit_log_triggers.sql`
  triggers were written for the original insert/delete/accept lifecycle and were never extended to
  cover the fix commit's new mutation types: a plain `UPDATE` to `memberships.status`
  (suspend/reactivate) fires nothing, and `invitations` has no `DELETE` trigger and only an
  `accepted_at`-scoped `UPDATE` trigger (so resend is also silent).
- **REQ-017 (Admin-panel user management)** — suspend/reactivate now exists
  (`apps/auth-server/app/api/organization-members/route.ts` PATCH) and is genuinely enforced
  downstream (`is_org_admin` and the Custom Access Token Hook both filter on `status='active'`,
  so a suspended member truly loses access). A real user-detail page exists at
  `apps/admin-panel/app/users/[membershipId]/page.tsx`. Still partial: the shared last-owner
  protection has a status-filtering bug (see Critical Gaps) and there's no confirmation dialog
  before suspending someone.
- **REQ-034 (CLI install wizard)** — both URLs now genuinely open as browser tabs after both
  `install` and `deploy`, for local/docker and cloud targets, via a real cross-platform opener
  (`packages/cli/src/utils/open-browser.ts`), with URLs always also printed as text. Still
  partial: no `child.on('error', ...)` handler, so a missing `xdg-open` binary (realistic on the
  headless Linux hosts this CLI's own docker deploy target is aimed at) can crash the CLI process
  right after a successful install/deploy.

---

# 2. Professional Quality

<!-- OWNED BY kontrolia-professional-review. kontrolia-plan-compliance must
     never write into this section beyond the initial NOT AUDITED seed. -->

NOT AUDITED

- Overall Score: —
- UX Score: —
- UI Score: —
- Technical Score: —
- Security Score: —
- Accessibility Score: —
- Performance Score: —
- Maintainability Score: —
- Critical Issues: —
- High Issues: —
- Medium Issues: —
- Polish Opportunities: —

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
| MEDIUM | REQ-006 | Invitation emails are never sent (TODO v1.5); no revoke/resend UI | Plan Compliance | FIXED (2026-08-10, commit 8a05162) — link/copy/revoke/resend now real; remaining gap: resend doesn't rotate token, revoke/resend not audit-logged (see new row below) |
| MEDIUM | REQ-017 | No member suspend/deactivate action; no user-detail page in admin-panel | Plan Compliance | FIXED (2026-08-10, commit 8a05162) — suspend/reactivate + detail page now real and enforced; remaining gap: last-owner bug (see new row below) |
| LOW | REQ-034 | CLI install wizard never opens the two promised browser tabs at completion | Plan Compliance | FIXED (2026-08-10, commit 8a05162) — both tabs now open on install+deploy; remaining gap: unhandled spawn error (see new row below) |
| LOW | — | Test coverage is ~0% outside packages/permissions; JWT/OAuth/PKCE security logic has no automated tests | Plan Compliance | OPEN |
| LOW | — | social-login doc guide only covers Google in prose; Microsoft/TOTP config undocumented (code for both is real) | Plan Compliance | OPEN |
| CRITICAL | REQ-017 | `wouldRemoveLastOwner` owner-count query not filtered by `status='active'` — suspend can be used to lock an org out of all admin management (zero active Owners) | Plan Compliance | OPEN |
| CRITICAL | REQ-034 | `openBrowser()` has no `child.on('error', ...)` — missing `xdg-open` on headless Linux can crash the CLI right after a successful install/deploy | Plan Compliance | OPEN |
| HIGH | REQ-008 | Audit-log triggers (migration 0013) don't cover `memberships` UPDATE (suspend/reactivate) or `invitations` DELETE (revoke) — these new admin actions leave no audit trail | Plan Compliance | OPEN |
| MEDIUM | REQ-006 | Invitation resend does not rotate the token — a previously-shared/leaked link stays valid after resend | Plan Compliance | OPEN |
| LOW | REQ-017 | No confirmation dialog before suspending a member in admin-panel | Plan Compliance | OPEN |
| LOW | — | `apps/admin-panel/lib/supabase-browser.ts:6-8` doc comment claims the browser Supabase client is "read-only, no elevated privileges" — stale now that invitations page uses it for writes | Plan Compliance | OPEN |

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
- CLI browser auto-open: now real — `packages/cli/src/utils/open-browser.ts` (cross-platform
  spawn-based opener), wired at `packages/cli/src/index.ts:280-289` (install) and `:217-222` (deploy).
  Missing `child.on('error', ...)` — can crash on a headless host with no `xdg-open`.
- Organization-members suspend/reactivate: `apps/auth-server/app/api/organization-members/route.ts:142-178`
  (PATCH), real enforcement via `is_org_admin`/Custom Access Token Hook filtering on `status='active'`
  (`packages/db/migrations/0007_custom_access_token_hook.sql`, `0009_helper_functions.sql`). Last-owner
  bug in the shared `wouldRemoveLastOwner` helper: `apps/auth-server/app/api/organization-members/route.ts:107-140`
  (owner-count query not status-filtered).
- Audit-log trigger coverage gap (new, affects REQ-008): `packages/db/migrations/0013_audit_log_triggers.sql:49-51`
  (`memberships` trigger is INSERT/DELETE only, no UPDATE) and `:66-68,85-87` (`invitations` has no
  DELETE trigger; sole UPDATE trigger only matches the `accepted_at` transition).
- Verification command output (first run): `.audit/evidence/2026-08-10/{build,typecheck,lint,tests,detection-checklist-sweep}.txt`.
- Verification command output (re-audit): `.audit/evidence/2026-08-10/{build,typecheck,lint,tests,detection-checklist-sweep}-2.txt`.
- Full requirement definitions, evidence, and history: `.audit/plan/requirements.json`.
