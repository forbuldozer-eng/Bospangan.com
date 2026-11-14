-- Bos Pangan public checkout migration.
-- Run after schema.sql and commerce-backend.sql.
-- Orders are created only through the create-order Edge Function (service role).

begin;

alter table public.orders
  add column if not exists customer_address text not null default '',
  add column if not exists idempotency_key uuid;

create unique index if not exists orders_idempotency_key_uidx
  on public.orders(idempotency_key)
  where idempotency_key is not null;

alter table public.order_items
  add column if not exists tax_percent numeric(5,2) not null default 0
    check (tax_percent between 0 and 100),
  add column if not exists tax_amount numeric(14,2) not null default 0
    check (tax_amount >= 0);

-- Prevent public clients from bypassing server-side price, tax, stock and
-- rate-limit validation by inserting directly into orders.
revoke insert on public.orders from anon, authenticated;

create table if not exists public.checkout_rate_limits (
  fingerprint text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);
alter table public.checkout_rate_limits enable row level security;
revoke all on public.checkout_rate_limits from anon, authenticated;

-- The storefront can read only the default tax rate, never the owner's email
-- or the other private store settings.
create or replace function public.get_public_default_tax_percent()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((value #>> '{}')::numeric, 0)
  from public.store_settings
  where key = 'default_tax_percent'
  limit 1;
$$;

revoke all on function public.get_public_default_tax_percent() from public;
grant execute on function public.get_public_default_tax_percent() to anon, authenticated;

-- Atomic checkout: validates product publication/stock, snapshots price and tax,
-- creates the order and lines, and reserves stock in one database transaction.
create or replace function public.submit_storefront_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_address text,
  p_transaction_type text,
  p_special_request text,
  p_items jsonb,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.orders%rowtype;
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_saved_item jsonb;
  v_item_rows jsonb := '[]'::jsonb;
  v_seen_ids uuid[] := array[]::uuid[];
  v_product_id uuid;
  v_quantity numeric(14,3);
  v_rate numeric(5,2);
  v_line_subtotal numeric(14,2);
  v_line_tax numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_tax_amount numeric(14,2) := 0;
  v_default_tax numeric(5,2) := 0;
  v_effective_tax numeric(5,2) := 0;
  v_request_type text := lower(trim(coalesce(p_transaction_type, 'regular')));
  v_special_request text := trim(coalesce(p_special_request, ''));
  v_customer_name text := trim(coalesce(p_customer_name, ''));
  v_customer_email text := lower(trim(coalesce(p_customer_email, '')));
  v_customer_phone text := trim(coalesce(p_customer_phone, ''));
  v_customer_address text := trim(coalesce(p_customer_address, ''));
  v_count integer;
begin
  if p_idempotency_key is null then
    raise exception 'Kunci transaksi tidak valid.';
  end if;

  select * into v_existing
  from public.orders
  where idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'duplicate', true,
      'order', jsonb_build_object(
        'id', v_existing.id,
        'order_number', v_existing.order_number,
        'subtotal', v_existing.subtotal,
        'tax_percent', v_existing.tax_percent,
        'tax_amount', v_existing.tax_amount,
        'total', v_existing.total,
        'status', v_existing.status,
        'transaction_type', v_existing.transaction_type
      )
    );
  end if;

  if length(v_customer_name) < 2 or length(v_customer_name) > 120
     or v_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(v_customer_phone) < 7 or length(v_customer_phone) > 32 then
    raise exception 'Nama, email, dan nomor telepon yang valid wajib diisi.';
  end if;

  if v_request_type not in ('regular', 'special') then
    raise exception 'Jenis transaksi tidak valid.';
  end if;

  if v_request_type = 'regular' and length(v_customer_address) < 8 then
    raise exception 'Alamat pengiriman minimal 8 karakter wajib diisi untuk pesanan reguler.';
  end if;

  if v_request_type = 'special' and length(v_special_request) < 10 then
    raise exception 'Jelaskan kebutuhan transaksi khusus minimal 10 karakter.';
  end if;

  if coalesce(jsonb_typeof(p_items), 'array') <> 'array' then
    raise exception 'Daftar produk tidak valid.';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 50 then
    raise exception 'Daftar produk melebihi 50 item.';
  end if;

  if v_request_type = 'regular' and jsonb_array_length(coalesce(p_items, '[]'::jsonb)) < 1 then
    raise exception 'Keranjang pesanan masih kosong.';
  end if;

  if p_request_fingerprint is not null and p_request_fingerprint ~ '^[a-f0-9]{64}$' then
    insert into public.checkout_rate_limits(fingerprint, window_started_at, request_count)
    values (p_request_fingerprint, now(), 1)
    on conflict (fingerprint) do update
      set window_started_at = case
            when public.checkout_rate_limits.window_started_at < now() - interval '10 minutes'
              then now()
            else public.checkout_rate_limits.window_started_at
          end,
          request_count = case
            when public.checkout_rate_limits.window_started_at < now() - interval '10 minutes'
              then 1
            else public.checkout_rate_limits.request_count + 1
          end
    returning request_count into v_count;

    if v_count > 10 then
      raise exception 'Terlalu banyak percobaan checkout. Silakan coba lagi beberapa menit kemudian.';
    end if;
  end if;

  select coalesce((value #>> '{}')::numeric, 0)
    into v_default_tax
  from public.store_settings
  where key = 'default_tax_percent';

  v_default_tax := greatest(0, least(100, coalesce(v_default_tax, 0)));

  -- Lock selected products in a consistent order to avoid overselling.
  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as items(value)
    order by value->>'product_id'
  loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::numeric;
    exception when others then
      raise exception 'Produk atau jumlah pesanan tidak valid.';
    end;

    if v_product_id = any(v_seen_ids) then
      raise exception 'Produk yang sama terduplikasi dalam keranjang.';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_product_id);

    select * into v_product
    from public.products
    where id = v_product_id and is_published = true
    for update;

    if not found then
      raise exception 'Salah satu produk sudah tidak tersedia.';
    end if;
    if v_quantity is null or v_quantity <= 0 or v_quantity > 100000 then
      raise exception 'Jumlah produk tidak valid.';
    end if;
    if v_request_type = 'regular' and v_product.stock < v_quantity then
      raise exception 'Stok tidak mencukupi untuk %.', v_product.name;
    end if;

    v_rate := coalesce(v_product.tax_percent, v_default_tax);
    v_line_subtotal := round(v_product.price * v_quantity, 2);
    v_line_tax := round(v_line_subtotal * v_rate / 100, 2);
    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_amount := v_tax_amount + v_line_tax;

    v_item_rows := v_item_rows || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'sku', v_product.sku,
      'name', v_product.name,
      'unit_price', v_product.price,
      'quantity', v_quantity,
      'line_subtotal', v_line_subtotal,
      'tax_percent', v_rate,
      'tax_amount', v_line_tax
    ));
  end loop;

  if v_subtotal > 0 then
    v_effective_tax := round((v_tax_amount / v_subtotal) * 100, 2);
  else
    v_effective_tax := v_default_tax;
  end if;

  insert into public.orders(
    customer_id, customer_name, customer_email, customer_phone, customer_address,
    transaction_type, special_request, subtotal, tax_percent, tax_amount, total,
    status, payment_status, idempotency_key
  ) values (
    null, v_customer_name, v_customer_email, v_customer_phone, v_customer_address,
    v_request_type, v_special_request, v_subtotal, v_effective_tax, v_tax_amount,
    v_subtotal + v_tax_amount,
    case when v_request_type = 'special' then 'quoted' else 'new' end,
    'unpaid', p_idempotency_key
  )
  returning * into v_order;

  for v_saved_item in
    select value from jsonb_array_elements(v_item_rows) as saved(value)
  loop
    insert into public.order_items(
      order_id, product_id, sku_snapshot, product_name_snapshot,
      unit_price, quantity, line_subtotal, tax_percent, tax_amount
    ) values (
      v_order.id,
      (v_saved_item->>'product_id')::uuid,
      v_saved_item->>'sku',
      v_saved_item->>'name',
      (v_saved_item->>'unit_price')::numeric,
      (v_saved_item->>'quantity')::numeric,
      (v_saved_item->>'line_subtotal')::numeric,
      (v_saved_item->>'tax_percent')::numeric,
      (v_saved_item->>'tax_amount')::numeric
    );

    if v_request_type = 'regular' then
      update public.products
      set stock = stock - (v_saved_item->>'quantity')::numeric,
          updated_at = now()
      where id = (v_saved_item->>'product_id')::uuid;
    end if;
  end loop;

  return jsonb_build_object(
    'duplicate', false,
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'subtotal', v_order.subtotal,
      'tax_percent', v_order.tax_percent,
      'tax_amount', v_order.tax_amount,
      'total', v_order.total,
      'status', v_order.status,
      'transaction_type', v_order.transaction_type
    )
  );
end;
$$;

revoke all on function public.submit_storefront_order(
  text, text, text, text, text, text, jsonb, uuid, text
) from public, anon, authenticated;
grant execute on function public.submit_storefront_order(
  text, text, text, text, text, text, jsonb, uuid, text
) to service_role;

-- A cancelled regular order returns its reserved stock exactly once.
create or replace function public.restore_stock_for_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Pesanan yang sudah dibatalkan tidak dapat dibuka kembali. Buat pesanan baru.';
  end if;

  if old.status is distinct from new.status
     and new.status = 'cancelled'
     and old.status in ('new', 'confirmed', 'processing')
     and old.transaction_type = 'regular' then
    update public.products p
    set stock = p.stock + oi.quantity,
        updated_at = now()
    from public.order_items oi
    where oi.order_id = new.id
      and oi.product_id = p.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restore_stock_for_cancelled_order on public.orders;
create trigger trg_restore_stock_for_cancelled_order
after update of status on public.orders
for each row execute function public.restore_stock_for_cancelled_order();

commit;
