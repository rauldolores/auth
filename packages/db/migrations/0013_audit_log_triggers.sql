-- Trigger-based audit logging: writes happen inside the database, not
-- because application code remembered to also call an "insertAuditLog()"
-- helper. That's the entire point of an audit trail — it has to keep
-- recording even when a future API route forgets to, or a change comes
-- from Studio/psql directly.
--
-- actor_user_id is auth.uid() where available. Some of these writes go
-- through service-role code paths (e.g. invitation acceptance, which needs
-- to run before the visitor even has an org membership) where auth.uid()
-- isn't meaningful — those fall back to the affected row's own user_id, or
-- are left null when there truly isn't one to infer.

create or replace function kontrolia.log_organization_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (new.id, auth.uid(), 'organization.created', 'organization', new.id::text, jsonb_build_object('name', new.name, 'slug', new.slug));
  return new;
end;
$$;

create trigger audit_organization_created
  after insert on kontrolia.organizations
  for each row execute function kontrolia.log_organization_created();

create or replace function kontrolia.log_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (new.organization_id, coalesce(auth.uid(), new.user_id), 'membership.created', 'membership', new.id::text, jsonb_build_object('user_id', new.user_id, 'status', new.status));
    return new;
  else
    insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (old.organization_id, auth.uid(), 'membership.removed', 'membership', old.id::text, jsonb_build_object('user_id', old.user_id));
    return old;
  end if;
end;
$$;

create trigger audit_membership_change
  after insert or delete on kontrolia.memberships
  for each row execute function kontrolia.log_membership_change();

create or replace function kontrolia.log_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (new.organization_id, auth.uid(), 'invitation.created', 'invitation', new.id::text, jsonb_build_object('email', new.email));
  return new;
end;
$$;

create trigger audit_invitation_created
  after insert on kontrolia.invitations
  for each row execute function kontrolia.log_invitation_created();

create or replace function kontrolia.log_invitation_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.accepted_at is null and new.accepted_at is not null then
    insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (new.organization_id, auth.uid(), 'invitation.accepted', 'invitation', new.id::text, jsonb_build_object('email', new.email));
  end if;
  return new;
end;
$$;

create trigger audit_invitation_accepted
  after update on kontrolia.invitations
  for each row execute function kontrolia.log_invitation_accepted();

create or replace function kontrolia.log_role_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership record;
begin
  select organization_id, user_id into target_membership
  from kontrolia.memberships
  where id = coalesce(new.membership_id, old.membership_id);

  if tg_op = 'INSERT' then
    insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (target_membership.organization_id, coalesce(auth.uid(), target_membership.user_id), 'role.assigned', 'membership_role', new.membership_id::text, jsonb_build_object('role_id', new.role_id));
    return new;
  else
    insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (target_membership.organization_id, auth.uid(), 'role.unassigned', 'membership_role', old.membership_id::text, jsonb_build_object('role_id', old.role_id));
    return old;
  end if;
end;
$$;

create trigger audit_role_assignment_change
  after insert or delete on kontrolia.membership_roles
  for each row execute function kontrolia.log_role_assignment_change();

create or replace function kontrolia.log_device_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (null, coalesce(auth.uid(), old.user_id), 'device.revoked', 'device', old.session_id::text, jsonb_build_object('label', old.label));
  return old;
end;
$$;

create trigger audit_device_revoked
  after delete on kontrolia.devices
  for each row execute function kontrolia.log_device_revoked();
