---
"@kontrolia/db": patch
---

Added migration 0024: audit-log triggers now cover membership status changes (suspend/reactivate) and invitation revocation/resend, which previously left no audit trail.
