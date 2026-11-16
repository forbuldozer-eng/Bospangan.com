-- Bos Pangan: master kategori produk dinamis.
begin;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  icon text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_name_unique unique (name),
  constraint product_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

alter table public.product_categories enable row level security;
drop policy if exists "public reads active product categories" on public.product_categories;
create policy "public reads active product categories"
on public.product_categories for select to anon, authenticated
using (is_active or public.is_admin());

drop policy if exists "admins manage product categories" on public.product_categories;
create policy "admins manage product categories"
on public.product_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select on public.product_categories to anon, authenticated;
grant insert, update, delete on public.product_categories to authenticated;

-- Remove the old fixed category whitelist so new CMS categories can be used by products.
alter table public.products drop constraint if exists products_category_check;

insert into public.product_categories (name, slug, sort_order, is_active)
values
  ('Daging sapi','daging-sapi',1,true),
  ('Ikan','ikan',2,true),
  ('Ayam','ayam',3,true),
  ('Sayuran','sayuran',4,true),
  ('Minyak','minyak',5,true),
  ('Beras','beras',6,true),
  ('Bumbu dapur','bumbu-dapur',7,true),
  ('Buah','buah',8,true),
  ('Bebek','bebek',9,true)
on conflict (slug) do nothing;

commit;
