---
"@kontrolia/db": patch
---

Added migration 0035, fixing a CRITICAL regression found live while testing the new applications/claim route: migration 0030's `create or replace` of `custom_access_token_hook` dropped the `is_platform_admin` JWT claim that 0020's version set — `create or replace` replaces the whole function body, and 0030's new body only re-set `organization_id`/`roles`/`permissions`. Every platform-admin-gated route (`/api/platform-admins`, `/api/oauth-clients`, and the new `/api/applications/claim`) has been unusable for any real logged-in user since 0030 shipped earlier today — confirmed by generating a real session for a genuine `platform_admins` row and finding no `is_platform_admin` claim in the resulting JWT at all. Fails closed (no privilege escalation, just a broken feature), but a real, live, previously-undiscovered regression. Restored the missing lookup and `jsonb_set` call.
