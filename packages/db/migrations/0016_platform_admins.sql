-- A "platform admin" needs to see across every organization (support/ops
-- consoles, cross-tenant monitoring) — something the rest of the model
-- deliberately can't do, since roles/permissions are always scoped to one
-- active organization at a time (see custom_access_token_hook). Rather than
-- have every app invent its own "<app>.admin.ver_todo" escape hatch, this
-- is one reserved claim outside the app-permission-key namespace, backed by
-- its own table so it's a single source of truth across the whole install.
--
-- No self-service UI/API for granting this on purpose — same "manual step
-- for now" pattern as application_organizations enablement. Grant with:
--   insert into kontrolia.platform_admins (user_id) values ('<user-uuid>');

create table kontrolia.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

comment on table kontrolia.platform_admins is 'Users who can see across every organization — a single reserved claim (is_platform_admin), not an app-defined permission. Granted by inserting directly, no UI yet.';

alter table kontrolia.platform_admins enable row level security;

-- Only platform admins can even see who else is one — nobody self-grants
-- via RLS (writes require direct database access, same as this table's own
-- comment says).
create policy "platform admins can view the platform admin list" on kontrolia.platform_admins
  for select using (exists (select 1 from kontrolia.platform_admins pa where pa.user_id = auth.uid()));

grant select on kontrolia.platform_admins to authenticated;

create or replace function kontrolia.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  target_user_id uuid;
  active_org_id uuid;
  active_membership_id uuid;
  role_names text[];
  permission_keys text[];
  platform_admin boolean;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  target_user_id := (event->>'user_id')::uuid;

  select exists(select 1 from kontrolia.platform_admins where user_id = target_user_id) into platform_admin;

  select active_organization_id into active_org_id
  from kontrolia.sessions_context
  where user_id = target_user_id;

  if active_org_id is null then
    select organization_id into active_org_id
    from kontrolia.memberships
    where user_id = target_user_id and status = 'active'
    order by created_at asc
    limit 1;
  end if;

  if active_org_id is not null then
    select id into active_membership_id
    from kontrolia.memberships
    where user_id = target_user_id
      and organization_id = active_org_id
      and status = 'active';
  end if;

  if active_membership_id is not null then
    select coalesce(array_agg(distinct r.slug), '{}')
      into role_names
    from kontrolia.membership_roles mr
    join kontrolia.roles r on r.id = mr.role_id
    where mr.membership_id = active_membership_id;

    select coalesce(array_agg(distinct p.key), '{}')
      into permission_keys
    from (
      select p.id, p.key
      from kontrolia.membership_roles mr
      join kontrolia.role_permissions rp on rp.role_id = mr.role_id
      join kontrolia.permissions p on p.id = rp.permission_id
      where mr.membership_id = active_membership_id
      union
      select p.id, p.key
      from kontrolia.user_permissions up
      join kontrolia.permissions p on p.id = up.permission_id
      where up.membership_id = active_membership_id and up.effect = 'allow'
    ) p
    where not exists (
      select 1 from kontrolia.user_permissions up_deny
      where up_deny.membership_id = active_membership_id
        and up_deny.permission_id = p.id
        and up_deny.effect = 'deny'
    );
  else
    role_names := '{}';
    permission_keys := '{}';
  end if;

  -- to_jsonb(NULL::uuid) is SQL NULL, not a jsonb null — and jsonb_set is
  -- strict, so passing it straight through would collapse the whole
  -- function's result to NULL for any user without an organization yet
  -- (i.e. every brand-new signup). coalesce() converts that to a real
  -- jsonb null instead.
  claims := jsonb_set(claims, '{organization_id}', coalesce(to_jsonb(active_org_id), 'null'::jsonb));
  claims := jsonb_set(claims, '{roles}', to_jsonb(coalesce(role_names, '{}')));
  claims := jsonb_set(claims, '{permissions}', to_jsonb(coalesce(permission_keys, '{}')));
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(coalesce(platform_admin, false)));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;
