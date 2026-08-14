---
"create-kontrolia-auth": patch
---

The install/deploy wizard now offers to capture a Supabase Management API Personal Access Token and save it as `SUPABASE_MANAGEMENT_API_TOKEN` (only offered for Supabase Cloud projects) — without it, admin-panel's new "Inicio de sesión social" screen can only show read-only provider status, not activate Google/Microsoft login live.
