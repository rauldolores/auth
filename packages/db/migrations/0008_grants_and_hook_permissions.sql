-- Least-privilege wiring for the hook, per Supabase's guidance: only
-- supabase_auth_admin (GoTrue's own role) may execute it.

grant usage on schema kontrolia to supabase_auth_admin;
grant execute on function kontrolia.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function kontrolia.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- The hook reads these tables inside the SECURITY DEFINER function above, so
-- supabase_auth_admin needs SELECT even though end users never query them
-- directly (RLS below blocks that path).
grant select on kontrolia.sessions_context to supabase_auth_admin;
grant select on kontrolia.memberships to supabase_auth_admin;
grant select on kontrolia.membership_roles to supabase_auth_admin;
grant select on kontrolia.roles to supabase_auth_admin;
grant select on kontrolia.role_permissions to supabase_auth_admin;
grant select on kontrolia.permissions to supabase_auth_admin;
grant select on kontrolia.user_permissions to supabase_auth_admin;

-- Expose the schema to PostgREST for authenticated/anon access, gated by RLS.
grant usage on schema kontrolia to authenticated, anon;
grant select, insert, update, delete on all tables in schema kontrolia to authenticated;
grant select on all tables in schema kontrolia to anon;
alter default privileges in schema kontrolia grant select, insert, update, delete on tables to authenticated;

-- service_role bypasses RLS (Supabase grants it BYPASSRLS), but table-level
-- and schema-level GRANTs are separate from RLS and still apply — without
-- these, server-only code using the service-role key (e.g. the invitation
-- acceptance flow, which must read/write before the visitor is even
-- authenticated) gets "permission denied for schema kontrolia" from
-- PostgREST.
grant usage on schema kontrolia to service_role;
grant select, insert, update, delete on all tables in schema kontrolia to service_role;
alter default privileges in schema kontrolia grant select, insert, update, delete on tables to service_role;
