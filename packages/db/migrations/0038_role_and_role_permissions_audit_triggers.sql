-- 0013/0024 established "the database logs it, not application code" for
-- every other mutation surface, but roles and role_permissions were never
-- covered — creating or deleting a custom role, or granting/revoking a
-- permission on one, has produced zero audit trail since day one. Found
-- while designing API + MCP routes for role management: those routes must
-- not become the first and only place these actions get logged, since the
-- whole point of trigger-based auditing is that it keeps recording
-- regardless of which caller (browser, API, MCP, Studio/psql) made the
-- change.
--
-- These fire for system-role rows too (the auto-created "Administrador de
-- <app>" role, and its auto-synced permission set) — same as every other
-- trigger here, the log reflects what actually happened in the database,
-- not just human-initiated changes. actor_user_id is auth.uid(), which is
-- null for those system-triggered inserts; that's expected and matches how
-- 0013's own device.revoked/membership.created triggers already behave.

create or replace function kontrolia_auth.log_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      new.organization_id, auth.uid(), 'role.created', 'role', new.id::text,
      jsonb_build_object('name', new.name, 'slug', new.slug, 'application_id', new.application_id, 'is_system_role', new.is_system_role)
    );
    return new;
  else
    if old.organization_id is null or exists (select 1 from kontrolia_auth.organizations where id = old.organization_id) then
      insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
      values (
        old.organization_id, auth.uid(), 'role.deleted', 'role', old.id::text,
        jsonb_build_object('name', old.name, 'slug', old.slug, 'application_id', old.application_id)
      );
    end if;
    return old;
  end if;
end;
$$;

create trigger audit_role_change
  after insert or delete on kontrolia_auth.roles
  for each row execute function kontrolia_auth.log_role_change();

create or replace function kontrolia_auth.log_role_permission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role record;
begin
  select organization_id, name, slug into target_role
  from kontrolia_auth.roles
  where id = coalesce(new.role_id, old.role_id);

  if tg_op = 'INSERT' then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      target_role.organization_id, auth.uid(), 'role_permission.granted', 'role', new.role_id::text,
      jsonb_build_object('role_slug', target_role.slug, 'permission_id', new.permission_id)
    );
    return new;
  else
    if target_role.organization_id is null or exists (select 1 from kontrolia_auth.organizations where id = target_role.organization_id) then
      insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
      values (
        target_role.organization_id, auth.uid(), 'role_permission.revoked', 'role', old.role_id::text,
        jsonb_build_object('role_slug', target_role.slug, 'permission_id', old.permission_id)
      );
    end if;
    return old;
  end if;
end;
$$;

create trigger audit_role_permission_change
  after insert or delete on kontrolia_auth.role_permissions
  for each row execute function kontrolia_auth.log_role_permission_change();
