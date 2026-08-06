-- Lets an already-registered application authenticate its own catalog-sync
-- calls (POST /api/applications/sync on auth-server) without needing direct
-- database access — the same "declare your own permissions" pattern Auth0's
-- Resource Servers / Stripe's API keys use. Only a hash is ever stored; the
-- plaintext key is generated once, shown to the operator, and never
-- persisted anywhere.

alter table kontrolia.applications add column api_key_hash text;

comment on column kontrolia.applications.api_key_hash is
  'sha256 hex digest of the application''s sync API key. Null for applications registered before this column existed, or that opted out — those can only be updated by re-running the CLI/registerApplication() directly against the database.';
