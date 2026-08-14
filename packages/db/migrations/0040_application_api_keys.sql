-- Replaces the single kapp_ key on kontrolia_auth.applications with a real
-- multi-key model: an application can have any number of named, revocable,
-- optionally-expiring keys, each independently scoped to whichever
-- organization it was generated for — not necessarily the application's
-- owner_organization_id. A tenant organization that merely enabled an
-- application (application_organizations) can mint its own key to call
-- that application's members API on its own behalf, without needing the
-- owning organization's involvement at all. The application's own global
-- permission catalog (POST /api/applications/sync) still accepts any valid,
-- non-revoked, non-expired key for the application regardless of which org
-- it's scoped to — syncing permissions isn't an org-scoped operation.
create table kontrolia_auth.application_api_keys (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references kontrolia_auth.applications (id) on delete cascade,
  organization_id uuid not null references kontrolia_auth.organizations (id) on delete cascade,
  name text not null,
  key_hash text not null,
  -- First several characters of the plaintext, purely so the list UI can
  -- show "kapp_a1b2c3…" to help an operator tell keys apart without ever
  -- storing (or being able to show again) the full secret. Null for rows
  -- backfilled from the old single-key column below, where no prefix was
  -- ever recorded.
  key_prefix text,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table kontrolia_auth.application_api_keys is 'Named, independently-scoped, revocable/expiring kapp_ keys — replaces the single applications.api_key_hash. organization_id is whichever org the key was generated for (must have application_id enabled), not necessarily the application''s owner.';

-- 0016's own "platform admins can view the platform admin list" SELECT
-- policy on platform_admins queries platform_admins from inside its own
-- policy — harmless as long as the only caller is service_role (which
-- bypasses RLS entirely, the only way this table has ever actually been
-- read in this codebase before now). The moment ANY other RLS policy
-- (this migration's, below) checks platform-admin status via a plain
-- `exists (select 1 from platform_admins ...)` under a real (non-service-role)
-- caller, Postgres has to evaluate platform_admins' own SELECT policy for
-- that subquery — which itself queries platform_admins — genuine infinite
-- recursion ("infinite recursion detected in policy for relation
-- platform_admins"), live-reproduced while building this migration's own
-- policies below. A SECURITY DEFINER function (same escape hatch
-- is_org_admin/is_org_owner already use for memberships/roles) runs with
-- the function owner's privileges, bypassing the caller's own RLS on the
-- table it queries — no recursion.
create or replace function kontrolia_auth.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from kontrolia_auth.platform_admins pa where pa.user_id = auth.uid());
$$;

-- Retrofit 0016's policy onto the same function, closing the recursion risk
-- there too — not just in the new policies below that happened to expose it.
drop policy if exists "platform admins can view the platform admin list" on kontrolia_auth.platform_admins;
create policy "platform admins can view the platform admin list" on kontrolia_auth.platform_admins
  for select using (kontrolia_auth.is_platform_admin());

alter table kontrolia_auth.application_api_keys enable row level security;

create policy "org admins can view their org's application keys" on kontrolia_auth.application_api_keys
  for select using (kontrolia_auth.is_org_admin(organization_id) or kontrolia_auth.is_platform_admin());

create policy "org admins can create application keys for their org" on kontrolia_auth.application_api_keys
  for insert
  with check (
    (kontrolia_auth.is_org_admin(organization_id) or kontrolia_auth.is_platform_admin())
    and exists (
      select 1 from kontrolia_auth.application_organizations ao
      where ao.application_id = application_api_keys.application_id
        and ao.organization_id = application_api_keys.organization_id
    )
  );

-- Keys are only ever revoked, never edited or hard-deleted — this policy
-- only needs to authorize the "set revoked_at/revoked_by" update, which is
-- everything the API route ever writes here.
create policy "org admins can revoke their org's application keys" on kontrolia_auth.application_api_keys
  for update using (kontrolia_auth.is_org_admin(organization_id) or kontrolia_auth.is_platform_admin())
  with check (kontrolia_auth.is_org_admin(organization_id) or kontrolia_auth.is_platform_admin());

-- Column-level ACL, same reasoning as 0032 for the column this replaces:
-- key_hash must never be readable by any authenticated user for any
-- organization. The auth-server route that matches a caller's Bearer key
-- against these rows runs as service_role, which needs its own explicit
-- grant — column privileges aren't inherited from a table-level grant.
grant select (
  id, application_id, organization_id, name, key_prefix, last_used_at, expires_at, revoked_at, revoked_by, created_by, created_at
) on kontrolia_auth.application_api_keys to authenticated;
grant insert (application_id, organization_id, name, key_hash, key_prefix, expires_at, created_by) on kontrolia_auth.application_api_keys to authenticated;
grant update (revoked_at, revoked_by) on kontrolia_auth.application_api_keys to authenticated;
grant select (id, application_id, organization_id, key_hash) on kontrolia_auth.application_api_keys to service_role;

-- Same "the database logs it" pattern as every other mutation surface
-- (0013, 0024, 0032, 0038).
create or replace function kontrolia_auth.log_application_api_key_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      new.organization_id, auth.uid(), 'application_api_key.created', 'application', new.application_id::text,
      jsonb_build_object('keyId', new.id, 'name', new.name, 'expiresAt', new.expires_at)
    );
    return new;
  end if;

  if old.revoked_at is null and new.revoked_at is not null then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      new.organization_id, auth.uid(), 'application_api_key.revoked', 'application', new.application_id::text,
      jsonb_build_object('keyId', new.id, 'name', new.name)
    );
  end if;
  return new;
end;
$$;

create trigger audit_application_api_key_lifecycle
  after insert or update on kontrolia_auth.application_api_keys
  for each row execute function kontrolia_auth.log_application_api_key_lifecycle();

-- Carry forward every application's existing single key as its first named
-- key, scoped to the same organization that already administered it
-- (owner_organization_id — the only organization the old RLS policy ever
-- let touch it).
insert into kontrolia_auth.application_api_keys (application_id, organization_id, name, key_hash, last_used_at, created_at)
select id, owner_organization_id, 'Clave original', api_key_hash, api_key_last_used_at, created_at
from kontrolia_auth.applications
where api_key_hash is not null and owner_organization_id is not null;

-- log_application_api_key_change() (0032, extended by 0034) did double duty:
-- logging api_key_hash changes AND ownership changes on kontrolia_auth.applications.
-- The key-lifecycle half moves to the new table's own trigger above; redefine
-- this one (same name, same trigger — a transparent swap, no drop/recreate
-- needed) to keep only what it's now solely responsible for.
create or replace function kontrolia_auth.log_application_api_key_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.owner_organization_id is distinct from new.owner_organization_id then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      new.owner_organization_id,
      auth.uid(),
      case when old.owner_organization_id is null then 'application.ownership_claimed' else 'application.ownership_transferred' end,
      'application',
      new.id::text,
      jsonb_build_object('slug', new.slug, 'previous_owner_organization_id', old.owner_organization_id)
    );
  end if;

  return new;
end;
$$;

alter table kontrolia_auth.applications drop column api_key_hash;
alter table kontrolia_auth.applications drop column api_key_last_used_at;
