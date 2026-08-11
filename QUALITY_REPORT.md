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
2026-08-10T00:00:00

## Overall Status
PARTIAL

## Overall Compliance
93%

---

# 1. Plan Compliance

## Summary

| Status | Count |
|--------|-------|
| PASS | 39 |
| PARTIAL | 3 |
| FAIL | 0 |
| BLOCKED | 0 |
| NOT_VERIFIABLE | 0 |

## Requirements

| ID | Requirement | Status | Evidence | Verification |
|----|-------------|--------|----------|--------------|
| REQ-001 | Email/password registration, login, recovery, verification | PASS | apps/auth-server/app/(auth)/*, packages/auth-sdk/src/client.ts:78-142 | static inspection |
| REQ-002 | Org creation auto-enrolls creator as Owner | PASS | apps/auth-server/app/api/organizations/route.ts:53-56; migration 0011 | static inspection |
| REQ-003 | OAuth 2.1 + PKCE flow end-to-end (/oauth/consent) | PASS | auth-sdk client.ts:256-352; auth-server oauth/consent, api/oauth-clients | static inspection; cross-checked vs commits be58f93/244fc78/f6d39ef |
| REQ-004 | Social login (Google + Microsoft), config-driven | PASS | auth-sdk client.ts:104-110; login/page.tsx:51; .env.example:33-36 | static inspection |
| REQ-005 | MFA (TOTP) enrollment + login challenge | PASS | app/security/page.tsx; app/mfa-challenge/page.tsx; client.ts:360-416 | static inspection |
| REQ-006 | Invitations (create/accept/expire) | PARTIAL | admin-panel invitations/page.tsx; api/invitations/route.ts:28 TODO; api/invitations/accept | static inspection; grep for revoke/resend |
| REQ-007 | Session/device listing + revocation | PASS | api/devices/*; migration 0012:17-34 | static inspection |
| REQ-008 | Audit logging (DB-trigger only, not bypassable) | PASS | migration 0013; 0010:102-103; admin-panel audit-logs/page.tsx:33-44 | static inspection |
| REQ-009 | Platform admin (DB-backed, bootstrapped, JWT claim) | PASS | migrations 0016, 0017; api/oauth-clients, api/platform-admins | static inspection |
| REQ-010 | POST /api/applications/sync Bearer-key validation | PASS | api/applications/sync/route.ts:25-30,74-76 | static inspection |
| REQ-011 | App-scoped custom roles | PASS | migration 0019:52-194; admin-panel roles/page.tsx:95-131 | static inspection |
| REQ-012 | Custom Access Token Hook claims | PASS | migrations 0007, 0016, 0020 | static inspection |
| REQ-013 | RLS enforces documented access model | PASS | migrations 0009, 0010, 0018, 0019, 0021, 0023 | static inspection of all 23 migrations |
| REQ-014 | Org rename/delete reachable via real UI | PASS | auth-server app/page.tsx:93-215; api/organizations/[id]/route.ts | static inspection |
| REQ-015 | Cross-domain OAuth 2.1 SSO for third-party apps | PASS | auth-sdk client.ts:256-297; admin-panel oauth/callback | static inspection |
| REQ-016 | App permission-catalog registration distinct from OAuth client registration | PASS | db/src/register-application.ts; api/applications/sync | static inspection |
| REQ-017 | Admin-panel user management | PARTIAL | admin-panel users/page.tsx:44-102, 220-248; migration 0005:5 (unused status) | static inspection |
| REQ-018 | Admin-panel role management | PASS | admin-panel roles/page.tsx:95-131 | static inspection |
| REQ-019 | Admin-panel permission assignment | PASS | admin-panel roles/[roleId]/page.tsx:108-137; migration 0019:76-83 | static inspection |
| REQ-020 | Admin-panel authenticates via OAuth2.1/SDK (dogfooding) | PASS | admin-panel providers.tsx, dashboard-shell.tsx, oauth/callback | static inspection |
| REQ-021 | Admin-panel mutations enforced server-side | PASS | cross-referenced 5+ mutation paths vs migrations | static inspection |
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
| REQ-034 | CLI install wizard | PARTIAL | packages/cli/src/index.ts:220-280; no browser-open call anywhere | static inspection; grep for open/start/xdg-open |
| REQ-035 | CLI `update` | PASS | packages/cli/src/index.ts:111-151; utils/update.ts:14-83 | static inspection |
| REQ-036 | CLI `deploy` | PASS | packages/cli/src/index.ts:164-217 | static inspection |
| REQ-037 | CLI `migrate` | PASS | packages/cli/src/index.ts:30-44 | static inspection |
| REQ-038 | CLI `grant-admin <email>` | PASS | packages/cli/src/index.ts:58-94; db/src/grant-platform-admin.ts:24-50 | static inspection |
| REQ-039 | CLI `doctor` (read-only) | PASS | packages/cli/src/index.ts:97-102; utils/preflight.ts:24-70 | static inspection |
| REQ-040 | CLI cross-domain session-sharing auto-config | PASS | packages/cli/src/steps/deployment.ts:239-282; utils/oauth-client.ts:21-40 | static inspection |
| REQ-041 | CLI https:// deploy-URL validation | PASS | packages/cli/src/steps/deployment.ts:19-26,219,232 | static inspection; vs commit bc01e03 |
| REQ-042 | Monorepo build/typecheck/lint/test green | PASS | see Verification Results below | pnpm run build/typecheck/lint/test |

## Critical Gaps

None reach FAIL severity. Three critical requirements are PARTIAL (see below) — real,
working core functionality with a specific missing piece each, not broken/faked features.

## Missing Requirements

None found entirely unimplemented (FAIL with zero evidence). All 42 requirements have at
least a real, working partial-or-better implementation.

## Partial Implementations

- **REQ-006 (Invitations)** — create/accept/expire flow is real and RLS-backed; invitation
  email is never sent (`apps/auth-server/app/api/invitations/route.ts:28`, acknowledged
  TODO); no revoke/resend UI anywhere in admin-panel.
- **REQ-017 (Admin-panel user management)** — list/remove work end to end against real
  RLS; no suspend/deactivate action despite `memberships.status` supporting `'suspended'`;
  no dedicated user-detail page.
- **REQ-034 (CLI install wizard)** — every documented step works except the promised
  "opens two browser tabs on completion," which is not implemented anywhere in
  `packages/cli`.

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
| MEDIUM | REQ-006 | Invitation emails are never sent (TODO v1.5); no revoke/resend UI | Plan Compliance | OPEN |
| MEDIUM | REQ-017 | No member suspend/deactivate action; no user-detail page in admin-panel | Plan Compliance | OPEN |
| LOW | REQ-034 | CLI install wizard never opens the two promised browser tabs at completion | Plan Compliance | OPEN |
| LOW | — | Test coverage is ~0% outside packages/permissions; JWT/OAuth/PKCE security logic has no automated tests | Plan Compliance | OPEN |
| LOW | — | social-login doc guide only covers Google in prose; Microsoft/TOTP config undocumented (code for both is real) | Plan Compliance | OPEN |

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
- Invitation-email gap: `apps/auth-server/app/api/invitations/route.ts:28`.
- CLI install wizard missing browser auto-open: `packages/cli/src/index.ts:220-280` (no `open`/`start`/`xdg-open` call anywhere in `packages/cli`).
- Verification command output: `.audit/evidence/2026-08-10/{build,typecheck,lint,tests,detection-checklist-sweep}.txt`.
- Full requirement definitions, evidence, and history: `.audit/plan/requirements.json`.
