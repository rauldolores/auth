---
"@kontrolia/db": patch
---

Added migration 0029: `membership_roles` had no trigger on UPDATE at all, letting a plain org Admin self-promote to Owner, demote the sole active Owner, or hijack an existing Owner role row via a single UPDATE statement — bypassing every DELETE/INSERT guard added earlier today. Also fixes a regression from the previous migration: granting the Owner role via a legitimate invitation-accept (which runs under a service-role connection with no `auth.uid()`) now works correctly again, using `auth.role()` instead of `current_user` to detect that trust boundary from inside a `SECURITY DEFINER` trigger.
