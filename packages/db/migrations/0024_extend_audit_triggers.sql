-- Suspending/reactivating a member (organization-members PATCH) and
-- revoking or resending an invitation (admin-panel's Invitaciones page)
-- previously left no audit trail: the membership trigger only ran on
-- INSERT/DELETE (0013), and invitations had no DELETE trigger at all.
-- Extends both to keep 0013's own promise — "the database logs it, not
-- application code" — up to date with what the UI can now do.

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
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
      values (new.organization_id, auth.uid(), 'membership.status_changed', 'membership', new.id::text, jsonb_build_object('user_id', new.user_id, 'from_status', old.status, 'to_status', new.status));
    end if;
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

drop trigger if exists audit_membership_change on kontrolia_auth.memberships;
create trigger audit_membership_change
  after insert or update or delete on kontrolia_auth.memberships
  for each row execute function kontrolia_auth.log_membership_change();

create or replace function kontrolia_auth.log_invitation_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from kontrolia_auth.organizations where id = old.organization_id) then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (old.organization_id, auth.uid(), 'invitation.revoked', 'invitation', old.id::text, jsonb_build_object('email', old.email));
  end if;
  return old;
end;
$$;

create trigger audit_invitation_deleted
  after delete on kontrolia_auth.invitations
  for each row execute function kontrolia_auth.log_invitation_deleted();

-- Resend (extend expires_at on a still-pending invitation) shares the same
-- AFTER UPDATE trigger slot as "accepted" — one function, two cases.
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
  elsif new.accepted_at is null and old.expires_at is distinct from new.expires_at then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (new.organization_id, auth.uid(), 'invitation.resent', 'invitation', new.id::text, jsonb_build_object('email', new.email, 'new_expires_at', new.expires_at));
  end if;
  return new;
end;
$$;
