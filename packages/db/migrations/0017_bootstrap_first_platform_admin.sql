-- Closes the platform-admin bootstrapping problem: /oauth-clients and any
-- future platform-admin-only screen are useless on a fresh install if
-- granting the very first one requires direct database access — exactly
-- the kind of step this product is supposed to eliminate for non-technical
-- operators. Same idea as kontrolia.handle_new_organization() (the creator
-- of the first organization becomes its Owner automatically): the very
-- first user of a fresh installation becomes its first platform admin
-- automatically, regardless of how they signed up (password, Google,
-- Microsoft — this fires on auth.users itself, not any one auth method).
--
-- Guarded by two conditions together, not just "platform_admins is empty":
-- if the sole platform admin is later revoked, this must NOT silently hand
-- the role to whoever happens to sign up next on an otherwise-live
-- installation. Checking auth.users count = 1 pins this to a genuinely
-- fresh install — it can only ever fire once, on the very first signup.

create or replace function kontrolia.bootstrap_first_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from kontrolia.platform_admins limit 1)
     and (select count(*) from auth.users) = 1 then
    insert into kontrolia.platform_admins (user_id) values (new.id);
  end if;
  return new;
end;
$$;

create trigger on_first_user_created
  after insert on auth.users
  for each row
  execute function kontrolia.bootstrap_first_platform_admin();
