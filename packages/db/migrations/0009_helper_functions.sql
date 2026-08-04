-- Helpers reused by RLS policies below. security definer + fixed search_path
-- so they can safely read kontrolia tables regardless of the caller's RLS.

create or replace function kontrolia.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from kontrolia.memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function kontrolia.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from kontrolia.memberships m
    join kontrolia.membership_roles mr on mr.membership_id = m.id
    join kontrolia.roles r on r.id = mr.role_id
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and r.slug in ('owner', 'admin')
  );
$$;

grant execute on function kontrolia.is_org_member(uuid) to authenticated;
grant execute on function kontrolia.is_org_admin(uuid) to authenticated;
