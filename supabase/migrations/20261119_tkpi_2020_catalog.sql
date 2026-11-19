-- TKPI 2020 catalog alignment for Bos Pangan
-- Apply after supabase/nutrition-directory.sql. Imported rows remain unpublished until reviewed.
begin;

alter table public.nutrition_categories
  add column if not exists tkpi_single_code text,
  add column if not exists tkpi_processed_code text;

alter table public.nutrition_foods
  add column if not exists tkpi_code text,
  add column if not exists tkpi_source_page integer,
  add column if not exists data_quality_status text not null default 'pending'
    check (data_quality_status in ('pending','reviewed','published','rejected'));

create unique index if not exists nutrition_foods_tkpi_code_uidx
  on public.nutrition_foods(tkpi_code) where tkpi_code is not null;

-- TKPI 2020 groups and paired codes: single ingredient / processed food.
insert into public.nutrition_categories
  (slug,name,description,sort_order,tkpi_single_code,tkpi_processed_code,is_active)
values
 ('serealia','Serealia dan Hasil Olahannya','Kelompok serealia dan hasil olahannya menurut TKPI 2020.',10,'AR','AP',true),
 ('umbi-berpati','Umbi Berpati dan Hasil Olahannya','Kelompok umbi berpati dan hasil olahannya menurut TKPI 2020.',20,'BR','BP',true),
 ('kacang-biji-bean','Kacang, Biji, Bean dan Hasil Olahannya','Kelompok kacang, biji, bean dan hasil olahannya menurut TKPI 2020.',30,'CR','CP',true),
 ('sayuran','Sayuran dan Hasil Olahannya','Kelompok sayuran dan hasil olahannya menurut TKPI 2020.',40,'DR','DP',true),
 ('buah','Buah dan Hasil Olahannya','Kelompok buah dan hasil olahannya menurut TKPI 2020.',50,'ER','EP',true),
 ('daging-unggas','Daging, Unggas dan Hasil Olahannya','Kelompok daging, unggas dan hasil olahannya menurut TKPI 2020.',60,'FR','FP',true),
 ('ikan-kerang-udang','Ikan, Kerang, Udang dan Hasil Olahannya','Kelompok ikan, kerang, udang dan hasil olahannya menurut TKPI 2020.',70,'GR','GP',true),
 ('telur','Telur dan Hasil Olahannya','Kelompok telur dan hasil olahannya menurut TKPI 2020.',80,'HR','HP',true),
 ('susu','Susu dan Hasil Olahannya','Kelompok susu dan hasil olahannya menurut TKPI 2020.',90,'JR','JP',true),
 ('lemak-minyak','Lemak dan Minyak','Kelompok lemak dan minyak menurut TKPI 2020.',100,'KR','KP',true),
 ('gula-sirup-konfeksioneri','Gula, Sirup dan Konfeksioneri','Kelompok gula, sirup dan konfeksioneri menurut TKPI 2020.',110,'MR','MP',true),
 ('bumbu','Bumbu','Kelompok bumbu menurut TKPI 2020.',120,'NR','NP',true),
 ('minuman','Minuman','Kelompok minuman menurut TKPI 2020.',130,'PR','PP',true)
on conflict(slug) do update set
 name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,
 tkpi_single_code=excluded.tkpi_single_code,tkpi_processed_code=excluded.tkpi_processed_code,is_active=true;

-- Retain legacy Bos Pangan categories for old URLs, but remove them from the active TKPI directory.
update public.nutrition_categories
set is_active=false
where slug in ('daging-sapi','ikan','ayam','bebek','beras','minyak','bumbu-dapur');

-- TKPI composition table nutrients. All values are per 100 g edible portion (BDD).
insert into public.nutrition_nutrients(code,name,unit,sort_order) values
 ('water','Air','g',10),
 ('energy','Energi','kkal',20),
 ('protein','Protein','g',30),
 ('fat','Lemak','g',40),
 ('carbohydrate','Karbohidrat','g',50),
 ('fiber','Serat','g',60),
 ('ash','Abu','g',70),
 ('calcium','Kalsium','mg',80),
 ('phosphorus','Fosfor','mg',90),
 ('iron','Besi','mg',100),
 ('sodium','Natrium','mg',110),
 ('potassium','Kalium','mg',120),
 ('copper','Tembaga','mg',130),
 ('zinc','Seng','mg',140),
 ('retinol','Retinol','µg',150),
 ('beta_carotene','Beta-karoten','µg',160),
 ('total_carotene','Karoten total','µg',170),
 ('thiamin','Thiamin','mg',180),
 ('riboflavin','Riboflavin','mg',190),
 ('niacin','Niasin','mg',200),
 ('vitamin_c','Vitamin C','mg',210)
on conflict(code) do update set name=excluded.name,unit=excluded.unit,sort_order=excluded.sort_order;

create table if not exists public.nutrition_import_staging (
 id uuid primary key default gen_random_uuid(),
 batch_name text not null,
 tkpi_code text,
 source_page integer,
 raw_row jsonb not null,
 ocr_confidence numeric(5,2),
 review_status text not null default 'pending'
   check (review_status in ('pending','approved','rejected','imported')),
 review_notes text not null default '',
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id)
);
alter table public.nutrition_import_staging enable row level security;
drop policy if exists "Admins manage TKPI import staging" on public.nutrition_import_staging;
create policy "Admins manage TKPI import staging"
 on public.nutrition_import_staging for all to authenticated
 using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.nutrition_import_staging to authenticated;

create index if not exists nutrition_import_staging_review_idx
 on public.nutrition_import_staging(batch_name,review_status,source_page);
create index if not exists nutrition_foods_tkpi_group_idx
 on public.nutrition_foods(category_id,tkpi_code);

commit;
