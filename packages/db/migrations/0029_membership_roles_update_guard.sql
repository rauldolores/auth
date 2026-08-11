-- Fifth same-day Phase 2 audit found kontrolia_auth.membership_roles had no
-- trigger on UPDATE at all — 0025 guards DELETE and 0028 guards INSERT, but
-- role_id (part of the table's own primary key) could be changed directly
-- via a plain UPDATE, sidestepping both guards entirely: self-promote to
-- Owner, demote the sole active Owner, or hijack an existing Owner row
-- outright, all live-exploited this session by a plain org Admin.
--
-- The same audit also found a functional regression 0028 introduced:
-- is_org_owner() depends on auth.uid(), which is NULL under the
-- service-role connection apps/auth-server/app/api/invitations/accept/
-- route.ts uses to grant an invited role — so accepting any invitation
-- offering the 'owner' role now silently fails its role grant, for every
-- organization. Service-role connections are already the top of this app's
-- trust chain (RLS doesn't even apply to them, via BYPASSRLS) — govern them
-- by application code review the same way the rest of the schema already
-- does, not by re-deriving auth.uid() a service-role session never has.
--
-- Detecting that trust boundary needs auth.role() (reads the
-- request.jwt.claims GUC), not current_user: these trigger functions are
-- `security definer`, so current_user inside the function body reports the
-- function's OWNER, not the caller — confirmed by direct experimentation
-- against this migration's first draft, which used current_user and still
-- blocked the legitimate service-role grant.

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
  if auth.role() = 'service_role' then
    return new;
  end if;

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

create or replace function kontrolia_auth.prevent_membership_role_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_old_slug text;
  v_new_slug text;
  v_active_owner_count int;
begin
  -- No legitimate flow ever reassigns a role_id row to a different
  -- membership — same reasoning as 0028's blanket ban on
  -- memberships.user_id. Unlike the owner-grant/removal checks below,
  -- there's no service-role exception: nothing legitimate does this either.
  if new.membership_id is distinct from old.membership_id then
    raise exception 'No se puede reasignar un rol de membresía a otra membresía.';
  end if;

  -- A true no-op UPDATE (e.g. an ON CONFLICT DO UPDATE upsert that hit an
  -- already-identical row, as invitation-accept's upsert can) changes
  -- nothing here — skip straight through rather than re-running checks
  -- against a role that never actually changed.
  if old.role_id is distinct from new.role_id and auth.role() is distinct from 'service_role' then
    select slug into v_old_slug from kontrolia_auth.roles where id = old.role_id;
    select slug into v_new_slug from kontrolia_auth.roles where id = new.role_id;
    select organization_id into v_organization_id from kontrolia_auth.memberships where id = old.membership_id;

    if v_new_slug = 'owner' and not kontrolia_auth.is_org_owner(v_organization_id) then
      raise exception 'Solo un Owner puede otorgar el rol de Owner.';
    end if;

    if v_old_slug = 'owner' and v_new_slug is distinct from 'owner' then
      select count(*) into v_active_owner_count
      from kontrolia_auth.membership_roles mr
      join kontrolia_auth.memberships m on m.id = mr.membership_id
      join kontrolia_auth.roles r on r.id = mr.role_id
      where m.organization_id = v_organization_id
        and m.status = 'active'
        and r.slug = 'owner';

      if v_active_owner_count <= 1 then
        raise exception 'No puedes quitar el rol de Owner al único Owner activo de la organización.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger prevent_membership_role_update
  before update on kontrolia_auth.membership_roles
  for each row execute function kontrolia_auth.prevent_membership_role_update();
