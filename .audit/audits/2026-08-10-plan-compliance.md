# Plan Compliance Audit

## Date
2026-08-10T00:00:00

## Auditor
kontrolia-plan-compliance

## Summary
First-ever audit of this repository. Scope: entire KontrolIA Auth monorepo (apps/auth-server,
apps/admin-panel, apps/documentation; packages/db, cli, auth-sdk, react-sdk, next-sdk,
permissions, shared, ui; examples/nextjs, react, express, nestjs), audited against README.md,
all 13 documentation pages, and all 23 SQL migrations as the authoritative spec (no single
PLAN.md exists). 42 requirements identified. 39 PASS, 3 PARTIAL, 0 FAIL, 0 BLOCKED,
0 NOT_VERIFIABLE. Compliance: 93%. Overall result for this run: **PARTIAL** (three critical
requirements are PARTIAL, none are FAIL or severely broken).

## Requirements Audited
All 42: REQ-001 through REQ-042 (full initial decomposition; see .audit/plan/requirements.json).

## PASS
REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011,
REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022,
REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032,
REQ-033, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-040, REQ-041, REQ-042
(see requirements.json for one-line evidence per ID)

## PARTIAL
- REQ-006 (Invitations) -- core create/accept/expire flow real and RLS-backed; invitation
  email is never actually sent (acknowledged TODO in code); no revoke/resend UI anywhere.
- REQ-017 (Admin-panel user management) -- list/remove work end to end; no
  suspend/deactivate action despite schema supporting it; no user-detail page.
- REQ-034 (CLI install wizard) -- every step works except the promised "opens two browser
  tabs on completion," which is not implemented anywhere in packages/cli.

## FAIL
None.

## BLOCKED
None.

## NOT_VERIFIABLE
None.

## Evidence
Consolidated (deduplicated) file/function/endpoint/table pointers referenced across all
requirements -- see the `evidence` array of each requirement in
.audit/plan/requirements.json for the full per-requirement list. Headline files:
- packages/db/migrations/0001-0023 (full schema/RLS/trigger authority)
- packages/auth-sdk/src/{client,server,jwt,pkce}.ts
- packages/react-sdk/src/{context,guards,use-auth}.tsx
- packages/next-sdk/src/middleware.ts
- packages/permissions/src/{match,checker}.ts + __tests__/match.test.ts
- packages/cli/src/{index.ts,steps/*,utils/*}
- apps/auth-server/app/{(auth)/*, api/*, oauth/*, security, mfa-challenge, page.tsx}
- apps/admin-panel/app/{users,roles,permissions,invitations,audit-logs,organizations,
  oauth-clients,platform-admins}/page.tsx

## Commands Executed
- pnpm run build   -> PASS -> .audit/evidence/2026-08-10/build.txt
- pnpm run typecheck -> PASS -> .audit/evidence/2026-08-10/typecheck.txt
- pnpm run lint    -> PASS (0 errors, 2 cosmetic warnings) -> .audit/evidence/2026-08-10/lint.txt
- pnpm run test    -> PASS (only 1/17 packages has a test script) -> .audit/evidence/2026-08-10/tests.txt
- Detection-checklist grep sweep (TODO/FIXME/mock/hardcoded/placeholder/empty-catch/disabled-tests)
  -> .audit/evidence/2026-08-10/detection-checklist-sweep.txt

## Problems Found
1. apps/auth-server/app/api/invitations/route.ts:28 -- invitation email never sent (TODO v1.5).
2. No invitation revoke/resend capability anywhere in admin-panel.
3. No member-suspend action in admin-panel despite `memberships.status` supporting 'suspended'.
4. No user-detail page in admin-panel (inline row expansion only).
5. CLI install wizard never opens the two promised browser tabs at completion.
6. Test coverage is effectively zero outside packages/permissions -- the security-critical
   JWT verification (packages/auth-sdk/src/server.ts) and OAuth/PKCE logic have no automated
   tests. Not graded as its own requirement (no plan source promises test coverage), but
   flagged as the single most important quality risk found.
7. Documentation completeness gap (not a code gap): FAQ claims TOTP + Google/Microsoft social
   login are "ready to use," but guides/social-login/page.tsx documents only Google
   configuration in prose; Microsoft and TOTP setup steps are undocumented even though the
   code for both is real and working.
8. admin-panel's own Organizations page is read-only (no rename/delete) -- the real
   capability exists but lives in auth-server's home screen instead; not a gap, but worth
   noting for anyone looking for it in admin-panel specifically.

## Recommended Actions
See the full conversational report's "Recommended Fixes" section (same content, ordered by
severity) delivered to the user in this session.

## Final Result
PARTIAL -- 93% compliance (39/42 PASS). No critical requirement is FAIL; three critical
requirements (REQ-006, REQ-017, REQ-034) are PARTIAL, which caps the result below PASS per
the skill's own rule that a failing/partial critical requirement prevents an overall PASS.
