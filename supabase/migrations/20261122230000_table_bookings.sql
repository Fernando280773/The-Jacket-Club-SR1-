-- Step 10b: table bookings with a deposit.
-- The server (service role) does all booking writes; staff read bookings through the existing policies.
-- booking_tables_no_overlap (from the first migration) makes double-booking a table impossible.

alter table public.bookings
  add column if not exists access_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists hold_expires_at timestamptz,
  add column if not exists stripe_session_id text,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists refunded_pence integer not null default 0 check (refunded_pence >= 0),
  add column if not exists deposit_used_order_id uuid references public.orders(id) on delete set null;
create unique index if not exists bookings_access_token_key on public.bookings (access_token);
create index if not exists bookings_shop_starts on public.bookings (shop_id, starts_at);

alter table public.orders
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists deposit_credit_pence integer not null default 0 check (deposit_credit_pence >= 0);

-- Unpaid holds older than their expiry give their tables back.
create or replace function public.release_expired_booking_holds(p_shop_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
  update public.booking_tables bt set is_active = false
  from public.bookings b
  where b.id = bt.booking_id and b.shop_id = p_shop_id and b.status = 'pending_payment' and b.hold_expires_at < now() and bt.is_active;
  update public.bookings set status = 'cancelled', note = coalesce(note, 'Payment not completed')
  where shop_id = p_shop_id and status = 'pending_payment' and hold_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Hold tables while the customer pays. Raises booking_tables_no_overlap if a table was just taken.
create or replace function public.create_booking_hold(
  p_shop_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_party integer, p_deposit_pence integer,
  p_table_ids uuid[], p_name text, p_phone text, p_email text, p_hold_minutes integer
) returns table (booking_id uuid, access_token text)
language plpgsql security invoker set search_path = '' as $$
declare v_booking uuid; v_token text;
begin
  perform 1 from public.shops s where s.id = p_shop_id for update; -- one booking at a time per shop
  perform public.release_expired_booking_holds(p_shop_id);
  if exists (select 1 from public.dining_tables t where t.id = any(p_table_ids) and (t.shop_id <> p_shop_id or not t.is_bookable)) then
    raise exception 'table not bookable';
  end if;
  insert into public.bookings (shop_id, starts_at, ends_at, party_size, deposit_pence, status, customer_name, customer_phone, customer_email, hold_expires_at)
  values (p_shop_id, p_starts_at, p_ends_at, p_party, p_deposit_pence, 'pending_payment', p_name, p_phone, nullif(p_email, ''), now() + make_interval(mins => p_hold_minutes))
  returning id, bookings.access_token into v_booking, v_token;
  insert into public.booking_tables (booking_id, dining_table_id, starts_at, ends_at, is_active)
  select v_booking, t, p_starts_at, p_ends_at, true from unnest(p_table_ids) t;
  return query select v_booking, v_token;
end;
$$;

-- Payment confirmed by Stripe. Safe to call twice. Returns 'confirmed', or 'conflict' if the hold had
-- already run out and the tables were taken (the server then refunds).
create or replace function public.confirm_booking(p_booking_id uuid, p_payment_intent text, p_amount_pence integer)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_b public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking % not found', p_booking_id; end if;
  if exists (select 1 from public.payments where stripe_payment_intent_id = p_payment_intent) then
    return case when v_b.status = 'cancelled' and v_b.note like 'PAID BUT%' then 'conflict' else 'confirmed' end;
  end if;

  insert into public.payments (shop_id, booking_id, stripe_payment_intent_id, amount_pence, status)
  values (v_b.shop_id, v_b.id, p_payment_intent, p_amount_pence, 'succeeded');

  if v_b.status = 'pending_payment' then
    update public.bookings set status = 'confirmed', hold_expires_at = null where id = v_b.id;
    return 'confirmed';
  end if;
  if v_b.status = 'cancelled' then
    begin
      update public.booking_tables set is_active = true where booking_id = v_b.id;
      update public.bookings set status = 'confirmed', hold_expires_at = null, note = null where id = v_b.id;
      return 'confirmed';
    exception when exclusion_violation then
      update public.bookings set note = 'PAID BUT TABLES TAKEN: deposit refunded' where id = v_b.id;
      return 'conflict';
    end;
  end if;
  return 'confirmed';
end;
$$;

-- Cancel or mark a no-show; the tables become free.
create or replace function public.close_booking(p_booking_id uuid, p_status public.booking_status, p_refunded_pence integer, p_note text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('cancelled', 'no_show', 'completed') then raise exception 'bad status'; end if;
  update public.booking_tables set is_active = false where booking_id = p_booking_id;
  update public.bookings
  set status = p_status, refunded_pence = refunded_pence + greatest(p_refunded_pence, 0), note = coalesce(p_note, note), hold_expires_at = null
  where id = p_booking_id;
end;
$$;

-- Move a confirmed booking to a new time and tables. Raises booking_tables_no_overlap if they're taken.
create or replace function public.move_booking(p_booking_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_table_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.bookings where id = p_booking_id and status = 'confirmed' for update;
  if not found then raise exception 'only confirmed bookings can be moved'; end if;
  delete from public.booking_tables where booking_id = p_booking_id;
  insert into public.booking_tables (booking_id, dining_table_id, starts_at, ends_at, is_active)
  select p_booking_id, t, p_starts_at, p_ends_at, true from unnest(p_table_ids) t;
  update public.bookings set starts_at = p_starts_at, ends_at = p_ends_at where id = p_booking_id;
end;
$$;

-- Orders: optionally take a booking's deposit off, once per booking.
drop function if exists public.create_order_from_basket(uuid, text, integer, text, text, text, timestamptz);

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
          case when v_basket.order_type = 'collect' then p_pickup_at end,
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

  -- Booking deposit: only once per booking, never more than the deposit or the food.
  if p_booking_id is not null and p_credit_pence > 0 then
    update public.bookings b set deposit_used_order_id = v_order
    where b.id = p_booking_id and b.deposit_used_order_id is null and b.status = 'confirmed'
    returning least(p_credit_pence, b.deposit_pence, v_subtotal) into v_credit;
    v_credit := coalesce(v_credit, 0);
  end if;

  if v_subtotal - v_credit <> p_amount_pence then
    v_note := format('Check payment: paid %s pence, menu total %s pence less deposit %s pence', p_amount_pence, v_subtotal, v_credit);
  end if;

  update public.orders
  set subtotal_pence = v_subtotal, deposit_credit_pence = v_credit, total_pence = v_subtotal - v_credit,
      booking_id = case when v_credit > 0 then p_booking_id end, note = v_note
  where id = v_order;

  insert into public.payments (shop_id, order_id, stripe_payment_intent_id, amount_pence, status)
  values (v_basket.shop_id, v_order, p_payment_intent, p_amount_pence, 'succeeded');

  delete from public.baskets where id = v_basket.id;

  return query select v_order, v_number, true;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.release_expired_booking_holds(uuid)',
    'public.create_booking_hold(uuid, timestamptz, timestamptz, integer, integer, uuid[], text, text, text, integer)',
    'public.confirm_booking(uuid, text, integer)',
    'public.close_booking(uuid, public.booking_status, integer, text)',
    'public.move_booking(uuid, timestamptz, timestamptz, uuid[])',
    'public.create_order_from_basket(uuid, text, integer, text, text, text, timestamptz, uuid, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
