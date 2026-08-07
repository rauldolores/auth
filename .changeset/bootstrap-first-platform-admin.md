---
"@kontrolia/db": minor
---

The very first user to sign up on a fresh installation is now automatically granted platform-admin status (migration `0017_bootstrap_first_platform_admin.sql`) — closing the bootstrapping gap where granting the very first platform admin required direct database access, something a non-technical operator running `npx create-kontrolia-auth` shouldn't have to do. Guarded so it only ever fires once, on a genuinely fresh install (checks `auth.users` count, not just whether `kontrolia.platform_admins` happens to be empty) — revoking the sole platform admin later never silently hands the role to the next random signup.
