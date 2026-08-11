-- Fourth same-day Phase 2 audit found two CRITICALs that fully defeat every
-- last-owner protection added today (0025-0027), because those all guard
-- operations against an *existing* Owner's own row — none of them restrict
-- who can become an Owner in the first place, or what a membership row's
-- identity means. Both are day-one gaps in migration 0010's RLS policies,
-- live-exploited this session by a plain org Admin (no dual-org privilege
-- needed, unlike 0027's narrower finding):
--
-- 1. "org admins manage membership roles" is a bare is_org_admin() check
--    with no restriction on which role_id may be inserted — any Admin can
--    grant themselves (or anyone) the 'owner' role directly, then use the
--    now-legitimate 2-owner path to suspend the real Owner.
-- 2. "org admins update memberships" permits changing ANY column,
--    including user_id, as long as organization_id is unchanged — an Admin
--    can silently reassign the sole Owner's membership row to an arbitrary
--    third-party user, and since the audit trigger only fires on status
--    changes, this leaves zero trail.
--
-- No legitimate code path in this app ever updates memberships.user_id
-- (grepped: the only UPDATE anywhere is the status PATCH in
-- organization-members/route.ts) — a membership's identity is created once
-- via invitation-accept or org-bootstrap and never reassigned, so blocking
-- any change to it entirely, for every membership, is safe.

create or replace function kontrolia_auth.prevent_admin_granting_owner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_slug text;
  v_organization_id uuid;
begin
  select slug into v_role_slug from kontrolia_auth.roles where id = new.role_id;
  if v_role_slug is distinct from 'owner' then
    return new;
  end if;

  select organization_id into v_organization_id from kontrolia_auth.memberships where id = new.membership_id;

  if not kontrolia_auth.is_org_owner(v_organization_id) then
    raise exception 'Solo un Owner puede otorgar el rol de Owner.';
  end if;

  return new;
end;
$$;

create trigger prevent_admin_granting_owner_role
  before insert on kontrolia_auth.membership_roles
  for each row execute function kontrolia_auth.prevent_admin_granting_owner_role();

create or replace function kontrolia_auth.prevent_membership_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'No se puede reasignar la identidad de una membresía existente.';
  end if;
  return new;
end;
$$;

create trigger prevent_membership_identity_change
  before update on kontrolia_auth.memberships
  for each row execute function kontrolia_auth.prevent_membership_identity_change();
