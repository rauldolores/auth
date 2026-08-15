-- Stores the OAuth 2.1 tokens for KontrolIA Auth's own connection to
-- Supabase's Management API (a "Supabase OAuth App" a platform admin
-- authorizes once, from admin-panel's Social login screen) — the
-- self-renewing alternative to pasting a Personal Access Token that
-- silently expires. access_token is short-lived; refresh_token lets
-- auth-server renew it on its own, forever, until the connection is
-- revoked (from here, or from the user's own Supabase account).
--
-- Deliberately NOT modeled like instance_settings (public-read singleton):
-- RLS is enabled with zero policies, and there is no grant to anon/
-- authenticated at all beyond the schema's blanket default privileges from
-- migration 0008 — with RLS enabled and no permissive policy, that default
-- grant still resolves to zero rows/denied for every command, for every
-- role except service_role (which bypasses RLS entirely). This table's
-- contents are account-wide-privileged Supabase credentials, meant to be
-- reachable ONLY from auth-server's own service-role client — never via
-- PostgREST under any authenticated session, no matter how the caller got
-- there.
create table kontrolia_auth.supabase_oauth_connection (
  id boolean primary key default true,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supabase_oauth_connection_singleton check (id)
);

comment on table kontrolia_auth.supabase_oauth_connection is 'Singleton row (id is always true) — OAuth tokens for this installation''s connection to Supabase''s Management API. service_role only, never exposed via PostgREST.';

alter table kontrolia_auth.supabase_oauth_connection enable row level security;
