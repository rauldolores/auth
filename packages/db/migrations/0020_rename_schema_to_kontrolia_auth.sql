-- Renames the schema from kontrolia to kontrolia_auth. ALTER SCHEMA RENAME
-- moves every table/function/trigger/policy/grant along with it — object
-- identities (OIDs) don't change, so RLS policies, views, CHECK constraints,
-- foreign keys and grants (all of which Postgres compiles to OID references
-- at creation time) keep working untouched.
--
-- The one thing that does NOT survive a schema rename automatically: a
-- plpgsql/sql function's own BODY is stored as literal source text and
-- re-resolves every identifier by name each time it runs — so every
-- function below that references another kontrolia.<object> internally has
-- to be redefined with the new schema name, or it starts raising "schema
-- kontrolia does not exist" the next time it's called. Verified empirically
-- against a throwaway transaction before writing this migration: RLS
-- policies survive unmodified, function bodies do not.

alter schema kontrolia rename to kontrolia_auth;

-- packages/db/migrations/0009_helper_functions.sql
create or replace function kontrolia_auth.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from kontrolia_auth.memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function kontrolia_auth.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from kontrolia_auth.memberships m
    join kontrolia_auth.membership_roles mr on mr.membership_id = m.id
    join kontrolia_auth.roles r on r.id = mr.role_id
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and r.slug in ('owner', 'admin')
  );
$$;

grant execute on function kontrolia_auth.is_org_member(uuid) to authenticated;
grant execute on function kontrolia_auth.is_org_admin(uuid) to authenticated;

-- packages/db/migrations/0011_org_owner_bootstrap_trigger.sql
create or replace function kontrolia_auth.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_role_id uuid;
  new_membership_id uuid;
begin
  select id into owner_role_id from kontrolia_auth.roles where slug = 'owner' and organization_id is null;

  insert into kontrolia_auth.memberships (user_id, organization_id, status)
  values (auth.uid(), new.id, 'active')
  returning id into new_membership_id;

  insert into kontrolia_auth.membership_roles (membership_id, role_id)
  values (new_membership_id, owner_role_id);

  return new;
end;
$$;

-- packages/db/migrations/0012_devices_and_session_revoke.sql
create or replace function kontrolia_auth.revoke_session(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from kontrolia_auth.devices
    where session_id = target_session_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized to revoke this session';
  end if;

  delete from auth.sessions where id = target_session_id;
  delete from kontrolia_auth.devices where session_id = target_session_id;
end;
$$;

grant execute on function kontrolia_auth.revoke_session(uuid) to authenticated;
revoke execute on function kontrolia_auth.revoke_session(uuid) from anon, public;

-- packages/db/migrations/0013_audit_log_triggers.sql
create or replace function kontrolia_auth.log_organization_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (new.id, auth.uid(), 'organization.created', 'organization', new.id::text, jsonb_build_object('name', new.name, 'slug', new.slug));
  return new;
end;
$$;

create or replace function kontrolia_auth.log_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (new.organization_id, coalesce(auth.uid(), new.user_id), 'membership.created', 'membership', new.id::text, jsonb_build_object('user_id', new.user_id, 'status', new.status));
    return new;
  else
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (old.organization_id, auth.uid(), 'membership.removed', 'membership', old.id::text, jsonb_build_object('user_id', old.user_id));
    return old;
  end if;
end;
$$;

create or replace function kontrolia_auth.log_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (new.organization_id, auth.uid(), 'invitation.created', 'invitation', new.id::text, jsonb_build_object('email', new.email));
  return new;
end;
$$;

create or replace function kontrolia_auth.log_invitation_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.accepted_at is null and new.accepted_at is not null then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (new.organization_id, auth.uid(), 'invitation.accepted', 'invitation', new.id::text, jsonb_build_object('email', new.email));
  end if;
  return new;
end;
$$;

create or replace function kontrolia_auth.log_role_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership record;
begin
  select organization_id, user_id into target_membership
  from kontrolia_auth.memberships
  where id = coalesce(new.membership_id, old.membership_id);

  if tg_op = 'INSERT' then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (target_membership.organization_id, coalesce(auth.uid(), target_membership.user_id), 'role.assigned', 'membership_role', new.membership_id::text, jsonb_build_object('role_id', new.role_id));
    return new;
  else
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (target_membership.organization_id, auth.uid(), 'role.unassigned', 'membership_role', old.membership_id::text, jsonb_build_object('role_id', old.role_id));
    return old;
  end if;
end;
$$;

-- packages/db/migrations/0014_fix_device_revoked_actor_fk.sql (latest version of log_device_revoked)
create or replace function kontrolia_auth.log_device_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fallback_actor uuid;
begin
  select id into fallback_actor from auth.users where id = old.user_id;

  insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (null, coalesce(auth.uid(), fallback_actor), 'device.revoked', 'device', old.session_id::text, jsonb_build_object('label', old.label));
  return old;
end;
$$;

-- packages/db/migrations/0016_platform_admins.sql (latest version of custom_access_token_hook)
create or replace function kontrolia_auth.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  target_user_id uuid;
  active_org_id uuid;
  active_membership_id uuid;
  role_names text[];
  permission_keys text[];
  platform_admin boolean;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  target_user_id := (event->>'user_id')::uuid;

  select exists(select 1 from kontrolia_auth.platform_admins where user_id = target_user_id) into platform_admin;

  select active_organization_id into active_org_id
  from kontrolia_auth.sessions_context
  where user_id = target_user_id;

  if active_org_id is null then
    select organization_id into active_org_id
    from kontrolia_auth.memberships
    where user_id = target_user_id and status = 'active'
    order by created_at asc
    limit 1;
  end if;

  if active_org_id is not null then
    select id into active_membership_id
    from kontrolia_auth.memberships
    where user_id = target_user_id
      and organization_id = active_org_id
      and status = 'active';
  end if;

  if active_membership_id is not null then
    select coalesce(array_agg(distinct r.slug), '{}')
      into role_names
    from kontrolia_auth.membership_roles mr
    join kontrolia_auth.roles r on r.id = mr.role_id
    where mr.membership_id = active_membership_id;

    select coalesce(array_agg(distinct p.key), '{}')
      into permission_keys
    from (
      select p.id, p.key
      from kontrolia_auth.membership_roles mr
      join kontrolia_auth.role_permissions rp on rp.role_id = mr.role_id
      join kontrolia_auth.permissions p on p.id = rp.permission_id
      where mr.membership_id = active_membership_id
      union
      select p.id, p.key
      from kontrolia_auth.user_permissions up
      join kontrolia_auth.permissions p on p.id = up.permission_id
      where up.membership_id = active_membership_id and up.effect = 'allow'
    ) p
    where not exists (
      select 1 from kontrolia_auth.user_permissions up_deny
      where up_deny.membership_id = active_membership_id
        and up_deny.permission_id = p.id
        and up_deny.effect = 'deny'
    );
  else
    role_names := '{}';
    permission_keys := '{}';
  end if;

  claims := jsonb_set(claims, '{organization_id}', coalesce(to_jsonb(active_org_id), 'null'::jsonb));
  claims := jsonb_set(claims, '{roles}', to_jsonb(coalesce(role_names, '{}')));
  claims := jsonb_set(claims, '{permissions}', to_jsonb(coalesce(permission_keys, '{}')));
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(coalesce(platform_admin, false)));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function kontrolia_auth.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function kontrolia_auth.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- packages/db/migrations/0017_bootstrap_first_platform_admin.sql
create or replace function kontrolia_auth.bootstrap_first_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from kontrolia_auth.platform_admins limit 1)
     and (select count(*) from auth.users) = 1 then
    insert into kontrolia_auth.platform_admins (user_id) values (new.id);
  end if;
  return new;
end;
$$;

-- packages/db/migrations/0019_app_scoped_custom_roles.sql
create or replace function kontrolia_auth.handle_application_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_name text;
  app_slug text;
  new_role_id uuid;
begin
  select name, slug into app_name, app_slug from kontrolia_auth.applications where id = new.application_id;

  insert into kontrolia_auth.roles (organization_id, application_id, name, slug, is_system_role, grants_all_permissions)
  values (new.organization_id, new.application_id, 'Administrador de ' || app_name, 'admin-' || app_slug, true, true)
  on conflict (organization_id, slug) do nothing
  returning id into new_role_id;

  if new_role_id is not null then
    insert into kontrolia_auth.role_permissions (role_id, permission_id)
    select new_role_id, p.id from kontrolia_auth.permissions p where p.application_id = new.application_id;
  end if;

  return new;
end;
$$;

create or replace function kontrolia_auth.handle_permission_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into kontrolia_auth.role_permissions (role_id, permission_id)
  select r.id, new.id
  from kontrolia_auth.roles r
  where r.application_id = new.application_id and r.grants_all_permissions
  on conflict do nothing;
  return new;
end;
$$;

create or replace function kontrolia_auth.enforce_one_role_per_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_app_id uuid;
  conflict_count int;
begin
  select application_id into target_app_id from kontrolia_auth.roles where id = new.role_id;

  if target_app_id is not null then
    select count(*) into conflict_count
    from kontrolia_auth.membership_roles mr
    join kontrolia_auth.roles r on r.id = mr.role_id
    where mr.membership_id = new.membership_id and r.application_id = target_app_id and mr.role_id <> new.role_id;

    if conflict_count > 0 then
      raise exception 'Este usuario ya tiene un rol asignado para esta aplicación. Quita el rol anterior antes de asignar uno nuevo.';
    end if;
  end if;

  return new;
end;
$$;
