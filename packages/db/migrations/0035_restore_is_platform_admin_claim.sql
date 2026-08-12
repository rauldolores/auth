-- CRITICAL regression found live while testing the new applications/claim
-- route (migration 0034): migration 0030's `create or replace function
-- kontrolia_auth.custom_access_token_hook` fully replaced the function body
-- to anchor roles/permissions to is_system_role, but its jsonb_set calls only
-- covered organization_id/roles/permissions — it silently dropped the
-- is_platform_admin claim that 0020's version set. `create or replace`
-- replaces the whole body, so anything not repeated in the new version is
-- gone, not merged.
--
-- Live-reproduced: generated a real magic-link session for a genuine
-- platform_admins row (raul.dolores@gmail.com) against the running local
-- sandbox and decoded the resulting JWT — no is_platform_admin claim present
-- at all. Every platform-admin-gated route (POST/DELETE /api/platform-admins,
-- GET/POST/PUT /api/oauth-clients, and the new POST /api/applications/claim)
-- has been checking `claims.is_platform_admin`, which has been `undefined`
-- (falsy, so at least fails closed — no privilege escalation, just a broken
-- feature) for every real user since 0030 shipped earlier today. Nothing
-- caught this because verification since 0030 used direct-SQL/service-role
-- testing for those routes rather than a real fresh login.

create or replace function kontrolia_auth.custom_access_token_hook(event jsonb)
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

  select active_organization_id into active_org_id
  from kontrolia_auth.sessions_context
  where user_id = target_user_id;

  if active_org_id is null then
    select organization_id into active_org_id
    from kontrolia_auth.memberships
    where user_id = target_user_id and status = 'active'
    order by created_at asc
    limit 1;
  end if;

  if active_org_id is not null then
    select id into active_membership_id
    from kontrolia_auth.memberships
    where user_id = target_user_id
      and organization_id = active_org_id
      and status = 'active';
  end if;

  if active_membership_id is not null then
    select coalesce(array_agg(distinct r.slug), '{}')
      into role_names
    from kontrolia_auth.membership_roles mr
    join kontrolia_auth.roles r on r.id = mr.role_id
    where mr.membership_id = active_membership_id and r.is_system_role;

    select coalesce(array_agg(distinct p.key), '{}')
      into permission_keys
    from (
      select p.id, p.key
      from kontrolia_auth.membership_roles mr
      join kontrolia_auth.role_permissions rp on rp.role_id = mr.role_id
      join kontrolia_auth.permissions p on p.id = rp.permission_id
      where mr.membership_id = active_membership_id
      union
      select p.id, p.key
      from kontrolia_auth.user_permissions up
      join kontrolia_auth.permissions p on p.id = up.permission_id
      where up.membership_id = active_membership_id and up.effect = 'allow'
    ) p
    where not exists (
      select 1 from kontrolia_auth.user_permissions up_deny
      where up_deny.membership_id = active_membership_id
        and up_deny.permission_id = p.id
        and up_deny.effect = 'deny'
    );
  else
    role_names := '{}';
    permission_keys := '{}';
  end if;

  select exists(select 1 from kontrolia_auth.platform_admins where user_id = target_user_id) into platform_admin;

  claims := jsonb_set(claims, '{organization_id}', coalesce(to_jsonb(active_org_id), 'null'::jsonb));
  claims := jsonb_set(claims, '{roles}', to_jsonb(coalesce(role_names, '{}')));
  claims := jsonb_set(claims, '{permissions}', to_jsonb(coalesce(permission_keys, '{}')));
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(coalesce(platform_admin, false)));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;
