-- 0025 closed the last-owner lockout for one specific vector — deleting the
-- membership_roles row directly. Same-day re-audit found the identical
-- outcome (an org left with zero active Owners) still reachable through two
-- sibling doors on kontrolia_auth.memberships itself, neither guarded by
-- any DB-level check: a direct DELETE of the membership row (RLS policy
-- "org admins remove memberships" is a bare is_org_admin() check), and a
-- direct UPDATE of its status to anything other than 'active' (RLS policy
-- "org admins update memberships", same bare check — this is the exact
-- suspend-to-zero-Owners bug already fixed once at the API layer in
-- 4579870, reachable again via raw PostgREST). Close both at the table
-- that actually matters, the same way 0025 closed membership_roles.

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
  -- Cascaded from the organization's own deletion — nothing left to
  -- protect, and blocking here would make "delete organization" itself
  -- impossible. Mirrors 0023/0025's cascade-safety guard.
  if not exists (select 1 from kontrolia_auth.organizations where id = old.organization_id) then
    return old;
  end if;

  -- A membership that wasn't active wasn't counted among active Owners
  -- anyway, so removing it can't be what drops the count to zero.
  if old.status is distinct from 'active' then
    return old;
  end if;

  select exists (
    select 1
    from kontrolia_auth.membership_roles mr
    join kontrolia_auth.roles r on r.id = mr.role_id
    where mr.membership_id = old.id and r.slug = 'owner'
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
    and r.slug = 'owner';

  if v_active_owner_count <= 1 then
    raise exception 'No puedes quitar al único Owner activo de la organización.';
  end if;

  return old;
end;
$$;

create trigger prevent_last_owner_membership_delete
  before delete on kontrolia_auth.memberships
  for each row execute function kontrolia_auth.prevent_last_owner_membership_removal();

create or replace function kontrolia_auth.prevent_last_owner_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_owner boolean;
  v_active_owner_count int;
begin
  -- Only relevant when a membership is moving OUT of active status.
  if old.status is distinct from 'active' or new.status = 'active' then
    return new;
  end if;

  select exists (
    select 1
    from kontrolia_auth.membership_roles mr
    join kontrolia_auth.roles r on r.id = mr.role_id
    where mr.membership_id = old.id and r.slug = 'owner'
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
    and r.slug = 'owner';

  if v_active_owner_count <= 1 then
    raise exception 'No puedes suspender al único Owner activo de la organización.';
  end if;

  return new;
end;
$$;

create trigger prevent_last_owner_deactivation
  before update on kontrolia_auth.memberships
  for each row execute function kontrolia_auth.prevent_last_owner_deactivation();
