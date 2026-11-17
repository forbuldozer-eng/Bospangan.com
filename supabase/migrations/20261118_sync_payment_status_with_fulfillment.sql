-- Bos Pangan: reconcile legacy orders with the admin fulfillment workflow.
-- In this workflow, an order that has reached processing/shipped/completed
-- has already had its payment verified by an administrator.
begin;

update public.orders
set payment_status = 'paid',
    updated_at = now()
where status in ('processing', 'shipped', 'completed')
  and payment_status in ('unpaid', 'pending');

commit;
