-- Deleting an organization is irreversible and cascades through every
-- membership/role/invitation/audit-log row for it (see the FKs in
-- 0002/0004/0005/0006_*.sql) — permission_denied by default today, since no
-- DELETE policy exists on kontrolia_auth.organizations at all. Reserved for
-- the org's Owner specifically, not any Admin: is_org_admin() (0009/0020)
-- deliberately treats Owner and Admin the same for day-to-day management,
-- but wiping the whole organization (including its audit trail) is a
-- different level of consequence.
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
      and r.slug = 'owner'
  );
$$;

grant execute on function kontrolia_auth.is_org_owner(uuid) to authenticated;

create policy "org owners can delete their organization" on kontrolia_auth.organizations
  for delete using (kontrolia_auth.is_org_owner(id));
