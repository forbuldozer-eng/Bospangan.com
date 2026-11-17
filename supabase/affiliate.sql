-- Bos Pangan affiliate program.
-- Apply only after a verified Supabase backup and review of the live schema.
begin;

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  website text not null default '',
  ref_id uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','active','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists affiliates_email_idx on public.affiliates(lower(email));

create table if not exists public.affiliate_clicks (
  id bigint generated always as identity primary key,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referrer text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_affiliate_created_idx
  on public.affiliate_clicks(affiliate_id, created_at desc);

create table if not exists public.affiliate_conversions (
  id bigint generated always as identity primary key,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  order_id uuid unique references public.orders(id) on delete set null,
  order_total numeric(14,2) not null default 0 check (order_total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists affiliate_conversions_affiliate_created_idx
  on public.affiliate_conversions(affiliate_id, created_at desc);

alter table public.affiliates enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_conversions enable row level security;

revoke all on public.affiliates, public.affiliate_clicks, public.affiliate_conversions from anon, authenticated;
grant all on public.affiliates, public.affiliate_clicks, public.affiliate_conversions to service_role;

commit;
