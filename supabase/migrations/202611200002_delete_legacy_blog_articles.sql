-- Retire legacy Bos Pangan Blog content only.
-- Promo F&B rows and all non-blog data remain untouched.
begin;
delete from public.cms_articles where category = 'blog';
commit;
