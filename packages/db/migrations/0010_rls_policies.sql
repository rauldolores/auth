alter table kontrolia.organizations enable row level security;
alter table kontrolia.applications enable row level security;
alter table kontrolia.application_organizations enable row level security;
alter table kontrolia.permissions enable row level security;
alter table kontrolia.roles enable row level security;
alter table kontrolia.role_permissions enable row level security;
alter table kontrolia.memberships enable row level security;
alter table kontrolia.membership_roles enable row level security;
alter table kontrolia.user_permissions enable row level security;
alter table kontrolia.invitations enable row level security;
alter table kontrolia.sessions_context enable row level security;
alter table kontrolia.devices enable row level security;
alter table kontrolia.audit_logs enable row level security;

-- organizations
create policy "members can view their organizations" on kontrolia.organizations
  for select using (kontrolia.is_org_member(id));
create policy "authenticated users can create organizations" on kontrolia.organizations
  for insert to authenticated with check (true);
create policy "org admins can update their organization" on kontrolia.organizations
  for update using (kontrolia.is_org_admin(id));

-- applications / catalog: platform-level, managed via service_role from the
-- auth-server admin API (which enforces its own platform-admin check).
create policy "anyone can view applications enabled for their org" on kontrolia.applications
  for select using (
    exists (
      select 1 from kontrolia.application_organizations ao
      where ao.application_id = id and kontrolia.is_org_member(ao.organization_id)
    )
  );
create policy "org members can view enabled applications" on kontrolia.application_organizations
  for select using (kontrolia.is_org_member(organization_id));
create policy "org members can view permissions of their enabled apps" on kontrolia.permissions
  for select using (
    exists (
      select 1 from kontrolia.application_organizations ao
      where ao.application_id = permissions.application_id and kontrolia.is_org_member(ao.organization_id)
    )
  );

-- roles
create policy "org members can view roles" on kontrolia.roles
  for select using (organization_id is null or kontrolia.is_org_member(organization_id));
create policy "org admins can manage custom roles" on kontrolia.roles
  for insert to authenticated with check (organization_id is not null and kontrolia.is_org_admin(organization_id));
create policy "org admins can update custom roles" on kontrolia.roles
  for update using (organization_id is not null and kontrolia.is_org_admin(organization_id));
create policy "org admins can delete custom roles" on kontrolia.roles
  for delete using (organization_id is not null and kontrolia.is_org_admin(organization_id));

create policy "org members can view role permissions" on kontrolia.role_permissions
  for select using (
    exists (
      select 1 from kontrolia.roles r
      where r.id = role_id and (r.organization_id is null or kontrolia.is_org_member(r.organization_id))
    )
  );
create policy "org admins manage role permissions" on kontrolia.role_permissions
  for all using (
    exists (select 1 from kontrolia.roles r where r.id = role_id and r.organization_id is not null and kontrolia.is_org_admin(r.organization_id))
  );

-- memberships
create policy "members can view memberships in their orgs" on kontrolia.memberships
  for select using (user_id = auth.uid() or kontrolia.is_org_member(organization_id));
create policy "org admins manage memberships" on kontrolia.memberships
  for insert to authenticated with check (kontrolia.is_org_admin(organization_id));
create policy "org admins update memberships" on kontrolia.memberships
  for update using (kontrolia.is_org_admin(organization_id));
create policy "org admins remove memberships" on kontrolia.memberships
  for delete using (kontrolia.is_org_admin(organization_id));

create policy "org members can view membership roles" on kontrolia.membership_roles
  for select using (
    exists (select 1 from kontrolia.memberships m where m.id = membership_id and (m.user_id = auth.uid() or kontrolia.is_org_member(m.organization_id)))
  );
create policy "org admins manage membership roles" on kontrolia.membership_roles
  for all using (
    exists (select 1 from kontrolia.memberships m where m.id = membership_id and kontrolia.is_org_admin(m.organization_id))
  );

create policy "org admins manage user permission overrides" on kontrolia.user_permissions
  for all using (
    exists (select 1 from kontrolia.memberships m where m.id = membership_id and kontrolia.is_org_admin(m.organization_id))
  );

-- invitations — org admins only; invited-user acceptance flow goes through
-- the auth-server API (service role), not direct table access.
create policy "org admins manage invitations" on kontrolia.invitations
  for all using (kontrolia.is_org_admin(organization_id));

-- sessions_context — a user only ever sees/updates their own active org
create policy "users manage their own session context" on kontrolia.sessions_context
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- devices
create policy "users manage their own devices" on kontrolia.devices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_logs — read-only for org admins, writes come from service_role only
create policy "org admins can view audit logs" on kontrolia.audit_logs
  for select using (organization_id is not null and kontrolia.is_org_admin(organization_id));
