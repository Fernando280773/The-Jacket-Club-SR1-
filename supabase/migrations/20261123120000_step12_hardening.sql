-- Step 12: tidy-ups found by the Supabase advisors.

-- 1. Two identical bookings indexes; keep one.
drop index if exists public.bookings_shop_starts;

-- 2. Indexes for foreign keys used on hot paths (lookups and cascading deletes).
create index if not exists items_category_id_idx on public.items (category_id);
create index if not exists options_shop_id_idx on public.options (shop_id);
create index if not exists item_option_groups_group_id_idx on public.item_option_groups (group_id);
create index if not exists item_allergens_allergen_id_idx on public.item_allergens (allergen_id);
create index if not exists option_allergens_allergen_id_idx on public.option_allergens (allergen_id);
create index if not exists customers_auth_user_id_idx on public.customers (auth_user_id);
create index if not exists customers_shop_id_idx on public.customers (shop_id);
create index if not exists addresses_customer_id_idx on public.addresses (customer_id);
create index if not exists staff_users_shop_id_idx on public.staff_users (shop_id);
create index if not exists baskets_customer_id_idx on public.baskets (customer_id);
create index if not exists baskets_dining_table_id_idx on public.baskets (dining_table_id);
create index if not exists baskets_shop_id_idx on public.baskets (shop_id);
create index if not exists basket_lines_item_id_idx on public.basket_lines (item_id);
create index if not exists basket_line_options_option_id_idx on public.basket_line_options (option_id);
create index if not exists orders_booking_id_idx on public.orders (booking_id);
create index if not exists orders_dining_table_id_idx on public.orders (dining_table_id);
create index if not exists order_lines_item_id_idx on public.order_lines (item_id);
create index if not exists order_line_options_option_id_idx on public.order_line_options (option_id);
create index if not exists order_line_options_order_line_id_idx on public.order_line_options (order_line_id);
create index if not exists bookings_customer_id_idx on public.bookings (customer_id);
create index if not exists bookings_deposit_used_order_id_idx on public.bookings (deposit_used_order_id);
create index if not exists payments_shop_id_idx on public.payments (shop_id);
create index if not exists refunds_payment_id_idx on public.refunds (payment_id);
create index if not exists deliveries_address_id_idx on public.deliveries (address_id);
create index if not exists driver_assignments_delivery_id_idx on public.driver_assignments (delivery_id);

-- 3. "owner manages" rules only ever apply to signed-in staff; stop checking them for anonymous visitors.
alter policy "owner manages" on public.categories to authenticated;
alter policy "owner manages" on public.option_groups to authenticated;
alter policy "owner manages" on public.staff_users to authenticated;
