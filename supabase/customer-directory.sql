-- Bos Pangan CRM customer directory.
-- Run once in Supabase SQL Editor after schema.sql, commerce-backend.sql,
-- and customer-accounts.sql. Does not create Auth accounts or passwords.

begin;

create table if not exists public.customer_directory (
  email text primary key,
  customer_name text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  source text not null default 'order' check (source in ('order','import')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_directory_email_lower check (email = lower(email)),
  constraint customer_directory_email_valid check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create index if not exists customer_directory_name_idx
  on public.customer_directory using gin (to_tsvector('simple', customer_name));
create index if not exists customer_directory_last_seen_idx
  on public.customer_directory(last_seen_at desc nulls last);

alter table public.customer_directory enable row level security;
drop policy if exists "admins manage customer directory" on public.customer_directory;
create policy "admins manage customer directory"
on public.customer_directory
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on public.customer_directory from anon;
grant select, insert, update, delete on public.customer_directory to authenticated;

-- Automatically register contact details when a real order is created/updated.
create or replace function public.sync_order_customer_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(new.customer_email, '')));
begin
  if v_email = '' or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return new;
  end if;

  insert into public.customer_directory(
    email, customer_name, phone, address, source, first_seen_at, last_seen_at, updated_at
  ) values (
    v_email, left(trim(coalesce(new.customer_name,'')),120),
    left(trim(coalesce(new.customer_phone,'')),32),
    left(trim(coalesce(new.customer_address,'')),1000),
    'order', new.created_at, new.created_at, now()
  )
  on conflict (email) do update set
    customer_name = case when excluded.customer_name <> '' then excluded.customer_name else customer_directory.customer_name end,
    phone = case when excluded.phone <> '' then excluded.phone else customer_directory.phone end,
    address = case when excluded.address <> '' then excluded.address else customer_directory.address end,
    last_seen_at = greatest(coalesce(customer_directory.last_seen_at, excluded.last_seen_at), excluded.last_seen_at),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_order_customer_directory on public.orders;
create trigger trg_sync_order_customer_directory
after insert or update of customer_email, customer_name, customer_phone, customer_address
on public.orders
for each row execute function public.sync_order_customer_directory();

-- Backfill historical guest and registered checkout contacts.
insert into public.customer_directory(
  email, customer_name, phone, address, source, first_seen_at, last_seen_at
)
select
  lower(trim(customer_email)),
  (array_agg(customer_name order by created_at desc))[1],
  (array_agg(customer_phone order by created_at desc))[1],
  (array_agg(coalesce(customer_address,'') order by created_at desc))[1],
  'order',
  min(created_at),
  max(created_at)
from public.orders
where trim(coalesce(customer_email,'')) <> ''
  and lower(trim(customer_email)) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
group by lower(trim(customer_email))
on conflict (email) do update set
  customer_name = case when excluded.customer_name <> '' then excluded.customer_name else customer_directory.customer_name end,
  phone = case when excluded.phone <> '' then excluded.phone else customer_directory.phone end,
  address = case when excluded.address <> '' then excluded.address else customer_directory.address end,
  first_seen_at = least(customer_directory.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(coalesce(customer_directory.last_seen_at, excluded.last_seen_at), excluded.last_seen_at),
  updated_at = now();

commit;
notify pgrst, 'reload schema';
