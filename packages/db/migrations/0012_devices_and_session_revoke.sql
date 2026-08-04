-- One device row per session, upserted on each login/touch.
alter table kontrolia.devices add constraint devices_session_id_key unique (session_id);

-- Revokes one specific Supabase session (device) for the calling user.
--
-- There is no supabase-js admin method to revoke an arbitrary session by
-- session_id — signOut() only affects the caller's own current/other
-- sessions. The documented approach is to correlate the JWT's session_id
-- claim with auth.sessions.id and delete that row directly: access tokens
-- already issued stay valid until they expire (short-lived, see
-- GOTRUE_JWT_EXP / config.toml's auth.jwt_expiry), but the session can no
-- longer be refreshed once its auth.sessions row is gone.
--
-- SECURITY DEFINER is what makes touching auth.sessions from an
-- `authenticated`-role caller possible at all; ownership is checked
-- explicitly inside the function since RLS doesn't apply here.
create or replace function kontrolia.revoke_session(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from kontrolia.devices
    where session_id = target_session_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized to revoke this session';
  end if;

  delete from auth.sessions where id = target_session_id;
  delete from kontrolia.devices where session_id = target_session_id;
end;
$$;

grant execute on function kontrolia.revoke_session(uuid) to authenticated;
revoke execute on function kontrolia.revoke_session(uuid) from anon, public;
