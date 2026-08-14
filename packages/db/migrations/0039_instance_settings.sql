-- Instance-wide branding/behavior settings for auth-server's hosted auth
-- screens (login, register, forgot-password, reset-password, verify-email,
-- MFA challenge, invitation accept, OAuth consent — everywhere AuthShell
-- renders). A single row, not per-organization: this installation's
-- self-hosted auth UI has one look, controlled by a platform admin from
-- admin-panel, same way there's one GoTrue project per installation.
--
-- registration_enabled: when false, auth-server hides "Crear cuenta" and
-- /register redirects back to /login — the only way to add a new person is
-- an Owner/Admin inviting them from admin-panel. theme forces light/dark
-- regardless of the browser's prefers-color-scheme, or 'system' (default)
-- to keep following it. button_color overrides --k-primary. logo_url
-- replaces the "K" mark + wordmark when set.
create table kontrolia_auth.instance_settings (
  id boolean primary key default true,
  registration_enabled boolean not null default true,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  button_color text check (button_color is null or button_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint instance_settings_singleton check (id)
);

comment on table kontrolia_auth.instance_settings is 'Singleton row (id is always true) — instance-wide branding/behavior for auth-server''s hosted auth screens.';

insert into kontrolia_auth.instance_settings (id) values (true);

alter table kontrolia_auth.instance_settings enable row level security;

-- Public read: auth-server's login/register/etc. pages render this before
-- anyone is authenticated, and none of these fields are sensitive.
create policy "anyone can read instance settings" on kontrolia_auth.instance_settings
  for select using (true);

-- Writes still go through auth-server's API routes with a service-role
-- client (same Model B pattern as platform-admins/oauth-clients), which
-- bypasses RLS — this policy is defense-in-depth for any direct client use.
create policy "platform admins can update instance settings" on kontrolia_auth.instance_settings
  for update using (exists (select 1 from kontrolia_auth.platform_admins pa where pa.user_id = auth.uid()));

grant select on kontrolia_auth.instance_settings to anon, authenticated;
grant update on kontrolia_auth.instance_settings to authenticated;

-- Logo uploads. Public bucket: served via Supabase's unauthenticated
-- /storage/v1/object/public/branding/... path, so auth-server's own
-- unauthenticated login screen can just <img src> it directly — no signed
-- URLs, no extra round-trip. Uploads/deletes only ever happen server-side
-- through auth-server's service-role client (same as every other
-- platform-admin-gated mutation in this codebase), so no storage.objects
-- RLS policies are needed for writes.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;
