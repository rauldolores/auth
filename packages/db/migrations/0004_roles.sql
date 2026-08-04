-- organization_id = null marks a system role (Owner/Admin/Member), seeded once
-- and assignable in every organization. Non-null organization_id marks a
-- custom role scoped to that organization only.

create table kontrolia.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references kontrolia.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  is_system_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

comment on table kontrolia.roles is 'organization_id NULL = system role (Owner/Admin/Member), shared across all orgs. Non-null = org-custom role.';

create table kontrolia.role_permissions (
  role_id uuid not null references kontrolia.roles (id) on delete cascade,
  permission_id uuid not null references kontrolia.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Seed the three system roles KontrolIA ships out of the box.
insert into kontrolia.roles (organization_id, name, slug, is_system_role)
values
  (null, 'Owner', 'owner', true),
  (null, 'Admin', 'admin', true),
  (null, 'Member', 'member', true)
on conflict do nothing;
