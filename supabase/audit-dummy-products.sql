-- Read-only review of possible test/dummy product records.
-- Run only after taking a verified Supabase backup.
-- This query intentionally does not delete or modify any data.
select
  id,
  sku,
  name,
  category,
  is_published,
  created_at
from public.products
where
  coalesce(name, '') ilike '%test%'
  or coalesce(sku, '') ilike 'test-%'
  or coalesce(sku, '') in ('312312312', '143124325')
order by created_at desc;
