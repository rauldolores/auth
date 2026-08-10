-- Deleting an organization (0021) cascades to memberships, which cascades
-- to membership_roles — and the AFTER DELETE audit triggers on both
-- (0013_audit_log_triggers.sql) tried to INSERT a new audit_logs row
-- referencing that same organization_id mid-cascade, violating
-- audit_logs_organization_id_fkey (audit_logs itself also cascades on
-- organization delete, so by the time these triggers fire the parent
-- organization row is gone). There's no point logging "membership removed"
-- for a membership that's disappearing because its whole organization —
-- audit trail included — is being wiped a moment later anyway. Guard both
-- triggers: only log when the organization is still around, i.e. this is a
-- real standalone removal, not a side effect of deleting the org itself.
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
    if exists (select 1 from kontrolia_auth.organizations where id = old.organization_id) then
      insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
      values (old.organization_id, auth.uid(), 'membership.removed', 'membership', old.id::text, jsonb_build_object('user_id', old.user_id));
    end if;
    return old;
  end if;
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

  if not exists (select 1 from kontrolia_auth.organizations where id = target_membership.organization_id) then
    if tg_op = 'INSERT' then return new; else return old; end if;
  end if;

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
