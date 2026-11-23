-- Fix for Step 10b: an order's total must allow for a booking deposit taken off.
-- The first schema required total = subtotal + delivery fee, which refused deposit orders.
alter table public.orders drop constraint if exists orders_check;
alter table public.orders add constraint orders_check check (total_pence = subtotal_pence + delivery_fee_pence - deposit_credit_pence);
