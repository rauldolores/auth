---
"@kontrolia/db": patch
---

Added migration 0032, closing the integration-surface audit's one HIGH finding (INT-KEY-001): the application sync API key had no rotation, no revocation, no "last used" tracking, and no admin-panel UI — a leak was both undetectable and recoverable only by destructively re-registering the whole application. Also found while implementing the fix and closed at the same time: `api_key_hash` was readable by any authenticated user for any application (RLS is row-level only, and the existing "browse the application catalog" policy makes every row visible) — now column-level ACL restricted to `service_role`. Rotation/revocation are now logged to `audit_logs` via a trigger, the same way every other security-relevant event in this schema is.
