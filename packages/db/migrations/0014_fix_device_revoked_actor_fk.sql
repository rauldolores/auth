-- log_device_revoked() (0013_audit_log_triggers.sql) falls back to the
-- device's own user_id as the actor when there's no session context, e.g.
-- an admin calling revoke_session() on someone else's device. That fallback
-- breaks when the DELETE on kontrolia.devices is itself the product of
-- `delete from auth.users ... on delete cascade`: by the time this AFTER
-- DELETE trigger's INSERT runs, the user's row is already gone from
-- auth.users (deleted earlier in the same transaction, and command-counter
-- visibility makes that immediate), so falling back to old.user_id trips
-- audit_logs_actor_user_id_fkey and the whole `delete from auth.users`
-- fails. Only use the fallback if that user still exists; otherwise log the
-- device revocation with a null actor, same as any other audit row for an
-- actor we can't identify.
create or replace function kontrolia.log_device_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fallback_actor uuid;
begin
  select id into fallback_actor from auth.users where id = old.user_id;

  insert into kontrolia.audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
  values (null, coalesce(auth.uid(), fallback_actor), 'device.revoked', 'device', old.session_id::text, jsonb_build_object('label', old.label));
  return old;
end;
$$;
