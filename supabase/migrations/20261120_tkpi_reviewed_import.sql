-- Safe, admin-only import of manually reviewed TKPI rows from staging.
-- raw_row JSON contract: category_slug, name, food_state, source_code,
-- edible_portion_percent, source_version, source_url, review_notes,
-- and nutrient fields matching the CSV template.
begin;

create or replace function public.import_approved_tkpi_rows(p_batch_name text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_category_id uuid;
  v_food_id uuid;
  v_nutrient record;
  v_raw text;
  v_amount numeric;
  v_imported integer := 0;
  v_slug text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an authenticated Bos Pangan admin can import TKPI rows';
  end if;

  if p_batch_name is null or btrim(p_batch_name) = '' then
    raise exception 'Batch name is required';
  end if;

  for r in
    select id, tkpi_code, source_page, raw_row
    from public.nutrition_import_staging
    where batch_name = p_batch_name and review_status = 'approved'
    order by source_page nulls last, tkpi_code
    for update
  loop
    if nullif(btrim(r.tkpi_code), '') is null then
      raise exception 'Staging row % has no TKPI code', r.id;
    end if;
    if nullif(btrim(r.raw_row->>'name'), '') is null then
      raise exception 'Staging row % has no food name', r.id;
    end if;

    select id into v_category_id
    from public.nutrition_categories
    where slug = r.raw_row->>'category_slug' and is_active = true;
    if v_category_id is null then
      raise exception 'Unknown or inactive category for TKPI code %', r.tkpi_code;
    end if;

    if nullif(btrim(r.raw_row->>'edible_portion_percent'), '') is not null then
      if (r.raw_row->>'edible_portion_percent') !~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$' then
        raise exception 'Invalid BDD value for TKPI code %', r.tkpi_code;
      end if;
      if (r.raw_row->>'edible_portion_percent')::numeric < 0
        or (r.raw_row->>'edible_portion_percent')::numeric > 100 then
        raise exception 'BDD outside 0-100 for TKPI code %', r.tkpi_code;
      end if;
    end if;

    v_slug := lower(regexp_replace(r.tkpi_code, '[^a-zA-Z0-9]+', '-', 'g'));
    insert into public.nutrition_foods
      (category_id, slug, name, food_state, edible_portion_percent,
       serving_basis, source_name, source_url, source_version,
       data_notes, is_published, tkpi_code, tkpi_source_page, data_quality_status)
    values
      (v_category_id, v_slug, btrim(r.raw_row->>'name'),
       coalesce(nullif(btrim(r.raw_row->>'food_state'), ''), 'Sesuai keterangan TKPI'),
       nullif(r.raw_row->>'edible_portion_percent', '')::numeric,
       'per 100 g bagian dapat dimakan',
       'Tabel Komposisi Pangan Indonesia',
       coalesce(nullif(r.raw_row->>'source_url',''), 'https://repository.kemkes.go.id/book/668'),
       coalesce(nullif(r.raw_row->>'source_version',''), '2020'),
       concat_ws(' · ',
         nullif('Kode sumber: ' || nullif(r.raw_row->>'source_code',''), 'Kode sumber: '),
         case when r.source_page is not null then 'Halaman cetak: ' || r.source_page::text end,
         nullif(r.raw_row->>'review_notes','')),
       false, r.tkpi_code, r.source_page, 'reviewed')
    on conflict (tkpi_code) where tkpi_code is not null
    do update set
      category_id = excluded.category_id,
      name = excluded.name,
      food_state = excluded.food_state,
      edible_portion_percent = excluded.edible_portion_percent,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      source_version = excluded.source_version,
      data_notes = excluded.data_notes,
      tkpi_source_page = excluded.tkpi_source_page,
      data_quality_status = 'reviewed',
      is_published = false,
      updated_at = now()
    returning id into v_food_id;

    -- Replace the nutrient set for this food. Without this delete, a corrected
    -- blank cell could leave an older amount in place after a re-import.
    delete from public.nutrition_food_nutrients
    where food_id = v_food_id;

    for v_nutrient in
      select * from (values
        ('water_g','water'), ('energy_kcal','energy'),
        ('protein_g','protein'), ('fat_g','fat'),
        ('carbohydrate_g','carbohydrate'), ('fiber_g','fiber'),
        ('ash_g','ash'), ('calcium_mg','calcium'),
        ('phosphorus_mg','phosphorus'), ('iron_mg','iron'),
        ('sodium_mg','sodium'), ('potassium_mg','potassium'),
        ('copper_mg','copper'), ('zinc_mg','zinc'),
        ('retinol_ug','retinol'), ('beta_carotene_ug','beta_carotene'),
        ('total_carotene_ug','total_carotene'), ('thiamin_mg','thiamin'),
        ('riboflavin_mg','riboflavin'), ('niacin_mg','niacin'),
        ('vitamin_c_mg','vitamin_c')
      ) as m(json_key, nutrient_code)
    loop
      v_raw := nullif(btrim(r.raw_row->>v_nutrient.json_key), '');
      if v_raw is null then
        continue;
      end if;
      if v_raw !~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$' then
        raise exception 'Invalid numeric value in % for TKPI code %',
          v_nutrient.json_key, r.tkpi_code;
      end if;
      v_amount := v_raw::numeric;

      insert into public.nutrition_food_nutrients
        (food_id, nutrient_id, amount, basis, source_note)
      select v_food_id, n.id, v_amount,
        'per 100 g bagian dapat dimakan',
        'TKPI 2020; halaman cetak ' || coalesce(r.source_page::text, 'tidak dicatat')
      from public.nutrition_nutrients n
      where n.code = v_nutrient.nutrient_code
      on conflict (food_id, nutrient_id)
      do update set amount = excluded.amount,
        basis = excluded.basis,
        source_note = excluded.source_note,
        updated_at = now();
    end loop;

    update public.nutrition_import_staging
    set review_status = 'imported', reviewed_at = coalesce(reviewed_at, now())
    where id = r.id;

    v_imported := v_imported + 1;
  end loop;

  return v_imported;
end;
$$;

revoke all on function public.import_approved_tkpi_rows(text) from public;
grant execute on function public.import_approved_tkpi_rows(text) to authenticated;

commit;
