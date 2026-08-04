-- Bootstraps the chicken-and-egg problem of RLS-gated membership writes:
-- creating an organization has no admin membership yet to satisfy
-- kontrolia.is_org_admin(). Instead, the creator is auto-enrolled as Owner
-- via trigger, in the same transaction as the insert.

create or replace function kontrolia.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_role_id uuid;
  new_membership_id uuid;
begin
  select id into owner_role_id from kontrolia.roles where slug = 'owner' and organization_id is null;

  insert into kontrolia.memberships (user_id, organization_id, status)
  values (auth.uid(), new.id, 'active')
  returning id into new_membership_id;

  insert into kontrolia.membership_roles (membership_id, role_id)
  values (new_membership_id, owner_role_id);

  return new;
end;
$$;

create trigger on_organization_created
  after insert on kontrolia.organizations
  for each row
  execute function kontrolia.handle_new_organization();
