-- Closes INT-API-007/INT-API-008/PQ-TECH-010: applications.owner_organization_id
-- was never written by any code path in the repo — registerApplication()'s
-- INSERT omits it, the CLI wizard runs before any organization necessarily
-- exists and never asks who should own the app, and no INSERT/ownership-claim
-- RLS policy ever existed for a regular user. Three real, shipped
-- capabilities (0022's owning-org UPDATE policy, the admin-panel rotate/
-- revoke API-key UI, the applications/members API) were all correctly built
-- but unreachable for any application registered the intended way.
--
-- The actual fix is POST /api/applications/claim (auth-server), a
-- platform-admin-gated route that runs as service_role — matching this
-- table's original design comment (migration 0010: "applications catalog:
-- platform-level, managed via service_role from the auth-server admin API").
-- This migration only prepares the database side of that: audit logging for
-- the new action, and a guard against a related gap found while designing
-- it (see below).

-- Extend the existing "database logs it, not application code" trigger
-- (0032) to also cover ownership changes, the same way it already covers
-- api_key_hash changes.
create or replace function kontrolia_auth.log_application_api_key_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.api_key_hash is distinct from new.api_key_hash then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      new.owner_organization_id,
      auth.uid(),
      case when new.api_key_hash is null then 'application.api_key_revoked' else 'application.api_key_rotated' end,
      'application',
      new.id::text,
      jsonb_build_object('slug', new.slug)
    );
  end if;

  if old.owner_organization_id is distinct from new.owner_organization_id then
    insert into kontrolia_auth.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      new.owner_organization_id,
      auth.uid(),
      case when old.owner_organization_id is null then 'application.ownership_claimed' else 'application.ownership_transferred' end,
      'application',
      new.id::text,
      jsonb_build_object('slug', new.slug, 'previous_owner_organization_id', old.owner_organization_id)
    );
  end if;

  return new;
end;
$$;

-- Found while designing the claim route, reading every existing policy on
-- this table: 0022's "owning org admins can update their application" UPDATE
-- policy checks USING/WITH CHECK is_org_admin(owner_organization_id) against
-- the OLD row and the NEW row independently — it never requires those two
-- organization ids to be the SAME org. A user who administers two different
-- organizations, one of which already owns an application, could already
-- reassign that application to their other org via a plain RLS-authenticated
-- UPDATE, with neither org's other admins involved — the same dual-org-admin
-- shape as this session's earlier PQ-SEC-005, on a different table. Since the
-- product has no legitimate "transfer ownership" capability (only "claim an
-- unowned application", which the new route performs as service_role), the
-- simplest correct fix is to remove the capability entirely for any other
-- caller: once owner_organization_id is set, only service_role may change it.
create or replace function kontrolia_auth.prevent_application_ownership_reassignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.owner_organization_id is not null and new.owner_organization_id is distinct from old.owner_organization_id then
    raise exception 'No se puede reasignar la propiedad de una aplicación ya reclamada.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_application_ownership_reassignment on kontrolia_auth.applications;
create trigger prevent_application_ownership_reassignment
  before update on kontrolia_auth.applications
  for each row execute function kontrolia_auth.prevent_application_ownership_reassignment();
