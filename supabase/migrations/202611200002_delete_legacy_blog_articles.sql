-- Retire all legacy Blog and Promo F&B article records only.
-- Non-content tables and other CMS categories remain untouched.
begin;
delete from public.cms_articles
where category in ('blog', 'promo', 'promo_fnb');
commit;
