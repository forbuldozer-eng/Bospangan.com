-- Bos Pangan: pengaturan urutan kategori halaman utama.
-- Jalankan sekali di Supabase SQL Editor pada project production.

begin;

create table if not exists public.homepage_category_order (
  slug text primary key,
  name text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.homepage_category_order enable row level security;

drop policy if exists "public reads homepage category order" on public.homepage_category_order;
create policy "public reads homepage category order"
on public.homepage_category_order for select
to anon, authenticated using (true);

drop policy if exists "admins manage homepage category order" on public.homepage_category_order;
create policy "admins manage homepage category order"
on public.homepage_category_order for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.homepage_category_order to anon, authenticated;
grant insert, update, delete on public.homepage_category_order to authenticated;

insert into public.homepage_category_order (slug, name, sort_order, is_visible)
values
  ('daging-sapi', 'Daging sapi', 1, true),
  ('ikan', 'Ikan', 2, true),
  ('ayam', 'Ayam', 3, true),
  ('sayuran', 'Sayuran', 4, true),
  ('minyak', 'Minyak', 5, true),
  ('beras', 'Beras', 6, true),
  ('bumbu-dapur', 'Bumbu dapur', 7, true),
  ('buah', 'Buah', 8, true),
  ('bebek', 'Bebek', 9, true)
on conflict (slug) do nothing;

commit;
