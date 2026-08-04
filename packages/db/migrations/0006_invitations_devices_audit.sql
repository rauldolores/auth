create table kontrolia.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references kontrolia.organizations (id) on delete cascade,
  email text not null,
  role_id uuid references kontrolia.roles (id) on delete set null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index invitations_organization_id_idx on kontrolia.invitations (organization_id);
create index invitations_email_idx on kontrolia.invitations (email);

create table kontrolia.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid,
  label text,
  user_agent text,
  ip inet,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index devices_user_id_idx on kontrolia.devices (user_id);

create table kontrolia.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references kontrolia.organizations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_organization_id_idx on kontrolia.audit_logs (organization_id);
create index audit_logs_created_at_idx on kontrolia.audit_logs (created_at desc);
