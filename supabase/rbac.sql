-- Bos Pangan RBAC foundation.
-- Apply after schema.sql, commerce-backend.sql, and checkout.sql.
-- Existing admin/super_admin accounts retain their current full access.
-- Custom roles receive only the permissions explicitly mapped below.

begin;

create table if not exists public.cms_roles (
  role_code text primary key,
  role_name text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cms_permissions (
  permission_key text primary key,
  description text not null default ''
);

create table if not exists public.cms_role_permissions (
  role_code text not null references public.cms_roles(role_code) on delete cascade,
  permission_key text not null references public.cms_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_code, permission_key)
);

alter table public.cms_roles enable row level security;
alter table public.cms_permissions enable row level security;
alter table public.cms_role_permissions enable row level security;

revoke all on public.cms_roles, public.cms_permissions, public.cms_role_permissions from anon, authenticated;

insert into public.cms_roles(role_code, role_name, description) values
  ('super_admin', 'Super Admin', 'Akses penuh dan pengelolaan seluruh hak akses.'),
  ('admin', 'Admin', 'Akses penuh operasional CMS.'),
  ('product_manager', 'Product Manager', 'Mengelola katalog dan informasi produk.'),
  ('warehouse_manager', 'Warehouse Manager', 'Mengelola stok dan melihat kebutuhan pesanan.'),
  ('order_manager', 'Order Manager', 'Mengelola pesanan dan transaksi.'),
  ('customer_service', 'Customer Service', 'Melihat pelanggan dan menangani pesanan.'),
  ('marketing_manager', 'Marketing Manager', 'Mengelola campaign dan notifikasi pemasaran.'),
  ('finance_manager', 'Finance Manager', 'Melihat transaksi dan laporan keuangan.'),
  ('customer', 'Pelanggan', 'Akun pelanggan tanpa akses CMS.')
on conflict (role_code) do update
set role_name = excluded.role_name,
    description = excluded.description;

insert into public.cms_permissions(permission_key, description) values
  ('products.view', 'Melihat katalog dan detail produk'),
  ('products.create', 'Membuat produk'),
  ('products.update', 'Mengubah produk'),
  ('products.delete', 'Menghapus produk'),
  ('inventory.view', 'Melihat persediaan'),
  ('inventory.update', 'Mengubah persediaan'),
  ('orders.view', 'Melihat pesanan dan rincian transaksi'),
  ('orders.update', 'Memperbarui status pesanan'),
  ('customers.view', 'Melihat data pelanggan'),
  ('marketing.view', 'Melihat campaign pemasaran'),
  ('marketing.manage', 'Membuat dan mengelola campaign pemasaran'),
  ('notifications.view', 'Melihat log notifikasi'),
  ('finance.view', 'Melihat informasi transaksi dan keuangan'),
  ('settings.manage', 'Mengelola pengaturan toko'),
  ('users.view', 'Melihat daftar akun dan hak akses'),
  ('audit.view', 'Melihat catatan aktivitas administrator')
on conflict (permission_key) do update
set description = excluded.description;

-- Product Manager
insert into public.cms_role_permissions(role_code, permission_key)
select 'product_manager', permission_key
from public.cms_permissions
where permission_key in ('products.view','products.create','products.update','products.delete','inventory.view')
on conflict do nothing;

-- Warehouse Manager
insert into public.cms_role_permissions(role_code, permission_key) values
  ('warehouse_manager','products.view'),
  ('warehouse_manager','inventory.view'),
  ('warehouse_manager','inventory.update'),
  ('warehouse_manager','orders.view')
on conflict do nothing;

-- Order Manager
insert into public.cms_role_permissions(role_code, permission_key) values
  ('order_manager','products.view'),
  ('order_manager','inventory.view'),
  ('order_manager','orders.view'),
  ('order_manager','orders.update'),
  ('order_manager','customers.view')
on conflict do nothing;

-- Customer Service
insert into public.cms_role_permissions(role_code, permission_key) values
  ('customer_service','orders.view'),
  ('customer_service','orders.update'),
  ('customer_service','customers.view'),
  ('customer_service','products.view')
on conflict do nothing;

-- Marketing Manager
insert into public.cms_role_permissions(role_code, permission_key) values
  ('marketing_manager','products.view'),
  ('marketing_manager','marketing.view'),
  ('marketing_manager','marketing.manage'),
  ('marketing_manager','notifications.view')
on conflict do nothing;

-- Finance Manager
insert into public.cms_role_permissions(role_code, permission_key) values
  ('finance_manager','orders.view'),
  ('finance_manager','finance.view'),
  ('finance_manager','customers.view')
on conflict do nothing;

-- Extend the profile role constraint without changing existing assignments.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null or role in (
      'customer','admin','super_admin','product_manager',
      'warehouse_manager','order_manager','customer_service',
      'marketing_manager','finance_manager'
    )
  );

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      join public.cms_role_permissions rp on rp.role_code = p.role
      where p.id = (select auth.uid())
        and rp.permission_key = p_permission
    );
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

-- Warehouse stock changes use a dedicated RPC so inventory users cannot
-- alter product prices, tax, publication state, or other catalog fields.
create or replace function public.update_product_stock(p_product_id uuid, p_new_stock numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $
begin
  if not public.has_permission('inventory.update') then
    raise exception 'You do not have permission to update inventory';
  end if;
  if p_new_stock is null or p_new_stock < 0 or p_new_stock > 999999999 then
    raise exception 'Stock value is invalid';
  end if;

  update public.products
  set stock = p_new_stock,
      updated_at = now()
  where id = p_product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'stock_updated',
    'product',
    p_product_id::text,
    jsonb_build_object('new_stock', p_new_stock)
  );
end;
$;

revoke all on function public.update_product_stock(uuid, numeric) from public;
grant execute on function public.update_product_stock(uuid, numeric) to authenticated;

create or replace function public.get_my_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then coalesce(
      (select array_agg(permission_key order by permission_key) from public.cms_permissions),
      array[]::text[]
    )
    else coalesce(
      (
        select array_agg(rp.permission_key order by rp.permission_key)
        from public.profiles p
        join public.cms_role_permissions rp on rp.role_code = p.role
        where p.id = (select auth.uid())
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.get_my_permissions() from public;
grant execute on function public.get_my_permissions() to authenticated;

-- Only Super Admin can assign any CMS role. Super Admin accounts stay protected.
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role text;
  v_new_role text;
begin
  if not public.is_super_admin() then
    raise exception 'Only the Super Admin can manage CMS access';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'The Super Admin cannot change their own access here';
  end if;

  if coalesce(p_role, '') not in (
    'admin','customer','none','product_manager','warehouse_manager',
    'order_manager','customer_service','marketing_manager','finance_manager'
  ) then
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

  v_new_role := case when p_role = 'none' then null else p_role end;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_user_id;

  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'role_changed',
    'profile',
    p_user_id::text,
    jsonb_build_object('previous_role', v_current_role, 'new_role', v_new_role)
  );
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Profiles are visible to their owner and users with explicit user-list permission.
drop policy if exists "admins read profiles" on public.profiles;
drop policy if exists "users read own profile or authorized directory" on public.profiles;
create policy "users read own profile or authorized directory"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.has_permission('users.view'));

-- Product permissions. Public visitors continue to see published products only.
drop policy if exists "public reads published products" on public.products;
drop policy if exists "admins manage products" on public.products;
drop policy if exists "public and authorized users read products" on public.products;
create policy "public and authorized users read products"
on public.products for select to anon, authenticated
using (is_published or public.has_permission('products.view'));
drop policy if exists "authorized users create products" on public.products;
create policy "authorized users create products"
on public.products for insert to authenticated
with check (public.has_permission('products.create'));
drop policy if exists "authorized users update products" on public.products;
create policy "authorized users update products"
on public.products for update to authenticated
using (public.has_permission('products.update'))
with check (public.has_permission('products.update'));
drop policy if exists "authorized users delete products" on public.products;
create policy "authorized users delete products"
on public.products for delete to authenticated
using (public.has_permission('products.delete'));

-- Product Manager may edit catalog fields but cannot alter stock.
-- Stock changes are reserved for Warehouse Manager through update_product_stock().
create or replace function public.enforce_product_stock_permissions()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  if not public.is_admin()
     and new.stock is distinct from old.stock
     and not public.has_permission('inventory.update') then
    raise exception 'Only users with inventory.update may change product stock';
  end if;
  return new;
end;
$;

drop trigger if exists trg_enforce_product_stock_permissions on public.products;
create trigger trg_enforce_product_stock_permissions
before update on public.products
for each row execute function public.enforce_product_stock_permissions();

-- Order permissions. Public checkout remains exclusively through the server function.
drop policy if exists "admins manage orders" on public.orders;
drop policy if exists "authorized users read orders" on public.orders;
create policy "authorized users read orders"
on public.orders for select to authenticated
using (
  public.has_permission('orders.view')
  or public.has_permission('finance.view')
  or public.has_permission('customers.view')
);
drop policy if exists "authorized users update orders" on public.orders;
create policy "authorized users update orders"
on public.orders for update to authenticated
using (public.has_permission('orders.update'))
with check (public.has_permission('orders.update'));

-- Custom order roles may change workflow status only; financial totals,
-- payment status, customer data, and order snapshots remain protected.
create or replace function public.enforce_order_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if not public.is_admin() then
    if not public.has_permission('orders.update') then
      raise exception 'You do not have permission to update orders';
    end if;
    if new.id is distinct from old.id
      or new.order_number is distinct from old.order_number
      or new.customer_id is distinct from old.customer_id
      or new.customer_name is distinct from old.customer_name
      or new.customer_email is distinct from old.customer_email
      or new.customer_phone is distinct from old.customer_phone
      or new.customer_address is distinct from old.customer_address
      or new.transaction_type is distinct from old.transaction_type
      or new.special_request is distinct from old.special_request
      or new.subtotal is distinct from old.subtotal
      or new.tax_percent is distinct from old.tax_percent
      or new.tax_amount is distinct from old.tax_amount
      or new.total is distinct from old.total
      or new.payment_status is distinct from old.payment_status
      or new.admin_note is distinct from old.admin_note
      or new.created_at is distinct from old.created_at
    then
      raise exception 'This role may update order status only';
    end if;
  end if;
  return new;
end;
$;

drop trigger if exists trg_enforce_order_update_permissions on public.orders;
create trigger trg_enforce_order_update_permissions
before update on public.orders
for each row execute function public.enforce_order_update_permissions();

drop policy if exists "admins manage order items" on public.order_items;
drop policy if exists "authorized users manage order items" on public.order_items;
drop policy if exists "authorized users read order items" on public.order_items;
create policy "authorized users read order items"
on public.order_items for select to authenticated
using (
  public.has_permission('orders.view')
  or public.has_permission('finance.view')
  or public.has_permission('customers.view')
);

-- Campaigns are limited to the marketing permission.
drop policy if exists "admins manage product campaigns" on public.product_campaigns;
drop policy if exists "authorized users read campaigns" on public.product_campaigns;
create policy "authorized users read campaigns"
on public.product_campaigns for select to authenticated
using (public.has_permission('marketing.view'));
drop policy if exists "authorized users create campaigns" on public.product_campaigns;
create policy "authorized users create campaigns"
on public.product_campaigns for insert to authenticated
with check (public.has_permission('marketing.manage'));
drop policy if exists "authorized users update campaigns" on public.product_campaigns;
create policy "authorized users update campaigns"
on public.product_campaigns for update to authenticated
using (public.has_permission('marketing.manage'))
with check (public.has_permission('marketing.manage'));
drop policy if exists "authorized users delete campaigns" on public.product_campaigns;
create policy "authorized users delete campaigns"
on public.product_campaigns for delete to authenticated
using (public.has_permission('marketing.manage'));

-- Marketing contacts and notification history.
drop policy if exists "admins manage notification preferences" on public.notification_preferences;
drop policy if exists "authorized users read notification preferences" on public.notification_preferences;
create policy "authorized users read notification preferences"
on public.notification_preferences for select to authenticated
using (public.has_permission('marketing.view') or public.has_permission('customers.view'));
drop policy if exists "marketing users manage notification preferences" on public.notification_preferences;
create policy "marketing users manage notification preferences"
on public.notification_preferences for all to authenticated
using (public.has_permission('marketing.manage'))
with check (public.has_permission('marketing.manage'));

drop policy if exists "admins read notification queue" on public.notification_queue;
drop policy if exists "authorized users read notification queue" on public.notification_queue;
create policy "authorized users read notification queue"
on public.notification_queue for select to authenticated
using (public.has_permission('notifications.view'));

drop policy if exists "admins manage product subscriptions" on public.product_notification_subscriptions;
drop policy if exists "authorized users read product subscriptions" on public.product_notification_subscriptions;
create policy "authorized users read product subscriptions"
on public.product_notification_subscriptions for select to authenticated
using (public.has_permission('marketing.view') or public.has_permission('customers.view'));
drop policy if exists "marketing users manage product subscriptions" on public.product_notification_subscriptions;
create policy "marketing users manage product subscriptions"
on public.product_notification_subscriptions for all to authenticated
using (public.has_permission('marketing.manage'))
with check (public.has_permission('marketing.manage'));

-- Audit log remains read-only from the browser.
drop policy if exists "admins read audit log" on public.admin_audit_log;
drop policy if exists "authorized users read audit log" on public.admin_audit_log;
create policy "authorized users read audit log"
on public.admin_audit_log for select to authenticated
using (public.has_permission('audit.view'));

-- Product media permissions follow product permissions.
drop policy if exists "admins upload Bos Pangan product images" on storage.objects;
drop policy if exists "admins update Bos Pangan product images" on storage.objects;
drop policy if exists "admins delete Bos Pangan product images" on storage.objects;
drop policy if exists "authorized users upload Bos Pangan product images" on storage.objects;
create policy "authorized users upload Bos Pangan product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.has_permission('products.create'));
drop policy if exists "authorized users update Bos Pangan product images" on storage.objects;
create policy "authorized users update Bos Pangan product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.has_permission('products.update'))
with check (bucket_id = 'product-images' and public.has_permission('products.update'));
drop policy if exists "authorized users delete Bos Pangan product images" on storage.objects;
create policy "authorized users delete Bos Pangan product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.has_permission('products.delete'));

commit;
