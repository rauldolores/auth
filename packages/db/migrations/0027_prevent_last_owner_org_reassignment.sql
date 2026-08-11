-- 0026's UPDATE trigger only inspected `status`, never `organization_id` —
-- a caller with admin rights in the Owner's org AND the destination org
-- (the RLS policy's implicit WITH CHECK, reusing USING since none is
-- declared, already requires both) could move the sole active Owner's
-- membership to a different organization while leaving status untouched,
-- leaving the source org with zero active Owners the same way a status
-- flip to 'suspended' would. Narrower precondition than 0026's two fixes
-- (needs dual-org admin, not just single-org), but the same bug class —
-- extend the same trigger rather than leave it half-covering "leaving
-- active status" as the only way to lose the last Owner.

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
  -- "Leaving" now covers both ways a membership stops counting toward its
  -- (original) org's active Owners: no longer active, or reassigned away.
  v_leaving_org := (new.organization_id is distinct from old.organization_id) or (new.status is distinct from 'active');

  if old.status is distinct from 'active' or not v_leaving_org then
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
    raise exception 'No puedes quitar al único Owner activo de la organización.';
  end if;

  return new;
end;
$$;
