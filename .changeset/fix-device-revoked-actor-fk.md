---
"@kontrolia/db": patch
---

Fix `delete from auth.users` failing with a foreign key violation on `audit_logs_actor_user_id_fkey` for any user that has device/session rows. The `log_device_revoked` audit trigger no longer falls back to the just-deleted user as the log's actor when the deletion cascades from `auth.users`.
