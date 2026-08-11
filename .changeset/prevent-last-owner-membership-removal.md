---
"@kontrolia/db": patch
---

Added migration 0026: two new triggers on `memberships` block deleting or suspending an organization's last active Owner directly, closing the two remaining RLS-only doors to the same lockout migration 0025 partially fixed for `membership_roles`.
