create table kontrolia.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references kontrolia.organizations (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

comment on table kontrolia.memberships is 'A user''s membership in one organization. A user can hold many memberships (multi-org).';

create index memberships_user_id_idx on kontrolia.memberships (user_id);
create index memberships_organization_id_idx on kontrolia.memberships (organization_id);

create table kontrolia.membership_roles (
  membership_id uuid not null references kontrolia.memberships (id) on delete cascade,
  role_id uuid not null references kontrolia.roles (id) on delete cascade,
  primary key (membership_id, role_id)
);

-- Point-in-time allow/deny overrides on top of the roles' permissions,
-- e.g. granting one extra permission to a Member without creating a new role.
create table kontrolia.user_permissions (
  membership_id uuid not null references kontrolia.memberships (id) on delete cascade,
  permission_id uuid not null references kontrolia.permissions (id) on delete cascade,
  effect text not null check (effect in ('allow', 'deny')),
  primary key (membership_id, permission_id)
);

comment on table kontrolia.user_permissions is 'Per-membership overrides. "deny" always wins over any role-granted permission.';

-- Which organization is "active" for a user's current session — the Custom
-- Access Token Hook reads this to decide which org''s roles/permissions to
-- embed in the JWT. switchOrganization() in the SDK updates this row and
-- forces a session refresh.
create table kontrolia.sessions_context (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_organization_id uuid references kontrolia.organizations (id) on delete set null,
  updated_at timestamptz not null default now()
);
