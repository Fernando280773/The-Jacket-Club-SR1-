-- Step 20: item labels (one sticker per item), printed by a label printer that collects jobs
-- from the site (Star CloudPRNT). The printer talks to the server only; staff can reprint.

-- 1. Settings: off until the owner switches labels on.
alter table public.shop_settings
  add column if not exists labels_enabled boolean not null default false,
  add column if not exists label_order_types public.order_type[] not null default '{collect,delivery}';

-- 2. Printers seen by the server (status for the kitchen screen).
create table if not exists public.label_printers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  mac text not null check (char_length(mac) <= 40),
  status text check (char_length(status) <= 80),
  last_seen_at timestamptz not null default now(),
  unique (shop_id, mac)
);
alter table public.label_printers enable row level security;
comment on table public.label_printers is 'Written by printer_poll() (server only). Read through staff_label_status().';

-- 3. The print queue. One row = one sticker. The label content is copied when queued.
create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  label jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'printing', 'done', 'failed')),
  attempts integer not null default 0,
  is_reprint boolean not null default false,
  printer_mac text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printed_at timestamptz
);
create index if not exists print_jobs_queue_idx on public.print_jobs (shop_id, status, created_at);
create index if not exists print_jobs_order_id_idx on public.print_jobs (order_id);
alter table public.print_jobs enable row level security;
comment on table public.print_jobs is 'Server only (service role). Staff queue reprints through enqueue_order_labels().';

-- 4. The labels for an order: one per item (a quantity of 2 gives 2 labels), with options and allergens.
create or replace function private.order_label_rows(p_order_id uuid)
returns table (label jsonb) language sql stable security definer set search_path = '' as $$
  with o as (
    select ord.*, t.number as table_number
    from public.orders ord left join public.dining_tables t on t.id = ord.dining_table_id
    where ord.id = p_order_id
  ),
  units as (
    select l.id as line_id, l.item_id, l.item_name,
           row_number() over (order by l.id, g.n) as position,
           count(*) over () as total
    from public.order_lines l
    cross join lateral generate_series(1, l.quantity) as g(n)
    where l.order_id = p_order_id
  )
  select jsonb_build_object(
    'position', u.position,
    'total', u.total,
    'name', coalesce(private.first_name(o.customer_name), 'Customer'),
    'number', o.number,
    'type', o.type,
    'pickup_at', o.pickup_at,
    'table_number', o.table_number,
    'created_at', o.created_at,
    'staff_test', o.is_staff_test,
    'token', o.access_token,
    'item_name', u.item_name,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object('name', lo.option_name, 'count', lo.count) order by lo.id)
      from public.order_line_options lo where lo.order_line_id = u.line_id
    ), '[]'::jsonb),
    'allergens', coalesce((
      select jsonb_agg(x.name order by x.name) from (
        select a.name from public.item_allergens ia join public.allergens a on a.id = ia.allergen_id where ia.item_id = u.item_id
        union
        select a.name from public.order_line_options lo
          join public.option_allergens oa on oa.option_id = lo.option_id
          join public.allergens a on a.id = oa.allergen_id
        where lo.order_line_id = u.line_id
      ) x
    ), '[]'::jsonb)
  )
  from units u cross join o
  order by u.position;
$$;
revoke execute on function private.order_label_rows(uuid) from public;

-- 5. Queue an order's labels. The server calls this when an order is paid (once per order, and only
--    when labels are on for that order type). Kitchen and owner call it with p_reprint = true.
create or replace function public.enqueue_order_labels(p_order_id uuid, p_reprint boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_settings public.shop_settings;
  v_staff public.staff_users;
  v_server boolean := coalesce((select auth.role()), '') = 'service_role';
  v_count integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if not v_server then
    v_staff := private.my_staff(v_order.shop_id);
    if v_staff.id is null or v_staff.role not in ('owner', 'kitchen') then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    p_reprint := true;
  end if;

  if not p_reprint then
    select * into v_settings from public.shop_settings where shop_id = v_order.shop_id;
    if not coalesce(v_settings.labels_enabled, false) or not (v_order.type = any (v_settings.label_order_types)) then
      return 0;
    end if;
    if exists (select 1 from public.print_jobs where order_id = p_order_id) then
      return 0;
    end if;
  end if;

  insert into public.print_jobs (shop_id, order_id, label, is_reprint)
  select v_order.shop_id, p_order_id, r.label, p_reprint from private.order_label_rows(p_order_id) r;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 6. A test label (owner or kitchen), to check the printer and the paper.
create or replace function public.staff_print_test_label(p_shop_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_staff public.staff_users := private.my_staff(p_shop_id);
begin
  if v_staff.id is null or v_staff.role not in ('owner', 'kitchen') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.print_jobs (shop_id, label, is_reprint)
  values (p_shop_id, jsonb_build_object(
    'position', 1, 'total', 1, 'name', 'Test', 'number', 0, 'type', 'collect',
    'pickup_at', now(), 'table_number', null, 'created_at', now(), 'staff_test', true, 'token', null,
    'item_name', 'Test label',
    'options', jsonb_build_array(jsonb_build_object('name', 'If you can read this, labels work', 'count', 1)),
    'allergens', '[]'::jsonb
  ), true);
end;
$$;

-- 7. Owner: switch labels on or off and choose which order types get them.
create or replace function public.admin_set_labels(p_shop_id uuid, p_enabled boolean, p_types public.order_type[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff(p_shop_id, array['owner']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.shop_settings
  set labels_enabled = coalesce(p_enabled, false),
      label_order_types = coalesce(p_types, '{}')
  where shop_id = p_shop_id;
end;
$$;

-- 8. Kitchen and owner: is the printer there, and is anything waiting?
create or replace function public.staff_label_status(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_staff public.staff_users := private.my_staff(p_shop_id);
begin
  if v_staff.id is null or v_staff.role not in ('owner', 'kitchen') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'enabled', s.labels_enabled,
      'types', s.label_order_types,
      'printer_seen_at', (select max(p.last_seen_at) from public.label_printers p where p.shop_id = p_shop_id),
      'printer_status', (select p.status from public.label_printers p where p.shop_id = p_shop_id order by p.last_seen_at desc limit 1),
      'waiting', (select count(*) from public.print_jobs j where j.shop_id = p_shop_id and j.status in ('queued', 'printing')),
      'failed_today', (select count(*) from public.print_jobs j where j.shop_id = p_shop_id and j.status = 'failed' and j.created_at > now() - interval '12 hours')
    )
    from public.shop_settings s where s.shop_id = p_shop_id
  );
end;
$$;

-- 9. Printer side (server only). Poll: note the printer, put stuck jobs back, say if a job is waiting.
create or replace function public.printer_poll(p_shop_id uuid, p_mac text, p_status text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_job uuid;
begin
  insert into public.label_printers (shop_id, mac, status, last_seen_at)
  values (p_shop_id, left(coalesce(p_mac, 'unknown'), 40), left(p_status, 80), now())
  on conflict (shop_id, mac) do update set status = excluded.status, last_seen_at = now();

  -- A job the printer took but never confirmed goes back in the queue (three tries, then failed).
  update public.print_jobs
  set status = case when attempts >= 3 then 'failed' else 'queued' end
  where shop_id = p_shop_id and status = 'printing' and claimed_at < now() - interval '2 minutes';

  -- Labels nobody collected for 2 hours are dropped, so a printer switched on later doesn't print old orders.
  update public.print_jobs set status = 'failed'
  where shop_id = p_shop_id and status = 'queued' and created_at < now() - interval '2 hours';

  select id into v_job from public.print_jobs
  where shop_id = p_shop_id and status = 'queued'
  order by created_at, (label ->> 'position')::int
  limit 1;
  return v_job;
end;
$$;

-- Take the next job (marks it printing) and return its label.
create or replace function public.claim_print_job(p_shop_id uuid, p_mac text)
returns table (job_id uuid, label jsonb) language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.print_jobs j
  set status = 'printing', attempts = j.attempts + 1, claimed_at = now(), printer_mac = left(p_mac, 40)
  where j.id = (
    select q.id from public.print_jobs q
    where q.shop_id = p_shop_id and q.status = 'queued'
    order by q.created_at, (q.label ->> 'position')::int
    limit 1
    for update skip locked
  )
  returning j.id, j.label;
end;
$$;

-- The printer says how the job it was printing went.
create or replace function public.finish_print_job(p_shop_id uuid, p_mac text, p_ok boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.print_jobs
  set status = case when p_ok then 'done' when attempts >= 3 then 'failed' else 'queued' end,
      printed_at = case when p_ok then now() end
  where shop_id = p_shop_id and status = 'printing' and printer_mac = left(p_mac, 40);
end;
$$;

revoke execute on function public.enqueue_order_labels(uuid, boolean) from public, anon;
revoke execute on function public.staff_print_test_label(uuid) from public, anon;
revoke execute on function public.admin_set_labels(uuid, boolean, public.order_type[]) from public, anon;
revoke execute on function public.staff_label_status(uuid) from public, anon;
revoke execute on function public.printer_poll(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.claim_print_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.finish_print_job(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.enqueue_order_labels(uuid, boolean) to authenticated, service_role;
grant execute on function public.staff_print_test_label(uuid) to authenticated;
grant execute on function public.admin_set_labels(uuid, boolean, public.order_type[]) to authenticated;
grant execute on function public.staff_label_status(uuid) to authenticated;
grant execute on function public.printer_poll(uuid, text, text) to service_role;
grant execute on function public.claim_print_job(uuid, text) to service_role;
grant execute on function public.finish_print_job(uuid, text, boolean) to service_role;
