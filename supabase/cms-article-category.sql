-- Pisahkan artikel edukasi dan artikel promosi pada CMS Bos Pangan.
-- Artikel lama otomatis tetap masuk kategori Blog.
begin;
alter table public.cms_articles
  add column if not exists category text not null default 'blog';
alter table public.cms_articles
  drop constraint if exists cms_articles_category_check;
alter table public.cms_articles
  add constraint cms_articles_category_check
  check (category in ('blog','promo_fnb'));
create index if not exists cms_articles_category_status_published_idx
  on public.cms_articles(category, status, published_at desc);
commit;
