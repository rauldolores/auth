---
"@kontrolia/db": patch
---

Added migration 0036: a nullable `oauth_client_id` column on `kontrolia_auth.applications`, letting admin-panel manage an application's GoTrue OAuth 2.1 client from inside that application's own row instead of a separate, disconnected "Clientes OAuth" screen. No real foreign key — GoTrue's OAuth clients live entirely outside this schema, reachable only via its admin API. Closes a gap an old day-one migration comment shows was the original intended design but was never implemented.
