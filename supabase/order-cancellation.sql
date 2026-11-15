-- Bos Pangan order cancellation migration.
-- Run after checkout.sql and customer-accounts.sql.
-- Customers may cancel only their own unpaid orders before admin confirmation.
-- Cancelled regular orders return reserved stock through the trigger below.

begin;

create or replace function public.restore_stock_for_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Pesanan yang sudah dibatalkan tidak dapat dibuka kembali. Buat pesanan baru.';
  end if;

  if old.status is distinct from new.status
     and new.status = 'cancelled'
     and old.status in ('new','confirmed','processing')
     and old.transaction_type = 'regular' then
    update public.products p
    set stock = p.stock + oi.quantity,
        updated_at = now()
    from public.order_items oi
    where oi.order_id = new.id
      and oi.product_id = p.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restore_stock_for_cancelled_order on public.orders;
create trigger trg_restore_stock_for_cancelled_order
after update of status on public.orders
for each row execute function public.restore_stock_for_cancelled_order();

create or replace function public.cancel_customer_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.uid() is null or not public.is_customer() then
    raise exception 'Silakan login menggunakan akun pelanggan.';
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
    and customer_id = auth.uid()
  for update;

  if not found then
    raise exception 'Pesanan tidak ditemukan pada akun Anda.';
  end if;

  if v_order.payment_status <> 'unpaid' then
    raise exception 'Pesanan yang sudah memiliki pembayaran tidak dapat dibatalkan otomatis. Hubungi Admin.';
  end if;

  if not (
    (v_order.transaction_type = 'regular' and v_order.status = 'new')
    or
    (v_order.transaction_type = 'special' and v_order.status = 'quoted')
  ) then
    raise exception 'Pesanan hanya dapat dibatalkan sebelum dikonfirmasi atau diproses Admin.';
  end if;

  update public.orders
  set status = 'cancelled',
      updated_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', 'cancelled'
  );
end;
$$;

revoke all on function public.cancel_customer_order(uuid) from public;
grant execute on function public.cancel_customer_order(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
