-- Nothing in the schema records where a registered application is actually
-- reachable for end users — redirect_urls is OAuth callback URIs, not a
-- home page. Needed for an "apps you have access to" launcher (auth-server)
-- to have somewhere to link. Nullable: not always known at registration
-- time via the CLI wizard.
alter table kontrolia_auth.applications add column homepage_url text;

comment on column kontrolia_auth.applications.homepage_url is
  'Where this application is reachable for end users (its actual URL, not an OAuth redirect URI) — what an "apps you can access" launcher links to.';

-- No UPDATE policy existed on applications at all before this (0018 only
-- added a SELECT policy widening catalog browsing). Scoped to the
-- registering org's admins, not every org that merely enabled the app.
create policy "owning org admins can update their application" on kontrolia_auth.applications
  for update
  using (owner_organization_id is not null and kontrolia_auth.is_org_admin(owner_organization_id))
  with check (owner_organization_id is not null and kontrolia_auth.is_org_admin(owner_organization_id));
