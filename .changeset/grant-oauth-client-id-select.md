---
"@kontrolia/db": patch
---

Fixes a bug from migration 0036: the new `oauth_client_id` column was never granted `SELECT` to the `authenticated` role, which migration 0032 restricted to an explicit column list. Any query including `oauth_client_id` (the Applications page's own query does, unconditionally) failed outright with "permission denied for table applications" — not gracefully omitting the column, taking down the whole query and rendering the entire Aplicaciones list empty. Live-reproduced against production before fixing.
