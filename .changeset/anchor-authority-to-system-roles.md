---
"@kontrolia/db": patch
---

Added migration 0030, closing the real root cause behind the day's whole last-owner-protection effort: every authority check (`is_org_owner()`, `is_org_admin()`, the JWT's `roles` claim, and every "how many active Owners remain" counting query added in migrations 0025-0029) trusted `roles.slug = 'owner'` alone. Since `kontrolia_auth.roles` had no trigger and its RLS policies never inspected `slug`, any org Admin could create an ordinary custom role, grant it to themselves, and relabel its slug to `'owner'` — becoming recognized as Owner by every check in the system, and inflating the "active Owners" count enough to let the real Owner be removed. All authority checks and counting queries now additionally require `is_system_role = true` (a flag no RLS-writable path can ever set), and a new trigger blocks any non-system role from ever taking a reserved slug (`owner`/`admin`/`member`) as defense in depth.
