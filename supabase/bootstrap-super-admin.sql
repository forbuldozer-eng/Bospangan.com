-- Run once in the NEW Bos Pangan Supabase project's SQL Editor.
-- First create the owner account in Authentication -> Users.
-- Replace the email below with the exact email of the account you control.
-- This script is intentionally executed manually by the project owner.

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('YOUR_SUPER_ADMIN_EMAIL')
  limit 1;

  if v_user_id is null then
    raise exception 'The Super Admin account was not found. Create it in Supabase Auth Users first.';
  end if;

  insert into public.profiles (id, email, display_name, role)
  select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'display_name', ''), 'super_admin'
  from auth.users
  where id = v_user_id
  on conflict (id) do update
    set email = excluded.email,
        role = 'super_admin',
        updated_at = now();
end;
$$;

-- Verify the account is assigned the Super Admin role.
select id, email, display_name, role
from public.profiles
where role = 'super_admin';
