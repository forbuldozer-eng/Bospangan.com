-- Persistent, immutable invoice archive. Additive migration; no existing order data is changed.
begin;

create table if not exists public.invoice_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  invoice_number text not null unique,
  order_snapshot jsonb not null,
  issued_by uuid references public.profiles(id),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint invoice_records_one_per_order unique(order_id),
  constraint invoice_records_snapshot_object check (jsonb_typeof(order_snapshot) = 'object')
);

create index if not exists invoice_records_issued_at_idx
  on public.invoice_records(issued_at desc);

alter table public.invoice_records enable row level security;

drop policy if exists "admins read invoice archive" on public.invoice_records;
create policy "admins read invoice archive"
  on public.invoice_records for select to authenticated
  using (public.is_admin());

drop policy if exists "admins issue invoice archive" on public.invoice_records;
create policy "admins issue invoice archive"
  on public.invoice_records for insert to authenticated
  with check (public.is_admin() and issued_by = auth.uid());

revoke all on public.invoice_records from anon, authenticated;
grant select, insert on public.invoice_records to authenticated;

-- Issued invoice snapshots are immutable: no UPDATE or DELETE policy is granted.
commit;
