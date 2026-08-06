---
"@kontrolia/db": minor
---

Applications can now keep their own permission catalog in sync after the initial registration, without an operator touching the database by hand: `registerApplication()` generates a per-application sync API key (only its hash is stored — the plaintext is returned once, on first registration, and never again), which the application then uses to call auth-server's new `POST /api/applications/sync` from its own deploy pipeline. See the "Registro de aplicaciones" guide in the documentation for the full contract.

Adds `generateApplicationApiKey()` / `hashApplicationApiKey()` and a new `api_key_hash` column on `kontrolia.applications` (migration `0015_application_api_key.sql`).
