---
"@kontrolia/db": patch
---

`migrate()`'s own bookkeeping table (`kontrolia_migrations`) now lives in `kontrolia_auth` instead of `public` by omission — self-healing: an install that already has it in `public` gets it relocated automatically (idempotently) the next time `migrate()` runs, once `kontrolia_auth` exists. A genuinely fresh database still bootstraps it in `public` for the one run before `kontrolia_auth` exists yet (migration 0001 creates it), then relocates it on the next run.
