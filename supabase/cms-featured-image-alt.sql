-- Add editable alternative text for CMS featured images.
-- Safe to run more than once; existing article records are preserved.
begin;
alter table public.cms_articles
  add column if not exists featured_image_alt text not null default '';
comment on column public.cms_articles.featured_image_alt
  is 'Alternative text describing the featured image for accessibility and image SEO.';
commit;
