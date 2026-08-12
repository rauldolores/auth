---
"@kontrolia/db": patch
---

Added migration 0034, closing INT-API-007/INT-API-008/PQ-TECH-010: `applications.owner_organization_id` was never written by any code path in the repo, making the admin-panel rotate/revoke API-key UI, migration 0022's owning-org UPDATE policy, and the `/api/applications/members` API all unreachable for any application registered the intended way. The actual fix is a new platform-admin-gated `POST /api/applications/claim` route on auth-server; this migration adds the database side — audit logging for `application.ownership_claimed`/`application.ownership_transferred`, and a guard closing a related gap found while designing it: migration 0022's UPDATE policy let a dual-org admin silently reassign an already-owned application to their other organization (same shape as this session's earlier PQ-SEC-005). Once set, `owner_organization_id` can now only change via `service_role`.
