-- Bos Pangan CMS identity and access control.
-- Only two CMS roles exist: super_admin and admin.
-- New Auth users receive a profile with NULL role and cannot access the CMS
-- until the Super Admin explicitly grants the admin role.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role is null or role in ('admin', 'super_admin'))
);

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles alter column role drop default;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('admin', 'super_admin'));

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'super_admin'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_super_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "read own profile" on public.profiles;
drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

-- Only a Super Admin may grant or revoke Admin access.
-- p_role accepts 'admin' to grant access or 'none' to revoke access.
-- The first Super Admin is assigned separately from the Supabase SQL Editor.
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role text;
begin
  if not public.is_super_admin() then
    raise exception 'Only the Super Admin can manage CMS access';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'The Super Admin cannot change their own access here';
  end if;

  if coalesce(p_role, '') not in ('admin', 'none') then
    raise exception 'Invalid CMS access role';
  end if;

  select role into v_current_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_current_role = 'super_admin' then
    raise exception 'The Super Admin account is protected';
  end if;

  update public.profiles
  set role = case when p_role = 'admin' then 'admin' else null end,
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Create an unprivileged profile for every account created in Supabase Auth.
-- Email is synced on account creation and email changes. No role is granted.
create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_profile_changed on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_profile();

create trigger on_auth_user_profile_changed
after update of email on auth.users
for each row
execute function public.handle_auth_user_profile();

commit;
