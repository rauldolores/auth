---
"create-kontrolia-auth": patch
---

`migrate` and `update` now ask for confirmation before applying migrations to a connection string that doesn't look like a local database, so a pasted-in-error production connection string doesn't get migrated silently.
