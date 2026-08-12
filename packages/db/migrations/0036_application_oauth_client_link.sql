-- Lets an application's own row remember which GoTrue OAuth 2.1 client it
-- registered, so admin-panel can manage OAuth-client credentials from
-- inside that application's row instead of a separate, disconnected
-- top-level "Clientes OAuth" screen. No real FK is possible — GoTrue's
-- OAuth clients live entirely outside this schema, reachable only via its
-- own admin HTTP API (see apps/auth-server/app/api/oauth-clients/route.ts),
-- not a Postgres table this database has any relationship to. This is
-- purely a pointer, populated by the application layer after a successful
-- POST to that route.
--
-- An old day-one migration comment (0003_applications_and_permissions.sql:
-- "oauth_clients (v2) attach real OAuth2 credentials to a row here") shows
-- this link was the original intended design; it was never implemented and
-- the two concepts drifted apart into fully separate admin-panel pages.
-- This finally closes that gap.

alter table kontrolia_auth.applications add column oauth_client_id text;

comment on column kontrolia_auth.applications.oauth_client_id is
  'GoTrue OAuth 2.1 client_id registered for this application, if any — set by admin-panel after POST /api/oauth-clients succeeds. Not a foreign key: GoTrue''s own oauth_clients table lives outside kontrolia_auth, reachable only via its admin API.';
