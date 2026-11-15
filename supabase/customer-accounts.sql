-- Bos Pangan customer accounts migration.
-- Run once in Supabase SQL Editor AFTER schema.sql, commerce-backend.sql,
-- and checkout.sql have been applied.
-- Public sign-up can assign only the customer role. It can never grant CMS access.

begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('customer', 'admin', 'super_admin'));

-- Keep CMS role management restricted to Super Admin. A Super Admin may
-- promote a customer to Admin or return an Admin to the customer role.
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

  if coalesce(p_role, '') not in ('admin', 'customer', 'none') then
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
  set role = case
        when p_role in ('admin', 'customer') then p_role
        else null
      end,
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Only the exact website signup marker grants the customer role.
-- User-supplied metadata can never assign admin or super_admin.
create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    case
      when new.raw_user_meta_data ->> 'signup_source' = 'bospangan_customer'
        then 'customer'
      else null
    end
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

-- A signed-in user may claim only their own unassigned profile as a customer.
-- Existing Admin/Super Admin roles are returned unchanged and cannot be downgraded.
create or replace function public.ensure_customer_profile(p_display_name text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_name text := left(trim(coalesce(p_display_name, '')), 120);
begin
  if v_user_id is null then
    raise exception 'Login is required';
  end if;

  select role into v_role
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Customer profile not found';
  end if;

  if v_role is null then
    update public.profiles
    set role = 'customer',
        display_name = case when v_name <> '' then v_name else display_name end,
        updated_at = now()
    where id = v_user_id
    returning role into v_role;
  elsif v_role = 'customer' then
    if v_name <> '' then
      update public.profiles
      set display_name = v_name,
          updated_at = now()
      where id = v_user_id;
    end if;
  elsif v_role not in ('admin', 'super_admin') then
    raise exception 'Account role is not permitted';
  end if;

  return v_role;
end;
$$;

revoke all on function public.ensure_customer_profile(text) from public;
grant execute on function public.ensure_customer_profile(text) to authenticated;

create or replace function public.is_customer()
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
      and role = 'customer'
  );
$$;

revoke all on function public.is_customer() from public;
grant execute on function public.is_customer() to authenticated;

-- Customers can read only orders explicitly linked to their own Auth user ID.
-- They cannot update order status, payment state, totals, or admin notes.
create index if not exists orders_customer_id_created_at_idx
  on public.orders(customer_id, created_at desc);

drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders"
on public.orders
for select
to authenticated
using (customer_id = (select auth.uid()) and public.is_customer());

-- Customers can read only line items belonging to their own orders.
drop policy if exists "customers read own order items" on public.order_items;
create policy "customers read own order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.customer_id = (select auth.uid())
  )
);

-- Safely link a guest-checkout order to the signed-in customer only when
-- the order email matches the verified email in the customer's access token.
create or replace function public.attach_order_to_current_customer(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_role text;
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Customer login is required';
  end if;

  select role into v_role
  from public.profiles
  where id = v_user_id;

  if coalesce(v_role, '') <> 'customer' then
    raise exception 'Only customer accounts can link orders';
  end if;

  update public.orders
  set customer_id = v_user_id,
      updated_at = now()
  where id = p_order_id
    and lower(customer_email) = v_email
    and (customer_id is null or customer_id = v_user_id);

  if not found then
    raise exception 'Order not found or customer email does not match';
  end if;
end;
$$;

revoke all on function public.attach_order_to_current_customer(uuid) from public;
grant execute on function public.attach_order_to_current_customer(uuid) to authenticated;

commit;

-- Refresh PostgREST so the new customer RPCs are immediately discoverable.
NOTIFY pgrst, 'reload schema';
