-- Found while designing the external applications/members API (which
-- creates invitations via a service-role client, same as invitation-accept
-- already does): invitation-accept (apps/auth-server/app/api/invitations/
-- accept/route.ts) grants invitation.role_id through a service_role admin
-- client, and prevent_admin_granting_owner_role's own `auth.role() =
-- 'service_role' then return new` bypass (0028) means it never checked
-- whether that role is 'owner'. An org Admin has always been able to create
-- an invitation with role_id pointing at the Owner role (POST
-- /api/invitations only enforces "org admins manage invitations" RLS, which
-- never inspects role_id), and accepting it would silently grant Owner with
-- no is_org_owner() check at all — a live, reachable bypass of every
-- owner-grant protection built in 0025-0031, through a channel none of them
-- touch.
--
-- Rather than trying to teach the service-role-exempt accept flow to tell a
-- legitimate bootstrap grant apart from this, remove the capability at its
-- source: an invitation can never carry the Owner role. This is also just a
-- reasonable product invariant on its own — you can't invite someone
-- straight into ownership, an existing Owner has to promote them after they
-- join. No legitimate code path creates an owner-role invitation today
-- (grepped: POST /api/invitations never special-cases role slugs), so this
-- forecloses nothing that worked before.

create or replace function kontrolia_auth.prevent_owner_role_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_slug text;
  v_is_system_role boolean;
begin
  if new.role_id is null then
    return new;
  end if;

  select slug, is_system_role into v_role_slug, v_is_system_role
  from kontrolia_auth.roles
  where id = new.role_id;

  if v_role_slug = 'owner' and v_is_system_role then
    raise exception 'No se puede invitar directamente con el rol de Owner.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_owner_role_invitation on kontrolia_auth.invitations;
create trigger prevent_owner_role_invitation
  before insert or update on kontrolia_auth.invitations
  for each row execute function kontrolia_auth.prevent_owner_role_invitation();
