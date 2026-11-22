-- Step 9: kitchen screen.
-- Staff change an order's status only through set_order_status (one step forward, or one step back to undo).
-- The old broad update policy let staff change any column of an order, so it goes.

drop policy if exists "kitchen updates status" on public.orders;

-- Allowed moves, by order type. Forward is the normal tap; back is Undo.
create or replace function private.next_status(p_type public.order_type, p_status public.order_status)
returns public.order_status language sql immutable set search_path = '' as $$
  select case
    when p_status = 'received' then 'preparing'::public.order_status
    when p_status = 'preparing' then 'ready'::public.order_status
    when p_status = 'ready' and p_type = 'delivery' then 'out_for_delivery'::public.order_status
    when p_status = 'ready' then 'collected'::public.order_status
    when p_status = 'out_for_delivery' then 'delivered'::public.order_status
  end;
$$;

create or replace function private.previous_status(p_type public.order_type, p_status public.order_status)
returns public.order_status language sql immutable set search_path = '' as $$
  select case
    when p_status = 'preparing' then 'received'::public.order_status
    when p_status = 'ready' then 'preparing'::public.order_status
    when p_status = 'collected' and p_type <> 'delivery' then 'ready'::public.order_status
    when p_status = 'out_for_delivery' then 'ready'::public.order_status
    when p_status = 'delivered' then 'out_for_delivery'::public.order_status
  end;
$$;

-- Called from the kitchen tablet by a signed-in staff member.
-- p_from must match the current status, so two taps (or two tablets) can't skip a step.
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

  update public.orders set status = p_to where id = p_order_id;
  return p_to;
end;
$$;

revoke execute on function private.next_status(public.order_type, public.order_status) from public;
revoke execute on function private.previous_status(public.order_type, public.order_status) from public;
revoke execute on function public.set_order_status(uuid, public.order_status, public.order_status) from public, anon;
grant execute on function public.set_order_status(uuid, public.order_status, public.order_status) to authenticated;

comment on function public.set_order_status is
  'Kitchen tablet: move an order one step forward, or one step back (undo). Staff of the order''s shop only.';

-- Live updates for the kitchen screen. Realtime still applies the orders read policy, so only staff get events.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
