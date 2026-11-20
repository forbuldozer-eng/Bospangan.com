-- Dedicated Blog CMS. Existing commerce and profile tables remain untouched.
begin;
create table if not exists public.cms_articles(
 id uuid primary key default gen_random_uuid(),content_type text not null default 'blog' check(content_type='blog'),
 title text not null,slug text not null unique,excerpt text not null default '',content_html text not null default '',
 category text not null default 'Umum',cover_image_url text,cover_image_alt text not null default '',
 seo_title text not null default '',seo_description text not null default '',
 status text not null default 'draft' check(status in('draft','published')),
 author_id uuid references auth.users(id) on delete set null,created_by uuid references auth.users(id) on delete set null,updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),published_at timestamptz);
alter table public.cms_articles add column if not exists content_type text not null default 'blog';
alter table public.cms_articles add column if not exists title text not null default '';
alter table public.cms_articles add column if not exists slug text not null default '';
alter table public.cms_articles add column if not exists excerpt text not null default '';
alter table public.cms_articles add column if not exists content_html text not null default '';
alter table public.cms_articles add column if not exists category text not null default 'Umum';
alter table public.cms_articles add column if not exists cover_image_url text;
alter table public.cms_articles add column if not exists cover_image_alt text not null default '';
alter table public.cms_articles add column if not exists seo_title text not null default '';
alter table public.cms_articles add column if not exists seo_description text not null default '';
alter table public.cms_articles add column if not exists status text not null default 'draft';
alter table public.cms_articles add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.cms_articles add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.cms_articles add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.cms_articles add column if not exists created_at timestamptz not null default now();
alter table public.cms_articles add column if not exists updated_at timestamptz not null default now();
alter table public.cms_articles add column if not exists published_at timestamptz;
create unique index if not exists cms_articles_blog_slug_unique on public.cms_articles(slug);
create index if not exists cms_articles_blog_publish_idx on public.cms_articles(status,published_at desc);
alter table public.cms_articles enable row level security;
drop policy if exists "public read published blog articles" on public.cms_articles;
create policy "public read published blog articles" on public.cms_articles for select to anon,authenticated using(content_type='blog' and status='published' and published_at is not null and published_at<=now());
drop policy if exists "admins manage blog articles" on public.cms_articles;
create policy "admins manage blog articles" on public.cms_articles for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.cms_articles to anon,authenticated;grant insert,update,delete on public.cms_articles to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('blog-images','blog-images',true,8388608,array['image/jpeg','image/png','image/webp'])on conflict(id)do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "public read blog images" on storage.objects;create policy "public read blog images" on storage.objects for select to anon,authenticated using(bucket_id='blog-images');
drop policy if exists "admins upload blog images" on storage.objects;create policy "admins upload blog images" on storage.objects for insert to authenticated with check(bucket_id='blog-images' and public.is_admin());
drop policy if exists "admins update blog images" on storage.objects;create policy "admins update blog images" on storage.objects for update to authenticated using(bucket_id='blog-images' and public.is_admin()) with check(bucket_id='blog-images' and public.is_admin());
drop policy if exists "admins delete blog images" on storage.objects;create policy "admins delete blog images" on storage.objects for delete to authenticated using(bucket_id='blog-images' and public.is_admin());
commit;notify pgrst,'reload schema';