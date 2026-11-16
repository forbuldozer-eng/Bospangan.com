-- Bos Pangan inventory, suppliers, purchasing and moving-average HPP.
-- Apply after supabase/schema.sql and supabase/commerce-backend.sql.
-- All stock/cost mutations are performed through SECURITY DEFINER RPCs.
begin;

alter table public.products
  add column if not exists cost_price numeric(14,2) not null default 0
  check (cost_price >= 0);

-- Keep the category constraint aligned with the CMS category list (including Bebek).
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('Daging sapi','Ikan','Ayam','Sayuran','Minyak','Beras','Bumbu dapur','Buah','Bebek'));

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text not null unique,
  name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  tax_number text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_name_idx on public.suppliers(lower(name));
alter table public.suppliers enable row level security;
drop policy if exists "admins manage Bos Pangan suppliers" on public.suppliers;
create policy "admins manage Bos Pangan suppliers" on public.suppliers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.suppliers to authenticated;

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique default (
    'PO-' || to_char(now(),'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
  ),
  supplier_id uuid not null references public.suppliers(id),
  purchase_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft','received','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  additional_cost numeric(14,2) not null default 0 check (additional_cost >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  balance_due numeric(14,2) not null default 0 check (balance_due >= 0),
  notes text not null default '',
  received_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_amounts_check check (amount_paid <= total and balance_due = total - amount_paid)
);
create index if not exists purchase_orders_supplier_date_idx on public.purchase_orders(supplier_id,purchase_date desc);
create index if not exists purchase_orders_status_idx on public.purchase_orders(status,payment_status);
alter table public.purchase_orders enable row level security;
drop policy if exists "admins read Bos Pangan purchase orders" on public.purchase_orders;
create policy "admins read Bos Pangan purchase orders" on public.purchase_orders
  for select to authenticated using (public.is_admin());
grant select on public.purchase_orders to authenticated;

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  sku_snapshot text not null,
  product_name_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  line_subtotal numeric(14,2) not null check (line_subtotal >= 0),
  created_at timestamptz not null default now(),
  constraint purchase_item_received_check check (received_quantity <= quantity)
);
create index if not exists purchase_order_items_po_idx on public.purchase_order_items(purchase_order_id);
alter table public.purchase_order_items enable row level security;
drop policy if exists "admins read Bos Pangan purchase items" on public.purchase_order_items;
create policy "admins read Bos Pangan purchase items" on public.purchase_order_items
  for select to authenticated using (public.is_admin());
grant select on public.purchase_order_items to authenticated;

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id),
  supplier_id uuid not null references public.suppliers(id),
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'bank_transfer',
  reference_number text not null default '',
  notes text not null default '',
  paid_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists supplier_payments_po_idx on public.supplier_payments(purchase_order_id,paid_at desc);
alter table public.supplier_payments enable row level security;
drop policy if exists "admins read supplier payments" on public.supplier_payments;
create policy "admins read supplier payments" on public.supplier_payments
  for select to authenticated using (public.is_admin());
grant select on public.supplier_payments to authenticated;

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id),
  movement_type text not null check (movement_type in ('opening','purchase_in','adjustment_in','adjustment_out')),
  quantity_in numeric(14,3) not null default 0 check (quantity_in >= 0),
  quantity_out numeric(14,3) not null default 0 check (quantity_out >= 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  balance_quantity numeric(14,3) not null check (balance_quantity >= 0),
  balance_cost numeric(14,2) not null check (balance_cost >= 0),
  reference_type text not null default '',
  reference_id uuid,
  notes text not null default '',
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint inventory_movement_direction_check check (
    (quantity_in > 0 and quantity_out = 0) or
    (quantity_out > 0 and quantity_in = 0)
  )
);
create index if not exists inventory_movements_product_date_idx on public.inventory_movements(product_id,created_at desc);
alter table public.inventory_movements enable row level security;
drop policy if exists "admins read inventory movements" on public.inventory_movements;
create policy "admins read inventory movements" on public.inventory_movements
  for select to authenticated using (public.is_admin());
grant select on public.inventory_movements to authenticated;

create table if not exists public.product_cost_history (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id),
  previous_cost numeric(14,2) not null check (previous_cost >= 0),
  new_cost numeric(14,2) not null check (new_cost >= 0),
  previous_stock numeric(14,3) not null check (previous_stock >= 0),
  new_stock numeric(14,3) not null check (new_stock >= 0),
  source_type text not null,
  source_id uuid,
  notes text not null default '',
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists product_cost_history_product_date_idx on public.product_cost_history(product_id,created_at desc);
alter table public.product_cost_history enable row level security;
drop policy if exists "admins read product cost history" on public.product_cost_history;
create policy "admins read product cost history" on public.product_cost_history
  for select to authenticated using (public.is_admin());
grant select on public.product_cost_history to authenticated;

-- Create a draft purchase order and its item snapshots atomically.
create or replace function public.create_inventory_purchase(
  p_supplier_id uuid,
  p_purchase_date date,
  p_due_date date,
  p_additional_cost numeric,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_po_id uuid;
  v_line jsonb;
  v_product public.products%rowtype;
  v_qty numeric(14,3);
  v_cost numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_additional numeric(14,2) := greatest(coalesce(p_additional_cost,0),0);
begin
  if not public.is_admin() then raise exception 'Akses admin diperlukan'; end if;
  if not exists(select 1 from public.suppliers where id=p_supplier_id and is_active) then
    raise exception 'Supplier tidak ditemukan atau tidak aktif';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Minimal satu item pembelian harus diisi';
  end if;
  if v_additional <> coalesce(p_additional_cost,0) then raise exception 'Biaya tambahan tidak valid'; end if;

  for v_line in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_line->>'quantity')::numeric;
    v_cost := (v_line->>'unit_cost')::numeric;
    if v_qty <= 0 or v_cost < 0 then raise exception 'Kuantitas atau harga beli tidak valid'; end if;
    select * into v_product from public.products where id=(v_line->>'product_id')::uuid;
    if not found then raise exception 'Produk pembelian tidak ditemukan'; end if;
    v_subtotal := v_subtotal + round(v_qty*v_cost,2);
  end loop;

  insert into public.purchase_orders(supplier_id,purchase_date,due_date,subtotal,additional_cost,total,balance_due,notes,created_by)
  values(p_supplier_id,coalesce(p_purchase_date,current_date),p_due_date,v_subtotal,v_additional,v_subtotal+v_additional,v_subtotal+v_additional,coalesce(p_notes,''),(select auth.uid()))
  returning id into v_po_id;

  for v_line in select value from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_cost := (v_line->>'unit_cost')::numeric;
    insert into public.purchase_order_items(purchase_order_id,product_id,sku_snapshot,product_name_snapshot,unit_snapshot,quantity,unit_cost,line_subtotal)
    values(v_po_id,v_product.id,v_product.sku,v_product.name,v_product.unit,v_qty,v_cost,round(v_qty*v_cost,2));
  end loop;
  return v_po_id;
end;
$$;

-- Receive a purchase once. Allocates freight/other landed cost by line value,
-- then updates on-hand stock and the moving weighted-average cost atomically.
create or replace function public.receive_inventory_purchase(p_purchase_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_item public.purchase_order_items%rowtype;
  v_product public.products%rowtype;
  v_line_count integer;
  v_allocated numeric(14,2);
  v_landed_unit numeric(14,2);
  v_new_stock numeric(14,3);
  v_new_cost numeric(14,2);
  v_old_stock numeric(14,3);
  v_old_cost numeric(14,2);
begin
  if not public.is_admin() then raise exception 'Akses admin diperlukan'; end if;
  select * into v_po from public.purchase_orders where id=p_purchase_order_id for update;
  if not found then raise exception 'Pembelian tidak ditemukan'; end if;
  if v_po.status <> 'draft' then raise exception 'Hanya pembelian draft yang dapat diterima'; end if;
  select count(*) into v_line_count from public.purchase_order_items where purchase_order_id=v_po.id;
  if v_line_count=0 then raise exception 'Pembelian tidak memiliki item'; end if;

  for v_item in
    select * from public.purchase_order_items where purchase_order_id=v_po.id order by product_id for update
  loop
    select * into v_product from public.products where id=v_item.product_id for update;
    if not found then raise exception 'Produk % tidak ditemukan',v_item.product_name_snapshot; end if;
    if v_po.subtotal > 0 then
      v_allocated := round(v_po.additional_cost*(v_item.line_subtotal/v_po.subtotal),2);
    else
      v_allocated := round(v_po.additional_cost/v_line_count,2);
    end if;
    v_landed_unit := round(v_item.unit_cost + (v_allocated/v_item.quantity),2);
    v_old_stock := v_product.stock;
    v_old_cost := v_product.cost_price;
    v_new_stock := v_old_stock + v_item.quantity;
    if v_new_stock <= 0 then raise exception 'Stok akhir tidak valid'; end if;
    if v_old_stock=0 then
      v_new_cost := v_landed_unit;
    else
      v_new_cost := round(((v_old_stock*v_old_cost)+(v_item.quantity*v_landed_unit))/v_new_stock,2);
    end if;

    update public.products set stock=v_new_stock,cost_price=v_new_cost,updated_at=now() where id=v_product.id;
    update public.purchase_order_items set received_quantity=quantity where id=v_item.id;
    insert into public.inventory_movements(product_id,movement_type,quantity_in,unit_cost,balance_quantity,balance_cost,reference_type,reference_id,notes,actor_id)
    values(v_product.id,'purchase_in',v_item.quantity,v_landed_unit,v_new_stock,v_new_cost,'purchase_order',v_po.id,'Penerimaan '+v_po.purchase_number,(select auth.uid()));
    insert into public.product_cost_history(product_id,previous_cost,new_cost,previous_stock,new_stock,source_type,source_id,notes,actor_id)
    values(v_product.id,v_old_cost,v_new_cost,v_old_stock,v_new_stock,'purchase',v_po.id,'Moving average dari '+v_po.purchase_number,(select auth.uid()));
  end loop;

  update public.purchase_orders set status='received',received_at=now(),updated_at=now() where id=v_po.id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'receive_inventory_purchase','purchase_order',v_po.id::text,
    jsonb_build_object('purchase_number',v_po.purchase_number,'supplier_id',v_po.supplier_id,'total',v_po.total));
end;
$$;

create or replace function public.record_supplier_payment(
  p_purchase_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text default '',
  p_notes text default ''
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_payment_id uuid;
  v_new_paid numeric(14,2);
begin
  if not public.is_admin() then raise exception 'Akses admin diperlukan'; end if;
  if coalesce(p_amount,0)<=0 then raise exception 'Nominal pembayaran harus lebih dari nol'; end if;
  select * into v_po from public.purchase_orders where id=p_purchase_order_id for update;
  if not found or v_po.status<>'received' then raise exception 'Pembelian belum diterima atau tidak ditemukan'; end if;
  if p_amount>v_po.balance_due then raise exception 'Pembayaran melebihi sisa hutang'; end if;
  insert into public.supplier_payments(purchase_order_id,supplier_id,amount,payment_method,reference_number,notes,created_by)
  values(v_po.id,v_po.supplier_id,p_amount,coalesce(nullif(p_payment_method,''),'bank_transfer'),coalesce(p_reference_number,''),coalesce(p_notes,''),(select auth.uid()))
  returning id into v_payment_id;
  v_new_paid:=v_po.amount_paid+p_amount;
  update public.purchase_orders
  set amount_paid=v_new_paid,balance_due=total-v_new_paid,
      payment_status=case when v_new_paid>=total then 'paid' when v_new_paid>0 then 'partial' else 'unpaid' end,
      updated_at=now()
  where id=v_po.id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'record_supplier_payment','supplier_payment',v_payment_id::text,
    jsonb_build_object('purchase_order_id',v_po.id,'amount',p_amount,'method',p_payment_method));
  return v_payment_id;
end;
$$;

-- Seed the valuation of pre-existing on-hand stock exactly once. The quantity is
-- not changed; the administrator supplies the verified opening unit cost.
create or replace function public.set_product_opening_cost(
  p_product_id uuid,
  p_unit_cost numeric,
  p_notes text
) returns void
language plpgsql security definer set search_path = ''
as $
declare
  v_product public.products%rowtype;
begin
  if not public.is_admin() then raise exception 'Akses admin diperlukan'; end if;
  if coalesce(p_unit_cost,-1)<0 then raise exception 'Harga modal awal tidak valid'; end if;
  if coalesce(trim(p_notes),'')='' then raise exception 'Catatan sumber harga modal wajib diisi'; end if;
  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'Produk tidak ditemukan'; end if;
  if v_product.stock<=0 then raise exception 'Produk tidak memiliki stok awal untuk dinilai'; end if;
  if v_product.cost_price>0 or exists(select 1 from public.inventory_movements where product_id=p_product_id) then
    raise exception 'Harga modal awal sudah pernah ditetapkan; gunakan penyesuaian persediaan';
  end if;
  update public.products set cost_price=round(p_unit_cost,2),updated_at=now() where id=p_product_id;
  insert into public.inventory_movements(product_id,movement_type,quantity_in,unit_cost,balance_quantity,balance_cost,reference_type,notes,actor_id)
  values(p_product_id,'opening',v_product.stock,round(p_unit_cost,2),v_product.stock,round(p_unit_cost,2),'opening_valuation',p_notes,(select auth.uid()));
  insert into public.product_cost_history(product_id,previous_cost,new_cost,previous_stock,new_stock,source_type,notes,actor_id)
  values(p_product_id,0,round(p_unit_cost,2),v_product.stock,v_product.stock,'opening_valuation',p_notes,(select auth.uid()));
end;
$;

-- Record opening stock or a controlled stock adjustment; direct browser writes
-- to products.stock/cost_price are not granted by this migration.
create or replace function public.adjust_inventory_stock(
  p_product_id uuid,
  p_quantity_delta numeric,
  p_unit_cost numeric,
  p_reason text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_new_stock numeric(14,3);
  v_new_cost numeric(14,2);
  v_old_stock numeric(14,3);
  v_old_cost numeric(14,2);
  v_movement text;
begin
  if not public.is_admin() then raise exception 'Akses admin diperlukan'; end if;
  if coalesce(p_quantity_delta,0)=0 then raise exception 'Perubahan stok tidak boleh nol'; end if;
  if p_quantity_delta>0 and coalesce(p_unit_cost,-1)<0 then raise exception 'Harga modal wajib diisi untuk stok masuk'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'Alasan penyesuaian wajib diisi'; end if;
  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'Produk tidak ditemukan'; end if;
  v_old_stock:=v_product.stock; v_old_cost:=v_product.cost_price;
  v_new_stock:=v_old_stock+p_quantity_delta;
  if v_new_stock<0 then raise exception 'Stok tidak mencukupi untuk penyesuaian keluar'; end if;
  if p_quantity_delta>0 then
    if v_old_stock=0 then v_new_cost:=round(p_unit_cost,2);
    else v_new_cost:=round(((v_old_stock*v_old_cost)+(p_quantity_delta*p_unit_cost))/v_new_stock,2);
    end if;
    v_movement:='adjustment_in';
  else
    v_new_cost:=v_old_cost;
    v_movement:='adjustment_out';
  end if;
  update public.products set stock=v_new_stock,cost_price=v_new_cost,updated_at=now() where id=v_product.id;
  insert into public.inventory_movements(product_id,movement_type,quantity_in,quantity_out,unit_cost,balance_quantity,balance_cost,reference_type,notes,actor_id)
  values(v_product.id,v_movement,greatest(p_quantity_delta,0),greatest(-p_quantity_delta,0),case when p_quantity_delta>0 then p_unit_cost else v_old_cost end,v_new_stock,v_new_cost,'manual_adjustment',p_reason,(select auth.uid()));
  insert into public.product_cost_history(product_id,previous_cost,new_cost,previous_stock,new_stock,source_type,notes,actor_id)
  values(v_product.id,v_old_cost,v_new_cost,v_old_stock,v_new_stock,'adjustment',p_reason,(select auth.uid()));
end;
$$;

revoke all on function public.set_product_opening_cost(uuid,numeric,text) from public;
revoke all on function public.create_inventory_purchase(uuid,date,date,numeric,text,jsonb) from public;
revoke all on function public.receive_inventory_purchase(uuid) from public;
revoke all on function public.record_supplier_payment(uuid,numeric,text,text,text) from public;
revoke all on function public.adjust_inventory_stock(uuid,numeric,numeric,text) from public;
grant execute on function public.set_product_opening_cost(uuid,numeric,text) to authenticated;
grant execute on function public.create_inventory_purchase(uuid,date,date,numeric,text,jsonb) to authenticated;
grant execute on function public.receive_inventory_purchase(uuid) to authenticated;
grant execute on function public.record_supplier_payment(uuid,numeric,text,text,text) to authenticated;
grant execute on function public.adjust_inventory_stock(uuid,numeric,numeric,text) to authenticated;

-- Authenticated admins can read financial inventory records only; writes go through RPCs.
revoke insert, update, delete on public.purchase_orders,public.purchase_order_items,public.supplier_payments,public.inventory_movements,public.product_cost_history from anon,authenticated;
revoke all on public.purchase_orders,public.purchase_order_items,public.supplier_payments,public.inventory_movements,public.product_cost_history from anon;
grant select on public.purchase_orders,public.purchase_order_items,public.supplier_payments,public.inventory_movements,public.product_cost_history to authenticated;

commit;
