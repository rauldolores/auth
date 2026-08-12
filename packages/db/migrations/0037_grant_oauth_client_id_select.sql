-- Migration 0036 added applications.oauth_client_id but forgot the
-- column-level grant migration 0032 made mandatory for any new column on
-- this table: 0032 revoked the old blanket `grant select on all tables to
-- authenticated` and replaced it with an explicit per-column list, so a
-- column added later without its own grant is invisible to `authenticated`
-- — worse than invisible, actually: PostgREST's single SELECT statement
-- fails outright with "permission denied for table applications" the
-- moment oauth_client_id is included alongside the columns that ARE
-- granted, taking the whole query down with it. Live-reproduced against
-- production: apps/admin-panel's applications page select list includes
-- oauth_client_id unconditionally, so every authenticated user's query
-- failed and the entire "Aplicaciones" list rendered empty since 0036
-- shipped — not a caching or migration-timing issue, a missing grant.
--
-- Not sensitive like api_key_hash (a GoTrue client_id, not a secret), so
-- it belongs in the same broadly-readable column set as
-- owner_organization_id/homepage_url/etc., not restricted to service_role.

grant select (oauth_client_id) on kontrolia_auth.applications to authenticated;
