-- Persist the focus keyphrase used by the local SEO analysis panel.
-- Safe to run more than once.
begin;
alter table public.cms_articles
  add column if not exists focus_keyphrase text not null default '';
comment on column public.cms_articles.focus_keyphrase
  is 'Primary focus keyphrase entered in the CMS article editor for on-page SEO guidance.';
commit;
