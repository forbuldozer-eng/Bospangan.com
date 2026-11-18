-- Bos Pangan Affiliate Management. Run after schema.sql and commerce-backend.sql.
-- Affiliate membership is separate from CMS profiles.role.
begin;
create table if not exists public.affiliate_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 applicant_name text not null, applicant_email text not null, whatsapp text not null default '',
 promotion_channel text not null default '', reason text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 review_note text not null default '', created_at timestamptz not null default now()
);
create index if not exists affiliate_applications_status_idx on public.affiliate_applications(status,created_at desc);
alter table public.affiliate_applications enable row level security;
drop policy if exists "affiliate applicant reads own request" on public.affiliate_applications;
create policy "affiliate applicant reads own request" on public.affiliate_applications for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "customer submits affiliate request" on public.affiliate_applications;
create policy "customer submits affiliate request" on public.affiliate_applications for insert to authenticated with check(user_id=auth.uid() and status='pending');
drop policy if exists "admins review affiliate requests" on public.affiliate_applications;
create policy "admins review affiliate requests" on public.affiliate_applications for update to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.affiliate_applications to authenticated;

create table if not exists public.affiliates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
 affiliate_code text not null unique, status text not null default 'active' check(status in ('active','suspended')),
 approved_by uuid references public.profiles(id), approved_at timestamptz not null default now(), created_at timestamptz not null default now()
);
alter table public.affiliates enable row level security;
drop policy if exists "affiliate reads own profile" on public.affiliates;
create policy "affiliate reads own profile" on public.affiliates for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "admins manage affiliate profiles" on public.affiliates;
create policy "admins manage affiliate profiles" on public.affiliates for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.affiliates to authenticated;

create table if not exists public.affiliate_commissions (
 id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0), note text not null default '',
 order_id uuid references public.orders(id) on delete set null,
 status text not null default 'available' check(status in ('available','withdrawn','void')),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index if not exists affiliate_commissions_owner_idx on public.affiliate_commissions(affiliate_id,created_at desc);
alter table public.affiliate_commissions enable row level security;
drop policy if exists "affiliate reads own commissions" on public.affiliate_commissions;
create policy "affiliate reads own commissions" on public.affiliate_commissions for select to authenticated using(exists(select 1 from public.affiliates a where a.id=affiliate_id and a.user_id=auth.uid()) or public.is_admin());
drop policy if exists "admins manage affiliate commissions" on public.affiliate_commissions;
create policy "admins manage affiliate commissions" on public.affiliate_commissions for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.affiliate_commissions to authenticated;

create table if not exists public.affiliate_withdrawals (
 id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references public.affiliates(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0), payment_method text not null,
 payment_account_name text not null, payment_account_number text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','paid')),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, review_note text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists affiliate_withdrawals_status_idx on public.affiliate_withdrawals(status,created_at desc);
alter table public.affiliate_withdrawals enable row level security;
drop policy if exists "affiliate reads own withdrawals" on public.affiliate_withdrawals;
create policy "affiliate reads own withdrawals" on public.affiliate_withdrawals for select to authenticated using(exists(select 1 from public.affiliates a where a.id=affiliate_id and a.user_id=auth.uid()) or public.is_admin());
drop policy if exists "affiliate requests own withdrawal" on public.affiliate_withdrawals;
create policy "affiliate requests own withdrawal" on public.affiliate_withdrawals for insert to authenticated with check(status='pending' and exists(select 1 from public.affiliates a where a.id=affiliate_id and a.user_id=auth.uid() and a.status='active'));
drop policy if exists "admins review affiliate withdrawals" on public.affiliate_withdrawals;
create policy "admins review affiliate withdrawals" on public.affiliate_withdrawals for update to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.affiliate_withdrawals to authenticated;

create or replace function public.admin_review_affiliate_application(p_application_id uuid,p_decision text,p_affiliate_code text,p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_app public.affiliate_applications%rowtype; v_id uuid; v_code text:=upper(regexp_replace(trim(coalesce(p_affiliate_code,'')),'[^A-Za-z0-9_-]','','g'));
begin
 if not public.is_admin() then raise exception 'Akses admin diperlukan.'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Keputusan tidak valid.'; end if;
 select * into v_app from public.affiliate_applications where id=p_application_id for update;
 if not found or v_app.status<>'pending' then raise exception 'Pengajuan tidak ditemukan atau sudah ditinjau.'; end if;
 if p_decision='approved' and length(v_code)<4 then raise exception 'Kode affiliate minimal 4 karakter.'; end if;
 update public.affiliate_applications set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(coalesce(p_note,''),1000) where id=p_application_id;
 if p_decision='approved' then
  insert into public.affiliates(user_id,affiliate_code,approved_by) values(v_app.user_id,v_code,auth.uid()) returning id into v_id;
 end if;
 return v_id;
end; $$;
revoke all on function public.admin_review_affiliate_application(uuid,text,text,text) from public;
grant execute on function public.admin_review_affiliate_application(uuid,text,text,text) to authenticated;

-- Secure withdrawal request: serialize requests per affiliate and reserve
-- available balance by counting pending/approved/paid requests.
create or replace function public.request_affiliate_withdrawal(
 p_amount numeric,
 p_payment_method text,
 p_payment_account_name text,
 p_payment_account_number text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_affiliate public.affiliates%rowtype;
 v_available numeric(14,2);
 v_id uuid;
begin
 select * into v_affiliate from public.affiliates
 where user_id=auth.uid() and status='active' for update;
 if not found then raise exception 'Akun affiliate aktif tidak ditemukan.'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'Nominal pencairan tidak valid.'; end if;
 if length(trim(coalesce(p_payment_method,'')))<2
    or length(trim(coalesce(p_payment_account_name,'')))<2
    or length(trim(coalesce(p_payment_account_number,'')))<4 then
   raise exception 'Informasi tujuan pembayaran belum lengkap.';
 end if;
 select coalesce((select sum(c.amount) from public.affiliate_commissions c
                  where c.affiliate_id=v_affiliate.id and c.status='available'),0)
        - coalesce((select sum(w.amount) from public.affiliate_withdrawals w
                    where w.affiliate_id=v_affiliate.id and w.status in ('pending','approved','paid')),0)
 into v_available;
 if p_amount>v_available then raise exception 'Saldo komisi tersedia tidak mencukupi.'; end if;
 insert into public.affiliate_withdrawals(affiliate_id,amount,payment_method,payment_account_name,payment_account_number)
 values(v_affiliate.id,round(p_amount,2),left(trim(p_payment_method),60),left(trim(p_payment_account_name),120),left(trim(p_payment_account_number),80))
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.request_affiliate_withdrawal(numeric,text,text,text) from public;
grant execute on function public.request_affiliate_withdrawal(numeric,text,text,text) to authenticated;

commit;
