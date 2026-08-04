create table kontrolia.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table kontrolia.organizations is 'Tenants. A user can belong to many organizations via kontrolia.memberships.';

create index organizations_slug_idx on kontrolia.organizations (slug);
