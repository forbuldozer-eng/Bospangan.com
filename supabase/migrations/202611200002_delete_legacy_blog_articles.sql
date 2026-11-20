-- Retire all legacy Blog and Promo F&B content only.
-- Other cms_articles categories and all non-content tables remain untouched.
begin;
delete from public.cms_articles
where category in ('blog', 'promo', 'promo_fnb');
commit;
