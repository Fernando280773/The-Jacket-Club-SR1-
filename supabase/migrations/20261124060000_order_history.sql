-- Step 13b: order history, a status log and problem reports.
-- Kitchen staff see the last 7 days with first names and phone endings only; the owner sees everything.

-- 1. Every status change is logged with who made it (null when the system did it, e.g. a new paid order).
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  staff_id uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_id_idx on public.order_events (order_id, created_at);
create index if not exists order_events_shop_id_idx on public.order_events (shop_id);
create index if not exists order_events_staff_id_idx on public.order_events (staff_id);
alter table public.order_events enable row level security;
comment on table public.order_events is 'Read through staff_order_detail() only. Written by the orders trigger.';

create or replace function private.log_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_staff uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select s.id into v_staff from public.staff_users s where s.auth_user_id = (select auth.uid()) and s.shop_id = new.shop_id limit 1;
  insert into public.order_events (shop_id, order_id, from_status, to_status, staff_id)
  values (new.shop_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, v_staff);
  return new;
end;
$$;
revoke execute on function private.log_order_event() from public;

drop trigger if exists orders_log_event on public.orders;
create trigger orders_log_event after insert or update of status on public.orders
  for each row execute function private.log_order_event();

-- 2. Problem reports (missing item, wrong item, ...). Refunds themselves are done in Stripe by the owner.
create table if not exists public.order_issues (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('missing_item', 'wrong_item', 'late', 'cold', 'other')),
  item_names text[] not null default '{}',
  note text check (char_length(note) <= 500),
  action text not null check (action in ('remade', 'refunded', 'voucher', 'none')),
  refund_pence integer not null default 0 check (refund_pence >= 0),
  staff_id uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_issues_order_id_idx on public.order_issues (order_id);
create index if not exists order_issues_shop_id_created_idx on public.order_issues (shop_id, created_at);
create index if not exists order_issues_staff_id_idx on public.order_issues (staff_id);
alter table public.order_issues enable row level security;
comment on table public.order_issues is 'Written by report_order_issue(), read through the history functions only.';

-- Helper: the caller's staff row for a shop.
create or replace function private.my_staff(p_shop_id uuid)
returns public.staff_users language sql stable security definer set search_path = '' as $$
  select s.* from public.staff_users s
  where s.auth_user_id = (select auth.uid()) and s.shop_id = p_shop_id and s.is_active
  limit 1;
$$;
revoke execute on function private.my_staff(uuid) from public;

create or replace function private.first_name(p text)
returns text language sql immutable set search_path = '' as $$
  select nullif(split_part(trim(coalesce(p, '')), ' ', 1), '');
$$;

-- 3. History list. Kitchen: last 7 days (UK dates), first name + last 4 phone digits. Owner: everything.
create or replace function public.staff_order_history(
  p_shop_id uuid,
  p_from date,
  p_to date,
  p_search text default null,
  p_type public.order_type default null,
  p_status public.order_status default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_staff public.staff_users;
  v_owner boolean;
  v_from date;
  v_to date;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_q text := nullif(trim(coalesce(p_search, '')), '');
  v_rows jsonb;
begin
  v_staff := private.my_staff(p_shop_id);
  if v_staff.id is null or v_staff.role not in ('owner', 'kitchen') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_owner := v_staff.role = 'owner';
  v_from := coalesce(p_from, v_today);
  v_to := coalesce(p_to, v_today);
  if not v_owner then
    v_from := greatest(v_from, v_today - 6);
    v_to := least(v_to, v_today);
  end if;

  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) into v_rows from (
    select
      o.id, o.number, o.type, o.status, o.created_at, o.pickup_at, o.total_pence, o.is_staff_test,
      case when v_owner then o.customer_name else private.first_name(o.customer_name) end as customer_name,
      case when v_owner then o.customer_phone else right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 4) end as phone,
      t.number as table_number,
      (select count(*) from public.order_issues i where i.order_id = o.id) as issue_count
    from public.orders o
    left join public.dining_tables t on t.id = o.dining_table_id
    where o.shop_id = p_shop_id
      and (o.created_at at time zone 'Europe/London')::date between v_from and v_to
      and (p_type is null or o.type = p_type)
      and (p_status is null or o.status = p_status)
      and (
        v_q is null
        or o.number::text = v_q
        or o.customer_name ilike '%' || v_q || '%'
        or (length(regexp_replace(v_q, '\D', '', 'g')) >= 3
            and regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g') like '%' || regexp_replace(v_q, '\D', '', 'g'))
      )
    order by o.created_at desc
    limit 300
  ) r;

  return jsonb_build_object('from', v_from, 'to', v_to, 'owner', v_owner, 'orders', v_rows);
end;
$$;

-- 4. One order in full: lines, options, status timeline with staff names, delivery, payment and problems.
create or replace function public.staff_order_detail(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_staff public.staff_users;
  v_owner boolean;
  v_today date := (now() at time zone 'Europe/London')::date;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'order not found' using errcode = 'P0002'; end if;
  v_staff := private.my_staff(v_order.shop_id);
  if v_staff.id is null or v_staff.role not in ('owner', 'kitchen') then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  v_owner := v_staff.role = 'owner';
  if not v_owner and (v_order.created_at at time zone 'Europe/London')::date < v_today - 6 then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_order.id,
    'number', v_order.number,
    'type', v_order.type,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'pickup_at', v_order.pickup_at,
    'note', v_order.note,
    'is_staff_test', v_order.is_staff_test,
    'subtotal_pence', v_order.subtotal_pence,
    'delivery_fee_pence', v_order.delivery_fee_pence,
    'deposit_credit_pence', v_order.deposit_credit_pence,
    'total_pence', v_order.total_pence,
    'receipt_sent_at', v_order.receipt_sent_at,
    'owner', v_owner,
    'customer_name', case when v_owner then v_order.customer_name else private.first_name(v_order.customer_name) end,
    'phone', case when v_owner then v_order.customer_phone else right(regexp_replace(coalesce(v_order.customer_phone, ''), '\D', '', 'g'), 4) end,
    'has_email', exists (select 1 from public.customers c where c.id = v_order.customer_id and c.email is not null),
    'table_number', (select t.number from public.dining_tables t where t.id = v_order.dining_table_id),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_name', l.item_name, 'quantity', l.quantity, 'line_total_pence', l.line_total_pence,
        'options', coalesce((select jsonb_agg(jsonb_build_object('group_name', lo.group_name, 'option_name', lo.option_name, 'count', lo.count) order by lo.group_name, lo.option_name)
                             from public.order_line_options lo where lo.order_line_id = l.id), '[]'::jsonb)
      ) order by l.id)
      from public.order_lines l where l.order_id = v_order.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('from_status', e.from_status, 'to_status', e.to_status, 'at', e.created_at, 'staff', s.name) order by e.created_at)
      from public.order_events e left join public.staff_users s on s.id = e.staff_id where e.order_id = v_order.id), '[]'::jsonb),
    'delivery', (
      select jsonb_build_object(
        'address', case when v_owner then d.address_text else d.postcode end,
        'postcode', d.postcode, 'note', d.note, 'distance_miles', d.distance_miles,
        'driver', (select s.name from public.driver_assignments a join public.staff_users s on s.id = a.driver_id where a.delivery_id = d.id order by a.assigned_at desc limit 1),
        'picked_up_at', (select a.picked_up_at from public.driver_assignments a where a.delivery_id = d.id order by a.assigned_at desc limit 1),
        'delivered_at', (select a.delivered_at from public.driver_assignments a where a.delivery_id = d.id order by a.assigned_at desc limit 1))
      from public.deliveries d where d.order_id = v_order.id),
    'issues', coalesce((
      select jsonb_agg(jsonb_build_object('kind', i.kind, 'item_names', i.item_names, 'note', i.note, 'action', i.action,
                                          'refund_pence', i.refund_pence, 'staff', s.name, 'at', i.created_at) order by i.created_at)
      from public.order_issues i left join public.staff_users s on s.id = i.staff_id where i.order_id = v_order.id), '[]'::jsonb)
  );
end;
$$;

-- 5. Report a problem on an order.
create or replace function public.report_order_issue(
  p_order_id uuid, p_kind text, p_item_names text[], p_note text, p_action text, p_refund_pence integer default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_staff public.staff_users;
  v_id uuid;
  v_today date := (now() at time zone 'Europe/London')::date;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'order not found' using errcode = 'P0002'; end if;
  v_staff := private.my_staff(v_order.shop_id);
  if v_staff.id is null or v_staff.role not in ('owner', 'kitchen') then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_staff.role <> 'owner' and (v_order.created_at at time zone 'Europe/London')::date < v_today - 6 then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if p_action = 'refunded' and coalesce(p_refund_pence, 0) <= 0 then
    raise exception 'enter the refund amount' using errcode = 'P0001';
  end if;
  if coalesce(p_refund_pence, 0) > v_order.total_pence then
    raise exception 'refund is more than the order total' using errcode = 'P0001';
  end if;
  insert into public.order_issues (shop_id, order_id, kind, item_names, note, action, refund_pence, staff_id)
  values (v_order.shop_id, v_order.id, p_kind, coalesce(p_item_names, '{}'), nullif(trim(coalesce(p_note, '')), ''), p_action,
          case when p_action = 'refunded' then p_refund_pence else 0 end, v_staff.id)
  returning id into v_id;
  return v_id;
end;
$$;

-- 6. Owner: problems by type over the last N days.
create or replace function public.order_issue_summary(p_shop_id uuid, p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_staff public.staff_users;
begin
  v_staff := private.my_staff(p_shop_id);
  if v_staff.id is null or v_staff.role <> 'owner' then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_object_agg(kind, n) from (
      select i.kind, count(*) n from public.order_issues i
      where i.shop_id = p_shop_id and i.created_at >= now() - make_interval(days => greatest(1, least(p_days, 366)))
      group by i.kind) x), '{}'::jsonb);
end;
$$;

revoke execute on function public.staff_order_history(uuid, date, date, text, public.order_type, public.order_status) from public, anon;
revoke execute on function public.staff_order_detail(uuid) from public, anon;
revoke execute on function public.report_order_issue(uuid, text, text[], text, text, integer) from public, anon;
revoke execute on function public.order_issue_summary(uuid, integer) from public, anon;
grant execute on function public.staff_order_history(uuid, date, date, text, public.order_type, public.order_status) to authenticated;
grant execute on function public.staff_order_detail(uuid) to authenticated;
grant execute on function public.report_order_issue(uuid, text, text[], text, text, integer) to authenticated;
grant execute on function public.order_issue_summary(uuid, integer) to authenticated;
