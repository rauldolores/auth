-- Custom roles now belong to exactly one application, so each app can define
-- its own catalog of roles (e.g. "Facturación → Contador") instead of one
-- role potentially spanning several unrelated apps. The 3 global system
-- roles (Owner/Admin/Member) are untouched — they stay organization-wide,
-- shared, and immutable exactly as before.
--
-- Enabling an application for an org now also auto-creates an "Administrador
-- de <app>" role scoped to that (org, app) pair, holding every permission the
-- app currently declares. Its permissions are never toggled by hand — a
-- trigger keeps it in sync whenever the app registers a new permission, so it
-- never drifts out of date the way a manually-curated role would.

alter table kontrolia.roles
  add column application_id uuid references kontrolia.applications (id) on delete cascade,
  add column grants_all_permissions boolean not null default false;

-- One unused test role predates this constraint and can't be backfilled
-- (zero permissions, zero members, and its organization has no application
-- enabled to infer one from) — safe to drop.
delete from kontrolia.roles
where slug = 'facturacion-solo-lectura' and organization_id is not null and not is_system_role
  and not exists (select 1 from kontrolia.role_permissions rp where rp.role_id = roles.id)
  and not exists (select 1 from kontrolia.membership_roles mr where mr.role_id = roles.id);

-- The other pre-existing custom role already only references one
-- application's permissions — infer application_id from that.
update kontrolia.roles r
set application_id = inferred.application_id
from (
  select rp.role_id, p.application_id
  from kontrolia.role_permissions rp
  join kontrolia.permissions p on p.id = rp.permission_id
  group by rp.role_id, p.application_id
  having count(distinct p.application_id) = 1
) inferred
where inferred.role_id = r.id and r.application_id is null and r.organization_id is not null and not r.is_system_role;

-- A custom (non-system) role now must belong to one application. The 3
-- global system roles (organization_id null) and any future org-wide system
-- role are exempt. Added after the cleanup/backfill above so it only ever
-- validates the steady state.
alter table kontrolia.roles
  add constraint roles_custom_roles_require_application
  check (organization_id is null or is_system_role or application_id is not null);

-- roles: reopen browsing (already true for applications, mirror it here so
-- picking an application for a new custom role can list its permission
-- count) and require an application on insert, matching the constraint
-- above; system roles (including the auto-created "Administrador de <app>")
-- can never be renamed or deleted through the API.
drop policy if exists "org admins can manage custom roles" on kontrolia.roles;
create policy "org admins can create app-scoped custom roles" on kontrolia.roles
  for insert to authenticated
  with check (
    organization_id is not null and application_id is not null and not is_system_role
    and kontrolia.is_org_admin(organization_id)
    and exists (
      select 1 from kontrolia.application_organizations ao
      where ao.organization_id = roles.organization_id and ao.application_id = roles.application_id
    )
  );

drop policy if exists "org admins can update custom roles" on kontrolia.roles;
create policy "org admins can update custom roles" on kontrolia.roles
  for update using (organization_id is not null and not is_system_role and kontrolia.is_org_admin(organization_id));

drop policy if exists "org admins can delete custom roles" on kontrolia.roles;
create policy "org admins can delete custom roles" on kontrolia.roles
  for delete using (organization_id is not null and not is_system_role and kontrolia.is_org_admin(organization_id));

-- role_permissions: "Administrador de <app>" roles are excluded from manual
-- writes — their permission set is only ever changed by the sync trigger
-- below, so hand-editing them would just get overwritten on the next catalog
-- sync anyway.
drop policy if exists "org admins manage role permissions" on kontrolia.role_permissions;
create policy "org admins manage role permissions" on kontrolia.role_permissions
  for all using (
    exists (
      select 1 from kontrolia.roles r
      where r.id = role_id and r.organization_id is not null and not r.grants_all_permissions
        and kontrolia.is_org_admin(r.organization_id)
    )
  );

-- Auto-create the "Administrador de <app>" role (+ its full permission set)
-- whenever an application gets enabled for an organization.
create or replace function kontrolia.handle_application_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_name text;
  app_slug text;
  new_role_id uuid;
begin
  select name, slug into app_name, app_slug from kontrolia.applications where id = new.application_id;

  insert into kontrolia.roles (organization_id, application_id, name, slug, is_system_role, grants_all_permissions)
  values (new.organization_id, new.application_id, 'Administrador de ' || app_name, 'admin-' || app_slug, true, true)
  on conflict (organization_id, slug) do nothing
  returning id into new_role_id;

  if new_role_id is not null then
    insert into kontrolia.role_permissions (role_id, permission_id)
    select new_role_id, p.id from kontrolia.permissions p where p.application_id = new.application_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_application_enabled on kontrolia.application_organizations;
create trigger on_application_enabled
  after insert on kontrolia.application_organizations
  for each row
  execute function kontrolia.handle_application_enabled();

-- Backfill: create the "Administrador de <app>" role for every
-- (org, application) pair that was already enabled before this migration.
insert into kontrolia.roles (organization_id, application_id, name, slug, is_system_role, grants_all_permissions)
select ao.organization_id, ao.application_id, 'Administrador de ' || a.name, 'admin-' || a.slug, true, true
from kontrolia.application_organizations ao
join kontrolia.applications a on a.id = ao.application_id
on conflict (organization_id, slug) do nothing;

insert into kontrolia.role_permissions (role_id, permission_id)
select r.id, p.id
from kontrolia.roles r
join kontrolia.permissions p on p.application_id = r.application_id
where r.grants_all_permissions
on conflict do nothing;

-- Keep every "Administrador de <app>" role in sync automatically whenever
-- the app declares a new permission (e.g. its next deploy syncs a new
-- resource.action pair) — nobody should have to remember to go re-grant it.
create or replace function kontrolia.handle_permission_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into kontrolia.role_permissions (role_id, permission_id)
  select r.id, new.id
  from kontrolia.roles r
  where r.application_id = new.application_id and r.grants_all_permissions
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_permission_added on kontrolia.permissions;
create trigger on_permission_added
  after insert on kontrolia.permissions
  for each row
  execute function kontrolia.handle_permission_added();

-- A membership can hold at most one role per application (org-wide system
-- roles are exempt — a user is always exactly one of Owner/Admin/Member,
-- plus at most one role per app they've been granted access to).
create or replace function kontrolia.enforce_one_role_per_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_app_id uuid;
  conflict_count int;
begin
  select application_id into target_app_id from kontrolia.roles where id = new.role_id;

  if target_app_id is not null then
    select count(*) into conflict_count
    from kontrolia.membership_roles mr
    join kontrolia.roles r on r.id = mr.role_id
    where mr.membership_id = new.membership_id and r.application_id = target_app_id and mr.role_id <> new.role_id;

    if conflict_count > 0 then
      raise exception 'Este usuario ya tiene un rol asignado para esta aplicación. Quita el rol anterior antes de asignar uno nuevo.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists before_membership_role_insert on kontrolia.membership_roles;
create trigger before_membership_role_insert
  before insert on kontrolia.membership_roles
  for each row
  execute function kontrolia.enforce_one_role_per_application();
