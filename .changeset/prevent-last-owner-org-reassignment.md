---
"@kontrolia/db": patch
---

Added migration 0027: the last-Owner protection trigger on `memberships` now also blocks reassigning the sole active Owner's membership to a different organization, closing a narrower bypass of migration 0026's status-only check.
