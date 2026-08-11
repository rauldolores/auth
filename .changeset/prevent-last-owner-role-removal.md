---
"@kontrolia/db": patch
---

Added migration 0025: a DB-level trigger now blocks deleting the organization's last active Owner's role assignment directly, closing a gap where the API-layer last-owner protection (added in a previous release) could be bypassed by deleting the `membership_roles` row directly.
