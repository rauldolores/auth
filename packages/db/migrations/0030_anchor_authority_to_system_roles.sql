-- Sixth same-day audit found the real root cause underlying every
-- last-owner fix today (0025-0029): is_org_owner()/is_org_admin() only
-- ever checked roles.slug — a column no trigger and no RLS policy on
-- kontrolia_auth.roles actually protects. "org admins can update custom
-- roles" (0019) never inspects slug at all. Any org Admin could create an
-- ordinary custom role, grant it to themselves, then UPDATE its slug to
-- 'owner', becoming recognized as Owner by every check in the system —
-- live-exploited this session, a complete bypass of migrations 0025-0029
-- through a table none of them touch.
--
-- The actual invariant that matters isn't the slug string, it's
-- is_system_role: 0019's INSERT/UPDATE policies on kontrolia_auth.roles
-- already guarantee a custom role can never be created with, or updated
-- to, is_system_role = true (the policies' implicit WITH CHECK — reusing
-- USING, since neither specifies one — requires "not is_system_role" on
-- the row both before AND after the write). That flag is only ever set by
-- the original global-role seed data and the SECURITY DEFINER
-- handle_application_enabled() trigger (0019), both outside any
-- RLS-writable path. Anchor every authority check to that flag instead of
-- the freely-writable slug string it was never actually protecting.

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
      and r.is_system_role
      and r.slug in ('owner', 'admin')
  );
$$;

create or replace function kontrolia_auth.is_org_owner(org_id uuid)
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
      and r.is_system_role
      and r.slug = 'owner'
  );
$$;

-- Same gap in the JWT's "roles" claim: a hijacked custom role's slug
-- would show up as "owner"/"admin" in the token itself, fooling any
-- client-side hasRole(['owner']) UI gate even though the DB-level fix
-- above already stops it from granting any real privilege. Restricting
-- this to system roles only doesn't remove any real capability — no
-- caller in this codebase checks hasRole() against a custom role's slug
-- (grepped: only 'owner'/'admin' are ever checked), and a custom role's
-- actual permissions are still fully exposed via the separate
-- "permissions" claim below, unaffected.
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
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  target_user_id := (event->>'user_id')::uuid;

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
    where mr.membership_id = active_membership_id and r.is_system_role;

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

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- The last-owner "how many active Owners remain" counting queries in
-- 0025-0029 have the exact same blind-slug-trust gap: a hijacked custom
-- role sitting in membership_roles with slug = 'owner' would inflate the
-- count, letting the real Owner be removed right alongside it — live-
-- chained and exploited this session. Add "and r.is_system_role" to every
-- one of them, redefining each function in place (same names/triggers,
-- only the queries change).

create or replace function kontrolia_auth.prevent_last_owner_role_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_role_slug text;
  v_is_system_role boolean;
  v_active_owner_count int;
begin
  select organization_id into v_organization_id
  from kontrolia_auth.memberships
  where id = old.membership_id;

  if v_organization_id is null or not exists (select 1 from kontrolia_auth.organizations where id = v_organization_id) then
    return old;
  end if;

  select slug, is_system_role into v_role_slug, v_is_system_role from kontrolia_auth.roles where id = old.role_id;

  if v_role_slug is distinct from 'owner' or not v_is_system_role then
    return old;
  end if;

  select count(*) into v_active_owner_count
  from kontrolia_auth.membership_roles mr
  join kontrolia_auth.memberships m on m.id = mr.membership_id
  join kontrolia_auth.roles r on r.id = mr.role_id
  where m.organization_id = v_organization_id
    and m.status = 'active'
    and r.slug = 'owner'
    and r.is_system_role;

  if v_active_owner_count <= 1 then
    raise exception 'No puedes quitar el rol de Owner al único Owner activo de la organización.';
  end if;

  return old;
end;
$$;

create or replace function kontrolia_auth.prevent_last_owner_membership_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_owner boolean;
  v_active_owner_count int;
begin
  if not exists (select 1 from kontrolia_auth.organizations where id = old.organization_id) then
    return old;
  end if;

  if old.status is distinct from 'active' then
    return old;
  end if;

  select exists (
    select 1
    from kontrolia_auth.membership_roles mr
    join kontrolia_auth.roles r on r.id = mr.role_id
    where mr.membership_id = old.id and r.slug = 'owner' and r.is_system_role
  ) into v_is_owner;

  if not v_is_owner then
    return old;
  end if;

  select count(*) into v_active_owner_count
  from kontrolia_auth.membership_roles mr
  join kontrolia_auth.memberships m on m.id = mr.membership_id
  join kontrolia_auth.roles r on r.id = mr.role_id
  where m.organization_id = old.organization_id
    and m.status = 'active'
    and r.slug = 'owner'
    and r.is_system_role;

  if v_active_owner_count <= 1 then
    raise exception 'No puedes quitar al único Owner activo de la organización.';
  end if;

  return old;
end;
$$;

create or replace function kontrolia_auth.prevent_last_owner_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_owner boolean;
  v_active_owner_count int;
  v_leaving_org boolean;
begin
  v_leaving_org := (new.organization_id is distinct from old.organization_id) or (new.status is distinct from 'active');

  if old.status is distinct from 'active' or not v_leaving_org then
    return new;
  end if;

  select exists (
    select 1
    from kontrolia_auth.membership_roles mr
    join kontrolia_auth.roles r on r.id = mr.role_id
    where mr.membership_id = old.id and r.slug = 'owner' and r.is_system_role
  ) into v_is_owner;

  if not v_is_owner then
    return new;
  end if;

  select count(*) into v_active_owner_count
  from kontrolia_auth.membership_roles mr
  join kontrolia_auth.memberships m on m.id = mr.membership_id
  join kontrolia_auth.roles r on r.id = mr.role_id
  where m.organization_id = old.organization_id
    and m.status = 'active'
    and r.slug = 'owner'
    and r.is_system_role;

  if v_active_owner_count <= 1 then
    raise exception 'No puedes quitar al único Owner activo de la organización.';
  end if;

  return new;
end;
$$;

create or replace function kontrolia_auth.prevent_admin_granting_owner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_slug text;
  v_is_system_role boolean;
  v_organization_id uuid;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select slug, is_system_role into v_role_slug, v_is_system_role from kontrolia_auth.roles where id = new.role_id;
  if v_role_slug is distinct from 'owner' or not v_is_system_role then
    return new;
  end if;

  select organization_id into v_organization_id from kontrolia_auth.memberships where id = new.membership_id;

  if not kontrolia_auth.is_org_owner(v_organization_id) then
    raise exception 'Solo un Owner puede otorgar el rol de Owner.';
  end if;

  return new;
end;
$$;

create or replace function kontrolia_auth.prevent_membership_role_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_slug text;
  v_old_is_system boolean;
  v_new_slug text;
  v_new_is_system boolean;
  v_active_owner_count int;
begin
  if new.membership_id is distinct from old.membership_id then
    raise exception 'No se puede reasignar un rol de membresía a otra membresía.';
  end if;

  if old.role_id is distinct from new.role_id and auth.role() is distinct from 'service_role' then
    select slug, is_system_role into v_old_slug, v_old_is_system from kontrolia_auth.roles where id = old.role_id;
    select slug, is_system_role into v_new_slug, v_new_is_system from kontrolia_auth.roles where id = new.role_id;
    select organization_id into v_organization_id from kontrolia_auth.memberships where id = old.membership_id;

    if v_new_slug = 'owner' and v_new_is_system and not kontrolia_auth.is_org_owner(v_organization_id) then
      raise exception 'Solo un Owner puede otorgar el rol de Owner.';
    end if;

    if v_old_slug = 'owner' and v_old_is_system and (v_new_slug is distinct from 'owner' or not v_new_is_system) then
      select count(*) into v_active_owner_count
      from kontrolia_auth.membership_roles mr
      join kontrolia_auth.memberships m on m.id = mr.membership_id
      join kontrolia_auth.roles r on r.id = mr.role_id
      where m.organization_id = v_organization_id
        and m.status = 'active'
        and r.slug = 'owner'
        and r.is_system_role;

      if v_active_owner_count <= 1 then
        raise exception 'No puedes quitar el rol de Owner al único Owner activo de la organización.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- roles: neither the INSERT nor the UPDATE policy (0019) has ever
-- inspected `slug` — "not is_system_role" only ever governed
-- is_system_role itself, never the string a custom role's slug could be
-- set to. Defense in depth on top of the is_system_role anchoring above:
-- even if some future check forgets to require is_system_role, a custom
-- role can no longer be given a reserved slug in the first place.
create or replace function kontrolia_auth.prevent_custom_role_reserved_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_system_role and new.slug in ('owner', 'admin', 'member') then
    raise exception 'No puedes usar "%" como slug de un rol personalizado — está reservado.', new.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_custom_role_reserved_slug on kontrolia_auth.roles;
create trigger prevent_custom_role_reserved_slug
  before insert or update on kontrolia_auth.roles
  for each row execute function kontrolia_auth.prevent_custom_role_reserved_slug();
