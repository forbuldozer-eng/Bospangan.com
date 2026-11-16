-- Bos Pangan: allow CRM contacts without email, using phone as alternate identity.
-- Run once in Supabase SQL Editor after customer-directory.sql.

begin;

alter table public.customer_directory
  add column if not exists id uuid default gen_random_uuid();

update public.customer_directory
set id = gen_random_uuid()
where id is null;

alter table public.customer_directory
  alter column id set not null,
  alter column email drop not null;

alter table public.customer_directory
  drop constraint if exists customer_directory_pkey,
  drop constraint if exists customer_directory_email_lower,
  drop constraint if exists customer_directory_email_valid;

alter table public.customer_directory
  add constraint customer_directory_pkey primary key (id);

-- UNIQUE permits multiple NULL email values while preserving email uniqueness
-- for contacts that provide an email. Keep this constraint for order-trigger
-- ON CONFLICT (email) behavior.
alter table public.customer_directory
  add constraint customer_directory_email_key unique (email);

alter table public.customer_directory
  add constraint customer_directory_email_optional_valid
  check (
    email is null
    or (
      email = lower(email)
      and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

create index if not exists customer_directory_phone_digits_idx
  on public.customer_directory ((regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g')));

-- Import contacts in one transaction. Email is preferred as identity;
-- phone digits are the fallback identity when email is absent.
create or replace function public.import_customer_directory_contacts(p_contacts jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_email text;
  v_name text;
  v_phone text;
  v_phone_digits text;
  v_address text;
  v_notes text;
  v_id uuid;
  v_matches integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_invalid integer := 0;
  v_invalid_rows jsonb := '[]'::jsonb;
  v_row integer := 0;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Akses ditolak. Hanya admin yang dapat mengimpor kontak.';
  end if;

  if jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'Data import harus berupa array JSON.';
  end if;

  -- Serialize imports so two admin imports cannot create the same phone identity.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bos-pangan-customer-directory-import'));

  for v_item in select value from jsonb_array_elements(p_contacts)
  loop
    v_row := v_row + 1;
    v_email := nullif(lower(trim(coalesce(v_item->>'email',''))), '');
    v_name := trim(coalesce(v_item->>'customer_name',''));
    v_phone := trim(coalesce(v_item->>'phone',''));
    v_phone_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
    v_address := trim(coalesce(v_item->>'address',''));
    v_notes := trim(coalesce(v_item->>'notes',''));

    if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
      v_invalid := v_invalid + 1;
      v_invalid_rows := v_invalid_rows || jsonb_build_array(jsonb_build_object('row',v_row,'reason','Nama wajib 2–120 karakter.'));
      continue;
    end if;

    if v_email is not null and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      v_invalid := v_invalid + 1;
      v_invalid_rows := v_invalid_rows || jsonb_build_array(jsonb_build_object('row',v_row,'reason','Format email tidak valid.'));
      continue;
    end if;

    if v_email is null and char_length(v_phone_digits) < 8 then
      v_invalid := v_invalid + 1;
      v_invalid_rows := v_invalid_rows || jsonb_build_array(jsonb_build_object('row',v_row,'reason','Email atau nomor telepon minimal 8 digit wajib diisi.'));
      continue;
    end if;

    if char_length(v_phone) > 32 or char_length(v_address) > 1000 or char_length(v_notes) > 2000 then
      v_invalid := v_invalid + 1;
      v_invalid_rows := v_invalid_rows || jsonb_build_array(jsonb_build_object('row',v_row,'reason','Panjang nomor telepon, alamat, atau catatan melebihi batas.'));
      continue;
    end if;

    select count(distinct cd.id)
      into v_matches
    from public.customer_directory cd
    where (v_email is not null and cd.email = v_email)
       or (char_length(v_phone_digits) >= 8
           and regexp_replace(coalesce(cd.phone,''), '[^0-9]', '', 'g') = v_phone_digits);

    if v_matches > 1 then
      v_invalid := v_invalid + 1;
      v_invalid_rows := v_invalid_rows || jsonb_build_array(jsonb_build_object('row',v_row,'reason','Email dan nomor telepon cocok dengan dua kontak berbeda; perlu pemeriksaan manual.'));
      continue;
    end if;

    v_id := null;
    select cd.id
      into v_id
    from public.customer_directory cd
    where (v_email is not null and cd.email = v_email)
       or (char_length(v_phone_digits) >= 8
           and regexp_replace(coalesce(cd.phone,''), '[^0-9]', '', 'g') = v_phone_digits)
    order by case when v_email is not null and cd.email = v_email then 0 else 1 end
    limit 1
    for update;

    begin
      if v_id is null then
        insert into public.customer_directory
          (email, customer_name, phone, address, notes, source, updated_at)
        values
          (v_email, v_name, v_phone, v_address, v_notes, 'import', now());
        v_inserted := v_inserted + 1;
      else
        update public.customer_directory
        set email = coalesce(v_email, email),
            customer_name = v_name,
            phone = case when v_phone <> '' then v_phone else phone end,
            address = case when v_address <> '' then v_address else address end,
            notes = case when v_notes <> '' then v_notes else notes end,
            source = 'import',
            updated_at = now()
        where id = v_id;
        v_updated := v_updated + 1;
      end if;
    exception when unique_violation then
      v_invalid := v_invalid + 1;
      v_invalid_rows := v_invalid_rows || jsonb_build_array(jsonb_build_object('row',v_row,'reason','Email atau identitas kontak sudah digunakan oleh pelanggan lain.'));
    end;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'invalid', v_invalid,
    'invalid_rows', v_invalid_rows
  );
end;
$$;

revoke all on function public.import_customer_directory_contacts(jsonb) from public, anon;
grant execute on function public.import_customer_directory_contacts(jsonb) to authenticated;

commit;
notify pgrst, 'reload schema';
