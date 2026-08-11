-- kontrolia-integration-surface audit (INT-KEY-001, HIGH): the application
-- sync API key had no rotation, no revocation UI, no "last used" signal, and
-- no logging — a leak was both undetectable and recoverable only by
-- destructively deleting and re-registering the whole application. Also
-- found while implementing the fix: api_key_hash was readable by ANY
-- authenticated user for ANY application. RLS is row-level only — 0018's
-- "browse the application catalog" SELECT policy (`using (true)`) makes
-- every application row visible to every authenticated user, and 0008's
-- blanket `grant select ... on all tables ... to authenticated` never
-- carved out an exception for this one sensitive column. The stored value
-- is a plain, unsalted sha256 digest (packages/db/src/api-key.ts) — not
-- practically reversible given the key's 192 bits of entropy, but a hash
-- that any user can read for any organization's application is needless
-- exposure regardless, and worth closing at the same time as the rest of
-- this key's lifecycle.

alter table kontrolia_auth.applications add column api_key_last_used_at timestamptz;

comment on column kontrolia_auth.applications.api_key_last_used_at is
  'Updated on every successful POST /api/applications/sync auth — lets an operator tell an active integration from an abandoned one before rotating/revoking its key.';

-- Column-level ACL, layered under the existing row-level policies. Table-
-- level `grant select` (0008) makes every column readable regardless of a
-- later per-column `revoke` — Postgres's column privileges are additive on
-- top of the table-level grant, not a restriction of it, so blocking one
-- column means revoking the table-level grant entirely and re-granting an
-- explicit column list for everything else. Rotating/revoking the key
-- still works (that's an UPDATE, untouched by this). The sync route's own
-- lookup runs as service_role, which needs its own explicit grant since
-- column privileges aren't inherited from a table-level grant either.
revoke select on kontrolia_auth.applications from authenticated;
grant select (
  id, name, slug, owner_organization_id, environment, redirect_urls,
  created_at, updated_at, homepage_url, api_key_last_used_at
) on kontrolia_auth.applications to authenticated;
grant select (id, api_key_hash) on kontrolia_auth.applications to service_role;

-- Same "the database logs it, not application code" pattern as every other
-- audit trigger in this schema (0013, 0024) — rotation/revocation are
-- exactly the kind of security-relevant event that should never depend on
-- whichever code path happened to perform the UPDATE remembering to log it.
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
  return new;
end;
$$;

create trigger audit_application_api_key_change
  after update on kontrolia_auth.applications
  for each row execute function kontrolia_auth.log_application_api_key_change();
