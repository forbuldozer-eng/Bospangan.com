-- Bos Pangan Landing Page CMS migration
-- Run in Supabase SQL Editor for the configured Bos Pangan project.

begin;

create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content_html text not null default '',
  hero_image_url text,
  seo_title text not null default '',
  seo_description text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.landing_pages add column if not exists content_html text not null default '';
alter table public.landing_pages add column if not exists hero_image_url text;
alter table public.landing_pages add column if not exists seo_title text not null default '';
alter table public.landing_pages add column if not exists seo_description text not null default '';
alter table public.landing_pages add column if not exists status text not null default 'draft';
alter table public.landing_pages add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.landing_pages add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.landing_pages add column if not exists published_at timestamptz;
alter table public.landing_pages add column if not exists created_at timestamptz not null default now();
alter table public.landing_pages add column if not exists updated_at timestamptz not null default now();

create unique index if not exists landing_pages_slug_unique_idx on public.landing_pages(slug);
create index if not exists landing_pages_status_updated_idx on public.landing_pages(status,updated_at desc);

create or replace function public.is_landing_page_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin','super_admin')
  );
$$;

alter table public.landing_pages enable row level security;
drop policy if exists "Public reads published landing pages" on public.landing_pages;
create policy "Public reads published landing pages"
on public.landing_pages for select to anon
using (status = 'published');
drop policy if exists "Admins read all landing pages" on public.landing_pages;
create policy "Admins read all landing pages"
on public.landing_pages for select to authenticated
using (public.is_landing_page_admin());
drop policy if exists "Admins insert landing pages" on public.landing_pages;
create policy "Admins insert landing pages"
on public.landing_pages for insert to authenticated
with check (public.is_landing_page_admin());
drop policy if exists "Admins update landing pages" on public.landing_pages;
create policy "Admins update landing pages"
on public.landing_pages for update to authenticated
using (public.is_landing_page_admin())
with check (public.is_landing_page_admin());
drop policy if exists "Admins delete landing pages" on public.landing_pages;
create policy "Admins delete landing pages"
on public.landing_pages for delete to authenticated
using (public.is_landing_page_admin());

grant select on public.landing_pages to anon, authenticated;
grant insert, update, delete on public.landing_pages to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('landing-page-images','landing-page-images',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public reads landing page images" on storage.objects;
create policy "Public reads landing page images" on storage.objects for select to anon,authenticated using (bucket_id='landing-page-images');
drop policy if exists "Admins upload landing page images" on storage.objects;
create policy "Admins upload landing page images" on storage.objects for insert to authenticated with check (bucket_id='landing-page-images' and public.is_landing_page_admin());
drop policy if exists "Admins update landing page images" on storage.objects;
create policy "Admins update landing page images" on storage.objects for update to authenticated using (bucket_id='landing-page-images' and public.is_landing_page_admin()) with check (bucket_id='landing-page-images' and public.is_landing_page_admin());
drop policy if exists "Admins delete landing page images" on storage.objects;
create policy "Admins delete landing page images" on storage.objects for delete to authenticated using (bucket_id='landing-page-images' and public.is_landing_page_admin());

commit;
