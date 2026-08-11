-- 0028's owner-grant guard ("Solo un Owner puede otorgar el rol de Owner")
-- broke organization creation itself: 0011's bootstrap trigger auto-enrolls
-- a brand-new organization's creator as its first Owner, in the same
-- transaction as the org's own insert — at that exact moment
-- is_org_owner() correctly returns false (there is, by definition, no
-- Owner yet), so 0028 rejected the very grant it needed to allow. Every
-- "create organization" request has been failing with "Solo un Owner
-- puede otorgar el rol de Owner" since 0028 shipped today.
--
-- The fix: also allow the grant when the target organization currently has
-- zero active Owners. That can only be genuinely true for a brand-new org
-- (0025-0027 already block every path that would let an *existing* org's
-- active-Owner count reach zero), so this reopens nothing PQ-SEC-006
-- closed — it only restores the one case those very fixes made
-- impossible to reach any other way: establishing an org's first Owner.

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
  v_existing_owner_count int;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select slug, is_system_role into v_role_slug, v_is_system_role from kontrolia_auth.roles where id = new.role_id;
  if v_role_slug is distinct from 'owner' or not v_is_system_role then
    return new;
  end if;

  select organization_id into v_organization_id from kontrolia_auth.memberships where id = new.membership_id;

  if kontrolia_auth.is_org_owner(v_organization_id) then
    return new;
  end if;

  select count(*) into v_existing_owner_count
  from kontrolia_auth.membership_roles mr
  join kontrolia_auth.memberships m on m.id = mr.membership_id
  join kontrolia_auth.roles r on r.id = mr.role_id
  where m.organization_id = v_organization_id
    and m.status = 'active'
    and r.slug = 'owner'
    and r.is_system_role;

  if v_existing_owner_count > 0 then
    raise exception 'Solo un Owner puede otorgar el rol de Owner.';
  end if;

  return new;
end;
$$;

-- Same latent bug in 0029's UPDATE-path owner-grant check — not currently
-- reachable by any shipped code path (nothing upserts a role_id change to
-- 'owner' outside the service-role-exempt invitation-accept flow), but
-- fixing it for the same reason: a zero-Owner org has nothing to bypass.
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
      select count(*) into v_active_owner_count
      from kontrolia_auth.membership_roles mr
      join kontrolia_auth.memberships m on m.id = mr.membership_id
      join kontrolia_auth.roles r on r.id = mr.role_id
      where m.organization_id = v_organization_id
        and m.status = 'active'
        and r.slug = 'owner'
        and r.is_system_role;

      if v_active_owner_count > 0 then
        raise exception 'Solo un Owner puede otorgar el rol de Owner.';
      end if;
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
