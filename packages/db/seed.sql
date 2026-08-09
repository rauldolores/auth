-- Optional demo data for local testing — NOT part of the migration chain
-- (migrations must stay pure schema/RLS). Run manually after migrating:
--   psql "$DATABASE_URL" -f packages/db/seed.sql
--
-- Registers a demo "Facturación" application with one permission and grants
-- it to the Owner system role, so a freshly created organization's owner
-- can immediately exercise examples/nextjs's <RequirePermission> route.

insert into kontrolia_auth.applications (name, slug, environment)
values ('Facturación', 'facturacion', 'development')
on conflict (slug) do nothing;

insert into kontrolia_auth.permissions (application_id, resource, action, key, description)
select id, 'facturas', 'crear', 'facturacion.facturas.crear', 'Crear facturas'
from kontrolia_auth.applications
where slug = 'facturacion'
on conflict (key) do nothing;

-- Grants the permission to every organization (loop keeps this re-runnable
-- as new orgs are created during testing).
insert into kontrolia_auth.application_organizations (application_id, organization_id)
select a.id, o.id
from kontrolia_auth.applications a
cross join kontrolia_auth.organizations o
where a.slug = 'facturacion'
on conflict do nothing;

insert into kontrolia_auth.role_permissions (role_id, permission_id)
select r.id, p.id
from kontrolia_auth.roles r, kontrolia_auth.permissions p
where r.slug = 'owner' and r.organization_id is null and p.key = 'facturacion.facturas.crear'
on conflict do nothing;
