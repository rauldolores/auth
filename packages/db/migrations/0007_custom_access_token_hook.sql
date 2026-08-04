-- Custom Access Token Hook: runs inside GoTrue's own transaction whenever a
-- JWT is issued (login, refresh). Embeds organization_id, roles and
-- permissions for the user's *active* organization only — never for every
-- organization the user belongs to, to keep the token small and avoid
-- leaking permissions across tenants. switchOrganization() in the SDK
-- updates kontrolia.sessions_context and triggers a session refresh so this
-- hook re-runs with the new active organization.

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
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  target_user_id := (event->>'user_id')::uuid;

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

  claims := jsonb_set(claims, '{organization_id}', to_jsonb(active_org_id));
  claims := jsonb_set(claims, '{roles}', to_jsonb(coalesce(role_names, '{}')));
  claims := jsonb_set(claims, '{permissions}', to_jsonb(coalesce(permission_keys, '{}')));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function kontrolia.custom_access_token_hook is 'Supabase Auth Custom Access Token Hook. Wire via GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/kontrolia/custom_access_token_hook (self-hosted) or Dashboard > Authentication > Hooks (Supabase Cloud — manual step, cannot be automated by the CLI).';
