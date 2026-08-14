-- Tracks the single, auto-provisioned, non-deletable OAuth client reserved
-- for MCP agent connections (Claude Code, Claude Desktop, ChatGPT
-- connectors, ...). Registering a client OAuth was previously only
-- reachable through an application's own "Cliente OAuth" dialog — correct
-- for genuine app SSO, but a modeling mismatch for a generic agent that
-- isn't "logging in as" any one catalogued application. NULL until the
-- first visit to admin-panel's "Clientes OAuth" screen bootstraps it (see
-- POST /api/oauth-clients/mcp-bootstrap) — there's no way to create it from
-- a plain SQL migration, since GoTrue's OAuth clients live behind its own
-- admin HTTP API, not a table this schema can INSERT into directly.
alter table kontrolia_auth.instance_settings add column mcp_oauth_client_id text;

comment on column kontrolia_auth.instance_settings.mcp_oauth_client_id is
  'GoTrue client_id of the reserved MCP OAuth client, once bootstrapped. Not a secret (client_id is public in the OAuth flow) — safe to expose via the same public GET /api/instance-settings as everything else on this row.';
