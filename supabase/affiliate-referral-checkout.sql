-- Affiliate referral attribution for Bos Pangan checkout.
-- Run after supabase/affiliate-management.sql and existing checkout.sql.
begin;
alter table public.orders
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null;
create index if not exists orders_affiliate_created_idx
  on public.orders(affiliate_id, created_at desc)
  where affiliate_id is not null;
commit;
