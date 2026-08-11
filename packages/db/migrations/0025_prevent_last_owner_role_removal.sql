-- wouldRemoveLastOwner() (organization-members API route) already stops a
-- caller from suspending/removing the org's only active Owner — but that
-- guard lives at the API-route layer, not the DB layer. The RLS policy
-- actually governing kontrolia_auth.membership_roles ("org admins manage
-- membership roles", 0010) is a bare is_org_admin() check with no owner
-- protection at all, so any org Admin can DELETE the sole Owner's role
-- row directly and reproduce the exact same lockout through a door the
-- API-layer fix never covered. Enforce it where it can't be bypassed: in
-- the database, on every DELETE, regardless of which code path issued it.

create or replace function kontrolia_auth.prevent_last_owner_role_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_role_slug text;
  v_active_owner_count int;
begin
  select organization_id into v_organization_id
  from kontrolia_auth.memberships
  where id = old.membership_id;

  -- Membership already gone (e.g. cascaded from an org delete, or from a
  -- membership delete the API route already validated before issuing) —
  -- nothing left to protect. Mirrors 0023's org-delete cascade guard.
  if v_organization_id is null or not exists (select 1 from kontrolia_auth.organizations where id = v_organization_id) then
    return old;
  end if;

  select slug into v_role_slug from kontrolia_auth.roles where id = old.role_id;

  if v_role_slug is distinct from 'owner' then
    return old;
  end if;

  select count(*) into v_active_owner_count
  from kontrolia_auth.membership_roles mr
  join kontrolia_auth.memberships m on m.id = mr.membership_id
  join kontrolia_auth.roles r on r.id = mr.role_id
  where m.organization_id = v_organization_id
    and m.status = 'active'
    and r.slug = 'owner';

  if v_active_owner_count <= 1 then
    raise exception 'No puedes quitar el rol de Owner al único Owner activo de la organización.';
  end if;

  return old;
end;
$$;

create trigger prevent_last_owner_role_removal
  before delete on kontrolia_auth.membership_roles
  for each row execute function kontrolia_auth.prevent_last_owner_role_removal();
