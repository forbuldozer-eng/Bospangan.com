-- Categorize CMS articles as Blog or Promo.
-- Existing records remain Blog by default.
alter table public.cms_articles
  add column if not exists category text not null default 'blog';

alter table public.cms_articles
  drop constraint if exists cms_articles_category_check;

alter table public.cms_articles
  add constraint cms_articles_category_check
  check (category in ('blog', 'promo'));

create index if not exists cms_articles_category_status_published_idx
  on public.cms_articles (category, status, published_at desc);
