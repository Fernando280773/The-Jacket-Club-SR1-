-- Step 7: turn a paid basket into an order, in one transaction.
-- Called only by the server (service role) after Stripe confirms payment.
-- Safe to call twice for the same payment: the second call returns the first order.

alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;

create or replace function public.create_order_from_basket(
  p_basket_id uuid,
  p_payment_intent text,
  p_amount_pence integer,
  p_name text,
  p_phone text,
  p_email text,
  p_pickup_at timestamptz
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
  v_line record;
  v_line_id uuid;
  v_unit integer;
begin
  -- Already done? (webhook and thank-you page can both arrive)
  select p.order_id into v_existing from public.payments p where p.stripe_payment_intent_id = p_payment_intent;
  if v_existing is not null then
    return query select o.id, o.number, false from public.orders o where o.id = v_existing;
    return;
  end if;

  select * into v_basket from public.baskets b where b.id = p_basket_id for update;
  if not found then
    -- Another call finished first and removed the basket.
    select p.order_id into v_existing from public.payments p where p.stripe_payment_intent_id = p_payment_intent;
    if v_existing is not null then
      return query select o.id, o.number, false from public.orders o where o.id = v_existing;
      return;
    end if;
    raise exception 'basket % not found', p_basket_id;
  end if;

  -- Check again now we hold the basket lock.
  select p.order_id into v_existing from public.payments p where p.stripe_payment_intent_id = p_payment_intent;
  if v_existing is not null then
    return query select o.id, o.number, false from public.orders o where o.id = v_existing;
    return;
  end if;

  -- Order numbers per shop start at 1001; lock the shop row so two orders never share a number.
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

  update public.orders
  set subtotal_pence = v_subtotal, total_pence = v_subtotal,
      note = case when v_subtotal <> p_amount_pence
                  then format('Check payment: paid %s pence, menu total %s pence', p_amount_pence, v_subtotal) end
  where id = v_order;

  insert into public.payments (shop_id, order_id, stripe_payment_intent_id, amount_pence, status)
  values (v_basket.shop_id, v_order, p_payment_intent, p_amount_pence, 'succeeded');

  delete from public.baskets where id = v_basket.id;

  return query select v_order, v_number, true;
end;
$$;

revoke execute on function public.create_order_from_basket(uuid, text, integer, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_order_from_basket(uuid, text, integer, text, text, text, timestamptz) to service_role;

comment on function public.create_order_from_basket is
  'Server only. Creates the order, lines, options, customer and payment from a paid basket; idempotent per Stripe payment intent.';
