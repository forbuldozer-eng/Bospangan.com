-- Shipping integration foundation for Bos Pangan (Biteship multi-courier).
-- Apply manually after reviewing on the intended Supabase project.
begin;

alter table public.products
  add column if not exists weight_grams integer not null default 1000
    check (weight_grams > 0 and weight_grams <= 1000000),
  add column if not exists length_cm numeric(8,2) not null default 10
    check (length_cm > 0 and length_cm <= 500),
  add column if not exists width_cm numeric(8,2) not null default 10
    check (width_cm > 0 and width_cm <= 500),
  add column if not exists height_cm numeric(8,2) not null default 10
    check (height_cm > 0 and height_cm <= 500);

alter table public.orders
  add column if not exists shipping_provider text,
  add column if not exists shipping_service text,
  add column if not exists shipping_fee numeric(14,2) not null default 0
    check (shipping_fee >= 0),
  add column if not exists shipping_awb text,
  add column if not exists shipping_status text,
  add column if not exists shipping_order_id text,
  add column if not exists shipping_address_postal_code text;

create index if not exists orders_shipping_awb_idx
  on public.orders(shipping_awb) where shipping_awb is not null;

commit;
