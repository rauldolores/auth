---
"@kontrolia/db": patch
"create-kontrolia-auth": patch
---

`registerApplication()` still tried to write `applications.api_key_hash` — a column migration 0040 dropped when API keys moved to the org-scoped `application_api_keys` table. Against any database with that migration applied, the insert crashed outright. Fixed by dropping that write entirely (and the now-meaningless `apiKey` return field) — a first sync key can't be generated at registration time anyway, since there's no organization to scope it to yet. The CLI's install step now points to generating one from admin-panel (Aplicaciones → tu app → API Keys) once an organization has enabled the app, instead of showing a key that was never actually created.
