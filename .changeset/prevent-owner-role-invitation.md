---
"@kontrolia/db": patch
---

Added migration 0033: an invitation can no longer carry the Owner role. Found while designing the new external `/api/applications/members` API — invitation-accept grants an invitation's `role_id` through a service-role client, and `prevent_admin_granting_owner_role`'s own service-role bypass (0028, needed for org bootstrap) meant it never checked whether that role was Owner. An org Admin could create an owner-role invitation (nothing inspected `role_id` at creation) and accepting it would silently grant Owner with no `is_org_owner()` check — a reachable bypass of every owner-grant protection built in 0025-0031, through a channel none of them touch. Rather than teach the bootstrap-exempt accept flow to tell a legitimate grant apart from this, the capability is removed at its source: invitations can never reference the Owner role.
