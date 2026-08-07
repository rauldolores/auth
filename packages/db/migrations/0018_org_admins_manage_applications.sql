-- Closes a real gap: kontrolia.application_organizations had a SELECT
-- policy but nothing let anyone actually enable an application for their
-- organization — the wizard/API registers an application globally, but
-- nothing ever connected it to an org, so Aplicaciones/Permisos/Roles all
-- stayed empty even after registering a real application. Enabling an app
-- for your org is an org-level decision (same model as installing a Slack
-- app into your workspace), so this is org-admin self-service, not
-- platform-admin gated.
--
-- Also widens who can even see the application *catalog*: the original
-- applications SELECT policy only showed a row once it was already enabled
-- for one of your orgs — a chicken-and-egg problem for browsing what's
-- available to enable in the first place. Nothing in the catalog itself is
-- per-org secret data, so any authenticated user can browse it now; what's
-- still gated is enabling one for a specific organization.

drop policy if exists "anyone can view applications enabled for their org" on kontrolia.applications;

create policy "authenticated users can browse the application catalog" on kontrolia.applications
  for select to authenticated using (true);

create policy "org admins enable/disable applications for their org" on kontrolia.application_organizations
  for all
  using (kontrolia.is_org_admin(organization_id))
  with check (kontrolia.is_org_admin(organization_id));
