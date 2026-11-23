-- Step 10c: delivery with our own drivers.
-- Also fixes two earlier rules found while building it:
--   * the order status rule only allowed forward moves, so the kitchen's one-step Undo failed;
--   * move_booking inserted the new tables before changing the booking time, so the slot-copy trigger used the old time.

-- ---------- Fix: order status forward, plus exactly one step back (kitchen Undo) ----------
create or replace function public.check_order_status_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status = 'cancelled' and old.status not in ('collected', 'delivered') then
    return new;
  end if;
  if (old.status = 'received' and new.status = 'preparing')
     or (old.status = 'preparing' and new.status = 'ready')
     or (old.status = 'ready' and new.status = 'collected')
     or (old.status = 'ready' and new.status = 'out_for_delivery')
     or (old.status = 'out_for_delivery' and new.status = 'delivered')
     -- one step back (Undo)
     or (old.status = 'preparing' and new.status = 'received')
     or (old.status = 'ready' and new.status = 'preparing')
     or (old.status = 'collected' and new.status = 'ready')
     or (old.status = 'out_for_delivery' and new.status = 'ready')
     or (old.status = 'delivered' and new.status = 'out_for_delivery') then
    if new.status = 'collected' and new.type = 'delivery' then
      raise exception 'A delivery order cannot be marked collected';
    end if;
    if new.status = 'out_for_delivery' and new.type <> 'delivery' then
      raise exception 'Only delivery orders go out for delivery';
    end if;
    new.updated_at := now();
    return new;
  end if;
  raise exception 'Order status cannot move from % to %', old.status, new.status;
end $$;

-- ---------- Fix: the delivery minimum applies once the order has its real subtotal ----------
-- (create_order_from_basket inserts the order with 0 first, then fills in the totals.)
create or replace function public.check_delivery_minimum()
returns trigger language plpgsql set search_path = '' as $$
declare min_pence integer;
begin
  if new.type = 'delivery' and not (tg_op = 'INSERT' and new.subtotal_pence = 0) then
    select delivery_min_order_pence into min_pence from public.shop_settings where shop_id = new.shop_id;
    if new.subtotal_pence < coalesce(min_pence, 0) then
      raise exception 'Delivery orders need a subtotal of at least % pence', min_pence;
    end if;
  end if;
  return new;
end $$;

-- ---------- Fix: move the booking time first, then add the tables ----------
create or replace function public.move_booking(p_booking_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_table_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.bookings where id = p_booking_id and status = 'confirmed' for update;
  if not found then raise exception 'only confirmed bookings can be moved'; end if;
  delete from public.booking_tables where booking_id = p_booking_id;
  update public.bookings set starts_at = p_starts_at, ends_at = p_ends_at where id = p_booking_id;
  insert into public.booking_tables (booking_id, dining_table_id, starts_at, ends_at, is_active)
  select p_booking_id, t, p_starts_at, p_ends_at, true from unnest(p_table_ids) t;
end;
$$;

-- ---------- Shop location (Mapbox: 12-14 Park Lane, Sunderland SR1 3NX) ----------
update public.shops set latitude = 54.90345, longitude = -1.38565 where slug = 'the-jacket-club-sr1';

-- ---------- Delivery details ----------
alter table public.baskets
  add column if not exists delivery_address text,
  add column if not exists delivery_postcode text,
  add column if not exists delivery_latitude numeric(9,6),
  add column if not exists delivery_longitude numeric(9,6),
  add column if not exists delivery_distance_miles numeric(4,2),
  add column if not exists delivery_fee_pence integer check (delivery_fee_pence >= 0),
  add column if not exists delivery_note text;

alter table public.deliveries
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists note text;

-- ---------- Orders from paid baskets: now with delivery (same signature as before) ----------
create or replace function public.create_order_from_basket(
  p_basket_id uuid,
  p_payment_intent text,
  p_amount_pence integer,
  p_name text,
  p_phone text,
  p_email text,
  p_pickup_at timestamptz,
  p_booking_id uuid default null,
  p_credit_pence integer default 0
) returns table (order_id uuid, order_number integer, created boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_basket public.baskets%rowtype;
  v_existing uuid;
  v_customer uuid;
  v_order uuid;
  v_number integer;
  v_subtotal integer := 0;
  v_credit integer := 0;
  v_fee integer := 0;
  v_note text;
  v_line record;
  v_line_id uuid;
  v_unit integer;
begin
  select p.order_id into v_existing from public.payments p where p.stripe_payment_intent_id = p_payment_intent;
  if v_existing is not null then
    return query select o.id, o.number, false from public.orders o where o.id = v_existing;
    return;
  end if;

  select * into v_basket from public.baskets b where b.id = p_basket_id for update;
  if not found then
    select p.order_id into v_existing from public.payments p where p.stripe_payment_intent_id = p_payment_intent;
    if v_existing is not null then
      return query select o.id, o.number, false from public.orders o where o.id = v_existing;
      return;
    end if;
    raise exception 'basket % not found', p_basket_id;
  end if;

  select p.order_id into v_existing from public.payments p where p.stripe_payment_intent_id = p_payment_intent;
  if v_existing is not null then
    return query select o.id, o.number, false from public.orders o where o.id = v_existing;
    return;
  end if;

  perform 1 from public.shops s where s.id = v_basket.shop_id for update;
  select coalesce(max(o.number), 1000) + 1 into v_number from public.orders o where o.shop_id = v_basket.shop_id;

  insert into public.customers (shop_id, name, phone, email)
  values (v_basket.shop_id, p_name, p_phone, nullif(p_email, ''))
  returning id into v_customer;

  insert into public.orders (shop_id, number, customer_id, customer_name, customer_phone, type, pickup_at, dining_table_id,
                             subtotal_pence, delivery_fee_pence, total_pence)
  values (v_basket.shop_id, v_number, v_customer, p_name, p_phone, v_basket.order_type,
          case when v_basket.order_type in ('collect', 'delivery') then p_pickup_at end,
          case when v_basket.order_type = 'table' then v_basket.dining_table_id end,
          0, 0, 0)
  returning id into v_order;

  for v_line in
    select bl.id, bl.quantity, i.id as item_id, i.name, i.price_pence
    from public.basket_lines bl join public.items i on i.id = bl.item_id
    where bl.basket_id = v_basket.id
    order by bl.id
  loop
    select v_line.price_pence + coalesce(sum(o.price_change_pence * blo.count), 0)::integer into v_unit
    from public.basket_line_options blo join public.options o on o.id = blo.option_id
    where blo.basket_line_id = v_line.id;

    insert into public.order_lines (order_id, item_id, item_name, unit_price_pence, quantity, line_total_pence)
    values (v_order, v_line.item_id, v_line.name, v_unit, v_line.quantity, v_unit * v_line.quantity)
    returning id into v_line_id;

    insert into public.order_line_options (order_line_id, option_id, group_name, option_name, price_change_pence, count)
    select v_line_id, o.id, g.name, o.name, o.price_change_pence, blo.count
    from public.basket_line_options blo
    join public.options o on o.id = blo.option_id
    join public.option_groups g on g.id = o.group_id
    where blo.basket_line_id = v_line.id
    order by g.code, o.sort;

    v_subtotal := v_subtotal + v_unit * v_line.quantity;
  end loop;

  if v_subtotal = 0 then
    raise exception 'basket % is empty', p_basket_id;
  end if;

  if p_booking_id is not null and p_credit_pence > 0 then
    update public.bookings b set deposit_used_order_id = v_order
    where b.id = p_booking_id and b.deposit_used_order_id is null and b.status = 'confirmed'
    returning least(p_credit_pence, b.deposit_pence, v_subtotal) into v_credit;
    v_credit := coalesce(v_credit, 0);
  end if;

  if v_basket.order_type = 'delivery' then
    v_fee := coalesce(v_basket.delivery_fee_pence, 0);
    insert into public.deliveries (order_id, address_text, postcode, distance_miles, fee_pence, latitude, longitude, note)
    values (v_order, v_basket.delivery_address, coalesce(v_basket.delivery_postcode, ''), v_basket.delivery_distance_miles, v_fee,
            v_basket.delivery_latitude, v_basket.delivery_longitude, v_basket.delivery_note);
  end if;

  if v_subtotal - v_credit + v_fee <> p_amount_pence then
    v_note := format('Check payment: paid %s pence, menu total %s pence less deposit %s plus delivery %s', p_amount_pence, v_subtotal, v_credit, v_fee);
  end if;

  update public.orders
  set subtotal_pence = v_subtotal, deposit_credit_pence = v_credit, delivery_fee_pence = v_fee,
      total_pence = v_subtotal - v_credit + v_fee,
      booking_id = case when v_credit > 0 then p_booking_id end, note = v_note
  where id = v_order;

  insert into public.payments (shop_id, order_id, stripe_payment_intent_id, amount_pence, status)
  values (v_basket.shop_id, v_order, p_payment_intent, p_amount_pence, 'succeeded');

  delete from public.baskets where id = v_basket.id;

  return query select v_order, v_number, true;
end;
$$;

-- ---------- Drivers ----------
-- Orders a signed-in driver is assigned to (security definer: avoids policy loops between orders and deliveries).
create or replace function private.my_driver_order_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select d.order_id
  from public.deliveries d
  join public.driver_assignments a on a.delivery_id = d.id
  join public.staff_users s on s.id = a.driver_id
  where s.auth_user_id = (select auth.uid()) and s.is_active and s.role = 'driver';
$$;
revoke execute on function private.my_driver_order_ids() from public;
grant execute on function private.my_driver_order_ids() to authenticated;

drop policy if exists "drivers see their orders" on public.orders;
create policy "drivers see their orders" on public.orders for select to authenticated using (id in (select private.my_driver_order_ids()));

-- Kitchen and owner: the shop's active drivers, to assign one.
create or replace function public.shop_drivers(p_shop_id uuid)
returns table (id uuid, name text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff(p_shop_id, array['owner','kitchen']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select s.id, s.name from public.staff_users s where s.shop_id = p_shop_id and s.role = 'driver' and s.is_active order by s.name;
end;
$$;

-- Kitchen and owner: give a delivery to a driver (or change driver before it leaves).
create or replace function public.assign_driver(p_order_id uuid, p_driver_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_delivery uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not private.is_staff(v_order.shop_id, array['owner','kitchen']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_order.type <> 'delivery' or v_order.status not in ('received', 'preparing', 'ready') then
    raise exception 'only delivery orders not yet out can be assigned' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.staff_users s where s.id = p_driver_id and s.shop_id = v_order.shop_id and s.role = 'driver' and s.is_active) then
    raise exception 'not a driver of this shop' using errcode = 'P0001';
  end if;
  select id into v_delivery from public.deliveries where order_id = p_order_id;
  delete from public.driver_assignments where delivery_id = v_delivery;
  insert into public.driver_assignments (delivery_id, driver_id) values (v_delivery, p_driver_id);
  update public.deliveries set status = 'assigned' where id = v_delivery;
end;
$$;

-- Kitchen tablet status changes: a delivery can only go out once a driver is assigned.
create or replace function public.set_order_status(p_order_id uuid, p_from public.order_status, p_to public.order_status)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found or not private.is_staff(v_order.shop_id, array['owner','kitchen']::public.staff_role[]) then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> p_from then
    raise exception 'order is already %', v_order.status using errcode = 'P0001';
  end if;
  if p_to is distinct from private.next_status(v_order.type, v_order.status)
     and p_to is distinct from private.previous_status(v_order.type, v_order.status) then
    raise exception 'cannot move order from % to %', v_order.status, p_to using errcode = 'P0001';
  end if;
  if p_to = 'out_for_delivery' and not exists (
    select 1 from public.deliveries d join public.driver_assignments a on a.delivery_id = d.id where d.order_id = p_order_id
  ) then
    raise exception 'assign a driver first' using errcode = 'P0001';
  end if;

  update public.orders set status = p_to where id = p_order_id;
  return p_to;
end;
$$;

-- Driver's phone: Picked up (out for delivery) and Delivered, only for their own deliveries.
create or replace function public.driver_set_status(p_order_id uuid, p_to public.order_status)
returns public.order_status language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or p_order_id not in (select private.my_driver_order_ids()) then
    raise exception 'not your delivery' using errcode = '42501';
  end if;
  if not ((v_order.status = 'ready' and p_to = 'out_for_delivery') or (v_order.status = 'out_for_delivery' and p_to = 'delivered')) then
    raise exception 'order is %', v_order.status using errcode = 'P0001';
  end if;
  update public.orders set status = p_to where id = p_order_id;
  return p_to;
end;
$$;

-- Keep the delivery record and driver times in step with the order status.
create or replace function public.sync_delivery_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.type <> 'delivery' or new.status = old.status then
    return new;
  end if;
  update public.deliveries d
  set status = case
    when new.status = 'delivered' then 'delivered'::public.delivery_status
    when new.status = 'out_for_delivery' then 'out_for_delivery'::public.delivery_status
    when exists (select 1 from public.driver_assignments a where a.delivery_id = d.id) then 'assigned'::public.delivery_status
    else 'waiting'::public.delivery_status end
  where d.order_id = new.id;
  update public.driver_assignments a
  set picked_up_at = case when new.status in ('out_for_delivery', 'delivered') then coalesce(a.picked_up_at, now()) end,
      delivered_at = case when new.status = 'delivered' then now() end
  from public.deliveries d
  where d.id = a.delivery_id and d.order_id = new.id;
  return new;
end $$;

drop trigger if exists orders_sync_delivery on public.orders;
create trigger orders_sync_delivery
after update of status on public.orders
for each row execute function public.sync_delivery_status();

revoke execute on function public.shop_drivers(uuid) from public, anon;
revoke execute on function public.assign_driver(uuid, uuid) from public, anon;
revoke execute on function public.driver_set_status(uuid, public.order_status) from public, anon;
grant execute on function public.shop_drivers(uuid) to authenticated;
grant execute on function public.assign_driver(uuid, uuid) to authenticated;
grant execute on function public.driver_set_status(uuid, public.order_status) to authenticated;
revoke execute on function public.sync_delivery_status() from public, anon, authenticated;
