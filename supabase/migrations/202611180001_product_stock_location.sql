-- Add an optional stock location for each product.
-- Existing product rows are preserved; existing locations remain NULL until admins fill them in.
alter table public.products
  add column if not exists stock_location text;

comment on column public.products.stock_location is
  'Admin-managed physical storage location for product stock.';
