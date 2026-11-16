-- Bos Pangan: editable homepage banner
begin;

create table if not exists public.site_banners (
  id text primary key default 'home' check (id = 'home'),
  eyebrow text not null default 'Bekasi / Katalog produk',
  title text not null default 'Pilihan produk pangan untuk kebutuhan Anda.',
  description text not null default 'Temukan berbagai kebutuhan pangan dan produk harian dalam satu katalog.',
  cta_label text not null default 'Katalog kebutuhan harian',
  cta_url text not null default '/#katalog',
  background_color text not null default '#cf1b1d',
  background_image_url text,
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_banners add column if not exists eyebrow text not null default 'Bekasi / Katalog produk';
alter table public.site_banners add column if not exists title text not null default 'Pilihan produk pangan untuk kebutuhan Anda.';
alter table public.site_banners add column if not exists description text not null default 'Temukan berbagai kebutuhan pangan dan produk harian dalam satu katalog.';
alter table public.site_banners add column if not exists cta_label text not null default 'Katalog kebutuhan harian';
alter table public.site_banners add column if not exists cta_url text not null default '/#katalog';
alter table public.site_banners add column if not exists background_color text not null default '#cf1b1d';
alter table public.site_banners add column if not exists background_image_url text;
alter table public.site_banners add column if not exists is_active boolean not null default true;
alter table public.site_banners add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.site_banners add column if not exists updated_at timestamptz not null default now();

alter table public.site_banners enable row level security;
drop policy if exists "Public can read active homepage banner" on public.site_banners;
create policy "Public can read active homepage banner" on public.site_banners
for select to anon,authenticated using (is_active = true or public.is_landing_page_admin());
drop policy if exists "Admins insert homepage banner" on public.site_banners;
create policy "Admins insert homepage banner" on public.site_banners
for insert to authenticated with check (public.is_landing_page_admin());
drop policy if exists "Admins update homepage banner" on public.site_banners;
create policy "Admins update homepage banner" on public.site_banners
for update to authenticated using (public.is_landing_page_admin()) with check (public.is_landing_page_admin());
grant select on public.site_banners to anon,authenticated;
grant insert,update on public.site_banners to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('site-banner-images','site-banner-images',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public reads site banner images" on storage.objects;
create policy "Public reads site banner images" on storage.objects for select to anon,authenticated using (bucket_id='site-banner-images');
drop policy if exists "Admins upload site banner images" on storage.objects;
create policy "Admins upload site banner images" on storage.objects for insert to authenticated with check (bucket_id='site-banner-images' and public.is_landing_page_admin());
drop policy if exists "Admins update site banner images" on storage.objects;
create policy "Admins update site banner images" on storage.objects for update to authenticated using (bucket_id='site-banner-images' and public.is_landing_page_admin()) with check (bucket_id='site-banner-images' and public.is_landing_page_admin());
drop policy if exists "Admins delete site banner images" on storage.objects;
create policy "Admins delete site banner images" on storage.objects for delete to authenticated using (bucket_id='site-banner-images' and public.is_landing_page_admin());

commit;
