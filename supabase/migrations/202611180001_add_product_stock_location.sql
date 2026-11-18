-- Add an optional location label for each product's stock.
-- Additive and idempotent: existing products keep an empty location until an admin fills it.
begin;
alter table public.products
  add column if not exists stock_location text not null default '';
comment on column public.products.stock_location is
  'Admin-entered physical stock location, e.g. Gudang Bekasi / Rak A-01.';
commit;
