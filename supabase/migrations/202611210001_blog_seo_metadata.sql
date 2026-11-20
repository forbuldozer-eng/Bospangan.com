-- Blog SEO assistant metadata for CMS SEO controls.
-- Applied to the production Supabase project as an additive schema change.
alter table public.cms_articles
  add column if not exists seo_metadata jsonb not null default '{}'::jsonb;

update public.cms_articles
set seo_metadata = '{}'::jsonb
where seo_metadata is null
   or jsonb_typeof(seo_metadata) is distinct from 'object';

alter table public.cms_articles
  alter column seo_metadata set default '{}'::jsonb,
  alter column seo_metadata set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'cms_articles'
      and c.conname = 'cms_articles_seo_metadata_object_check'
  ) then
    alter table public.cms_articles
      add constraint cms_articles_seo_metadata_object_check
      check (jsonb_typeof(seo_metadata) = 'object');
  end if;
end $$;

comment on column public.cms_articles.seo_metadata is
  'Bos Pangan Blog SEO plugin metadata: schema, social previews, canonical, robots, synonyms and cornerstone settings.';
