-- An "application" (Facturación, CRM, Inventarios...) declares its own
-- permission catalog when registered. Organizations can only assign, in their
-- roles, permissions from applications they have enabled.

create table kontrolia.applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_organization_id uuid references kontrolia.organizations (id) on delete set null,
  environment text not null default 'production' check (environment in ('development', 'staging', 'production')),
  redirect_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table kontrolia.applications is 'Registered client applications. oauth_clients (v2) attach real OAuth2 credentials to a row here.';

create table kontrolia.application_organizations (
  application_id uuid not null references kontrolia.applications (id) on delete cascade,
  organization_id uuid not null references kontrolia.organizations (id) on delete cascade,
  enabled_at timestamptz not null default now(),
  primary key (application_id, organization_id)
);

comment on table kontrolia.application_organizations is 'Which organizations have which applications enabled — gates which permissions can be assigned in that org''s roles.';

create table kontrolia.permissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references kontrolia.applications (id) on delete cascade,
  resource text not null,
  action text not null,
  key text not null unique,
  description text,
  created_at timestamptz not null default now(),
  unique (application_id, resource, action)
);

comment on table kontrolia.permissions is 'Hierarchical permission catalog, e.g. key = "facturacion.facturas.crear" (resource = "facturas", action = "crear").';

create index permissions_application_id_idx on kontrolia.permissions (application_id);
create index permissions_key_idx on kontrolia.permissions (key);
