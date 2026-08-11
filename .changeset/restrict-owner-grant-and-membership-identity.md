---
"@kontrolia/db": patch
---

Added migration 0028, closing two CRITICAL authorization gaps found via live exploit testing: any org Admin could grant themselves the Owner role directly (now requires an existing Owner), and any org Admin could silently reassign an existing membership's `user_id` to hijack another user's org access (now blocked entirely — no legitimate flow ever needs to do this).
