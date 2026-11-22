-- The Jacket Club SR1: initial schema (Step 3 data model)
-- Money is whole pence. Every shop-owned record carries shop_id (multi-shop ready for Miller AI).

create extension if not exists btree_gist with schema extensions;

-- ---------- Types ----------
create type public.order_type as enum ('collect', 'table', 'delivery');
create type public.order_status as enum ('received', 'preparing', 'ready', 'collected', 'out_for_delivery', 'delivered', 'cancelled');
create type public.booking_status as enum ('pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.staff_role as enum ('owner', 'kitchen', 'driver');
create type public.option_control as enum ('pick_one', 'tick_boxes', 'counter');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');
create type public.delivery_status as enum ('waiting', 'assigned', 'out_for_delivery', 'delivered', 'failed');

-- ---------- Shop ----------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  company text not null,
  address text not null,
  postcode text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  iso_day smallint not null check (iso_day between 1 and 7), -- 1 = Monday
  opens time not null,
  closes time not null,
  check (closes > opens),
  unique (shop_id, iso_day)
);

create table public.shop_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  is_accepting_orders boolean not null default true,
  delivery_first_mile_pence integer not null check (delivery_first_mile_pence >= 0),
  delivery_per_extra_mile_pence integer not null check (delivery_per_extra_mile_pence >= 0),
  delivery_max_miles numeric(4,2) not null check (delivery_max_miles > 0),
  delivery_min_order_pence integer not null check (delivery_min_order_pence >= 0),
  booking_deposit_per_person_pence integer not null check (booking_deposit_per_person_pence >= 0),
  booking_slot_minutes integer not null check (booking_slot_minutes > 0),
  booking_days_ahead integer not null check (booking_days_ahead between 0 and 60),
  booking_max_party integer not null check (booking_max_party > 0),
  booking_refund_notice_hours integer not null check (booking_refund_notice_hours >= 0)
);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  number integer not null check (number > 0),
  seats integer not null check (seats > 0),
  is_bookable boolean not null default true,
  qr_token text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  unique (shop_id, number)
);

-- ---------- Menu ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sort integer not null default 0,
  unique (shop_id, name)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  price_pence integer not null check (price_pence >= 0),
  is_halal boolean not null default true,
  is_available boolean not null default true,
  photo_url text,
  sort integer not null default 0,
  unique (shop_id, code)
);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text not null,
  name text not null,
  is_required boolean not null,
  min_choices integer not null check (min_choices >= 0),
  max_choices integer not null check (max_choices >= 1),
  control public.option_control not null,
  check (min_choices <= max_choices),
  check ((is_required and min_choices >= 1) or (not is_required and min_choices = 0)),
  unique (shop_id, code)
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  group_id uuid not null references public.option_groups(id) on delete cascade,
  name text not null,
  price_change_pence integer not null default 0,
  is_available boolean not null default true,
  sort integer not null default 0,
  unique (group_id, name)
);

create table public.item_option_groups (
  item_id uuid not null references public.items(id) on delete cascade,
  group_id uuid not null references public.option_groups(id) on delete cascade,
  sort integer not null default 0,
  primary key (item_id, group_id)
);

create table public.allergens (
  id smallint primary key,
  name text not null unique
);

create table public.item_allergens (
  item_id uuid not null references public.items(id) on delete cascade,
  allergen_id smallint not null references public.allergens(id),
  primary key (item_id, allergen_id)
);

create table public.option_allergens (
  option_id uuid not null references public.options(id) on delete cascade,
  allergen_id smallint not null references public.allergens(id),
  primary key (option_id, allergen_id)
);

-- ---------- Customers ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  line1 text not null,
  line2 text,
  city text not null default 'Sunderland',
  postcode text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  note text
);

-- ---------- Staff ----------
create table public.staff_users (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  role public.staff_role not null,
  is_active boolean not null default true
);

-- ---------- Basket ----------
create table public.baskets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  device_token text,
  order_type public.order_type not null default 'collect',
  dining_table_id uuid references public.dining_tables(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (customer_id is not null or device_token is not null)
);

create table public.basket_lines (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.baskets(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  note text
);

create table public.basket_line_options (
  id uuid primary key default gen_random_uuid(),
  basket_line_id uuid not null references public.basket_lines(id) on delete cascade,
  option_id uuid not null references public.options(id) on delete cascade,
  count integer not null default 1 check (count between 1 and 12),
  unique (basket_line_id, option_id)
);

-- ---------- Orders ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  number integer not null,
  customer_id uuid references public.customers(id) on delete set null,
  type public.order_type not null,
  status public.order_status not null default 'received',
  pickup_at timestamptz,
  dining_table_id uuid references public.dining_tables(id) on delete set null,
  subtotal_pence integer not null check (subtotal_pence >= 0),
  delivery_fee_pence integer not null default 0 check (delivery_fee_pence >= 0),
  total_pence integer not null check (total_pence >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_pence = subtotal_pence + delivery_fee_pence),
  check (type <> 'table' or dining_table_id is not null),
  check (type = 'delivery' or delivery_fee_pence = 0),
  unique (shop_id, number)
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  item_name text not null,          -- copied at order time
  unit_price_pence integer not null check (unit_price_pence >= 0), -- item price + options, copied at order time
  quantity integer not null check (quantity between 1 and 99),
  line_total_pence integer not null check (line_total_pence = unit_price_pence * quantity)
);

create table public.order_line_options (
  id uuid primary key default gen_random_uuid(),
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  option_id uuid references public.options(id) on delete set null,
  group_name text not null,         -- copied at order time
  option_name text not null,        -- copied at order time
  price_change_pence integer not null,
  count integer not null default 1 check (count between 1 and 12)
);

-- ---------- Bookings ----------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  party_size integer not null check (party_size between 1 and 20),
  deposit_pence integer not null check (deposit_pence >= 0),
  status public.booking_status not null default 'pending_payment',
  note text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.booking_tables (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  dining_table_id uuid not null references public.dining_tables(id) on delete restrict,
  starts_at timestamptz not null,   -- copied from the booking by trigger
  ends_at timestamptz not null,
  is_active boolean not null default true,
  primary key (booking_id, dining_table_id),
  -- No table can hold two active bookings whose slots overlap.
  constraint booking_tables_no_overlap exclude using gist (
    dining_table_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (is_active)
);

-- ---------- Payments ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  stripe_payment_intent_id text unique,
  amount_pence integer not null check (amount_pence >= 0),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  check ((order_id is not null)::int + (booking_id is not null)::int = 1)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  stripe_refund_id text unique,
  amount_pence integer not null check (amount_pence > 0),
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- Delivery ----------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  address_id uuid references public.addresses(id) on delete set null,
  address_text text not null,
  postcode text not null,
  distance_miles numeric(4,2) not null check (distance_miles >= 0),
  fee_pence integer not null check (fee_pence >= 0),
  status public.delivery_status not null default 'waiting'
);

create table public.driver_assignments (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  driver_id uuid not null references public.staff_users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  picked_up_at timestamptz,
  delivered_at timestamptz
);

-- ---------- Indexes ----------
create index on public.items (shop_id, category_id);
create index on public.options (group_id);
create index on public.orders (shop_id, status, created_at);
create index on public.orders (customer_id);
create index on public.order_lines (order_id);
create index on public.bookings (shop_id, starts_at);
create index on public.payments (order_id);
create index on public.payments (booking_id);
create index on public.driver_assignments (driver_id);
create index on public.basket_lines (basket_id);

-- ---------- Rule: order status only moves forward ----------
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
     or (old.status = 'out_for_delivery' and new.status = 'delivered') then
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

create trigger orders_status_forward_only
before update of status on public.orders
for each row execute function public.check_order_status_transition();

-- ---------- Rule: delivery minimum order ----------
create or replace function public.check_delivery_minimum()
returns trigger language plpgsql set search_path = '' as $$
declare min_pence integer;
begin
  if new.type = 'delivery' then
    select delivery_min_order_pence into min_pence from public.shop_settings where shop_id = new.shop_id;
    if new.subtotal_pence < coalesce(min_pence, 0) then
      raise exception 'Delivery orders need a subtotal of at least % pence', min_pence;
    end if;
  end if;
  return new;
end $$;

create trigger orders_delivery_minimum
before insert or update of subtotal_pence, type on public.orders
for each row execute function public.check_delivery_minimum();

-- ---------- Rule: delivery distance limit ----------
create or replace function public.check_delivery_distance()
returns trigger language plpgsql set search_path = '' as $$
declare max_miles numeric;
begin
  select s.delivery_max_miles into max_miles
  from public.orders o join public.shop_settings s on s.shop_id = o.shop_id
  where o.id = new.order_id;
  if new.distance_miles > coalesce(max_miles, 0) then
    raise exception 'Address is % miles away; the limit is % miles', new.distance_miles, max_miles;
  end if;
  return new;
end $$;

create trigger deliveries_distance_limit
before insert or update of distance_miles on public.deliveries
for each row execute function public.check_delivery_distance();

-- ---------- Rule: booking tables copy the booking's slot ----------
create or replace function public.sync_booking_table_slot()
returns trigger language plpgsql set search_path = '' as $$
declare b record;
begin
  select starts_at, ends_at, status into b from public.bookings where id = new.booking_id;
  new.starts_at := b.starts_at;
  new.ends_at := b.ends_at;
  new.is_active := b.status in ('pending_payment', 'confirmed');
  return new;
end $$;

create trigger booking_tables_sync_slot
before insert or update on public.booking_tables
for each row execute function public.sync_booking_table_slot();

create or replace function public.propagate_booking_slot()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.booking_tables
     set starts_at = new.starts_at, ends_at = new.ends_at,
         is_active = new.status in ('pending_payment', 'confirmed')
   where booking_id = new.id;
  return new;
end $$;

create trigger bookings_propagate_slot
after update of starts_at, ends_at, status on public.bookings
for each row execute function public.propagate_booking_slot();

-- ---------- Access helpers ----------
create or replace function public.is_staff(p_shop_id uuid, p_roles public.staff_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_users s
    where s.shop_id = p_shop_id and s.auth_user_id = (select auth.uid()) and s.is_active
      and (p_roles is null or s.role = any(p_roles))
  );
$$;

create or replace function public.my_customer_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.customers where auth_user_id = (select auth.uid());
$$;

-- ---------- Row level security ----------
alter table public.shops enable row level security;
alter table public.opening_hours enable row level security;
alter table public.shop_settings enable row level security;
alter table public.dining_tables enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.item_option_groups enable row level security;
alter table public.allergens enable row level security;
alter table public.item_allergens enable row level security;
alter table public.option_allergens enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.staff_users enable row level security;
alter table public.baskets enable row level security;
alter table public.basket_lines enable row level security;
alter table public.basket_line_options enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_line_options enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_tables enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.deliveries enable row level security;
alter table public.driver_assignments enable row level security;

-- Public menu and shop info: anyone can read.
create policy "public read" on public.shops for select using (true);
create policy "public read" on public.opening_hours for select using (true);
create policy "public read" on public.shop_settings for select using (true);
create policy "public read" on public.dining_tables for select using (true);
create policy "public read" on public.categories for select using (true);
create policy "public read" on public.items for select using (true);
create policy "public read" on public.option_groups for select using (true);
create policy "public read" on public.options for select using (true);
create policy "public read" on public.item_option_groups for select using (true);
create policy "public read" on public.allergens for select using (true);
create policy "public read" on public.item_allergens for select using (true);
create policy "public read" on public.option_allergens for select using (true);

-- QR tokens are never readable by the public.
revoke select on public.dining_tables from anon, authenticated;
grant select (id, shop_id, number, seats, is_bookable) on public.dining_tables to anon, authenticated;

-- Owner manages the menu, hours, settings and tables.
create policy "owner manages" on public.opening_hours for all using (public.is_staff(shop_id, array['owner']::public.staff_role[])) with check (public.is_staff(shop_id, array['owner']::public.staff_role[]));
create policy "owner manages" on public.shop_settings for all using (public.is_staff(shop_id, array['owner']::public.staff_role[])) with check (public.is_staff(shop_id, array['owner']::public.staff_role[]));
create policy "owner manages" on public.categories for all using (public.is_staff(shop_id, array['owner']::public.staff_role[])) with check (public.is_staff(shop_id, array['owner']::public.staff_role[]));
create policy "owner manages" on public.items for all using (public.is_staff(shop_id, array['owner']::public.staff_role[])) with check (public.is_staff(shop_id, array['owner']::public.staff_role[]));
create policy "owner manages" on public.option_groups for all using (public.is_staff(shop_id, array['owner']::public.staff_role[])) with check (public.is_staff(shop_id, array['owner']::public.staff_role[]));
create policy "owner manages" on public.options for all using (public.is_staff(shop_id, array['owner']::public.staff_role[])) with check (public.is_staff(shop_id, array['owner']::public.staff_role[]));
create policy "owner manages" on public.staff_users for all using (public.is_staff(shop_id, array['owner']::public.staff_role[])) with check (public.is_staff(shop_id, array['owner']::public.staff_role[]));
create policy "staff see themselves" on public.staff_users for select using (auth_user_id = (select auth.uid()));

-- Customers see only their own records.
create policy "own record" on public.customers for select using (auth_user_id = (select auth.uid()) or public.is_staff(shop_id));
create policy "own addresses" on public.addresses for select using (customer_id in (select public.my_customer_ids()));
create policy "own orders or staff" on public.orders for select using (customer_id in (select public.my_customer_ids()) or public.is_staff(shop_id, array['owner','kitchen']::public.staff_role[]));
create policy "kitchen updates status" on public.orders for update using (public.is_staff(shop_id, array['owner','kitchen']::public.staff_role[])) with check (public.is_staff(shop_id, array['owner','kitchen']::public.staff_role[]));
create policy "lines of visible orders" on public.order_lines for select using (exists (select 1 from public.orders o where o.id = order_id));
create policy "options of visible lines" on public.order_line_options for select using (exists (select 1 from public.order_lines l where l.id = order_line_id));
create policy "own bookings or staff" on public.bookings for select using (customer_id in (select public.my_customer_ids()) or public.is_staff(shop_id, array['owner','kitchen']::public.staff_role[]));
create policy "tables of visible bookings" on public.booking_tables for select using (exists (select 1 from public.bookings b where b.id = booking_id));
create policy "owner sees payments" on public.payments for select using (public.is_staff(shop_id, array['owner']::public.staff_role[]));
create policy "owner sees refunds" on public.refunds for select using (exists (select 1 from public.payments p where p.id = payment_id));

-- Drivers see only their own deliveries; kitchen and owner see all.
create policy "deliveries for staff" on public.deliveries for select using (
  exists (select 1 from public.orders o where o.id = order_id and public.is_staff(o.shop_id, array['owner','kitchen']::public.staff_role[]))
  or exists (select 1 from public.driver_assignments a join public.staff_users s on s.id = a.driver_id where a.delivery_id = deliveries.id and s.auth_user_id = (select auth.uid()))
);
create policy "assignments for staff" on public.driver_assignments for select using (
  exists (select 1 from public.staff_users s where s.id = driver_id and s.auth_user_id = (select auth.uid()))
  or exists (select 1 from public.deliveries d join public.orders o on o.id = d.order_id where d.id = delivery_id and public.is_staff(o.shop_id, array['owner','kitchen']::public.staff_role[]))
);

-- Baskets, writes to orders, payments and bookings go through the server (service role), never the browser.
