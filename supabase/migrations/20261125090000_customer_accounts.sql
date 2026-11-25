-- Step 14: customer accounts.
-- Customers sign in with an emailed link or Google. They see their own orders only, through the
-- functions below. A customer login has no staff rights: every staff check uses staff_users.

-- 1. One account per shop per login.
create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  phone text not null default '' check (char_length(phone) <= 20),
  email text not null,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, auth_user_id)
);
create index if not exists customer_accounts_auth_user_id_idx on public.customer_accounts (auth_user_id);
alter table public.customer_accounts enable row level security;
comment on table public.customer_accounts is 'Read and changed through the customer_* functions only.';

-- 2. Saved delivery addresses (saved at checkout when the customer ticks "Save this address").
create table if not exists public.saved_addresses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  account_id uuid not null references public.customer_accounts(id) on delete cascade,
  address_text text not null check (char_length(address_text) between 1 and 200),
  postcode text not null default '' check (char_length(postcode) <= 10),
  created_at timestamptz not null default now(),
  unique (account_id, address_text)
);
create index if not exists saved_addresses_shop_id_idx on public.saved_addresses (shop_id);
alter table public.saved_addresses enable row level security;
comment on table public.saved_addresses is 'Read and changed through the customer_* functions only.';

-- Helper: the signed-in customer's confirmed email, or an error.
create or replace function private.my_confirmed_email()
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select u.email into v_email from auth.users u
  where u.id = (select auth.uid()) and u.email is not null and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'email not confirmed' using errcode = '42501';
  end if;
  return lower(v_email);
end;
$$;
revoke execute on function private.my_confirmed_email() from public;

-- 3. Open (or create) the account. Past guest orders with the same confirmed email join it.
create or replace function public.customer_account(p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := private.my_confirmed_email();
  v_account public.customer_accounts;
  v_last public.customers;
begin
  if not exists (select 1 from public.shops where id = p_shop_id) then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;

  insert into public.customer_accounts (shop_id, auth_user_id, email, name)
  values (
    p_shop_id, v_uid, v_email,
    left(coalesce((select u.raw_user_meta_data ->> 'full_name' from auth.users u where u.id = v_uid), ''), 80)
  )
  on conflict (shop_id, auth_user_id) do update set email = excluded.email
  returning * into v_account;

  update public.customers c set auth_user_id = v_uid
  where c.shop_id = p_shop_id and c.auth_user_id is null and lower(c.email) = v_email;

  -- Fill in a missing name or phone from the latest order.
  if v_account.name = '' or v_account.phone = '' then
    select c.* into v_last from public.customers c
    where c.shop_id = p_shop_id and c.auth_user_id = v_uid
    order by c.created_at desc limit 1;
    if v_last.id is not null then
      update public.customer_accounts set
        name = case when name = '' then left(coalesce(v_last.name, ''), 80) else name end,
        phone = case when phone = '' then left(coalesce(v_last.phone, ''), 20) else phone end
      where id = v_account.id
      returning * into v_account;
    end if;
  end if;

  return jsonb_build_object(
    'name', v_account.name,
    'phone', v_account.phone,
    'email', v_account.email,
    'marketing', v_account.marketing_opt_in,
    'addresses', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'address', a.address_text, 'postcode', a.postcode) order by a.created_at desc)
      from public.saved_addresses a where a.account_id = v_account.id
    ), '[]'::jsonb)
  );
end;
$$;

-- 4. Change name, phone and the marketing choice (the time of the choice is kept, as UK law expects).
create or replace function public.customer_update_account(p_shop_id uuid, p_name text, p_phone text, p_marketing boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text := trim(coalesce(p_name, '')); v_phone text := trim(coalesce(p_phone, ''));
begin
  perform private.my_confirmed_email();
  if char_length(v_name) > 80 or char_length(v_phone) > 20 then
    raise exception 'too long' using errcode = '22001';
  end if;
  update public.customer_accounts set
    name = v_name,
    phone = v_phone,
    marketing_opt_in_at = case when p_marketing is distinct from marketing_opt_in then now() else marketing_opt_in_at end,
    marketing_opt_in = coalesce(p_marketing, false),
    updated_at = now()
  where shop_id = p_shop_id and auth_user_id = (select auth.uid());
  if not found then
    raise exception 'no account' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.customer_delete_address(p_shop_id uuid, p_address_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.my_confirmed_email();
  delete from public.saved_addresses a
  using public.customer_accounts ac
  where a.id = p_address_id and a.account_id = ac.id and ac.shop_id = p_shop_id and ac.auth_user_id = (select auth.uid());
end;
$$;

-- 5. The customer's own orders, newest first, with what is needed to order again.
create or replace function public.customer_orders(p_shop_id uuid, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  perform private.my_confirmed_email();
  return coalesce((
    select jsonb_agg(r order by r.created_at desc) from (
      select
        o.id, o.number, o.type, o.status, o.created_at, o.pickup_at, o.total_pence, o.access_token,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'item_code', i.code,
            'item_name', l.item_name,
            'quantity', l.quantity,
            'line_total_pence', l.line_total_pence,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object('option_id', lo.option_id, 'group_code', g.code, 'option_name', lo.option_name, 'count', lo.count))
              from public.order_line_options lo
              left join public.options op on op.id = lo.option_id
              left join public.option_groups g on g.id = op.group_id
              where lo.order_line_id = l.id
            ), '[]'::jsonb)
          ) order by l.id)
          from public.order_lines l left join public.items i on i.id = l.item_id
          where l.order_id = o.id
        ), '[]'::jsonb) as lines
      from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.shop_id = p_shop_id and c.auth_user_id = v_uid
      order by o.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) r
  ), '[]'::jsonb);
end;
$$;

-- 6. Delete the login. Orders stay (needed for the accounts) but are no longer linked to anyone's login.
create or replace function public.customer_delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff_users s where s.auth_user_id = v_uid) then
    raise exception 'staff logins are removed by the owner' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- 7. Most-ordered items in the last 30 days (counts only, no customer details). Used for suggestions.
create or replace function public.popular_items(p_shop_id uuid)
returns table (item_code text, orders bigint) language sql stable security definer set search_path = '' as $$
  select i.code, count(distinct l.order_id)
  from public.order_lines l
  join public.orders o on o.id = l.order_id
  join public.items i on i.id = l.item_id
  where o.shop_id = p_shop_id and not o.is_staff_test and o.status <> 'cancelled'
    and o.created_at > now() - interval '30 days'
  group by i.code
  order by 2 desc, 1
  limit 20;
$$;

revoke execute on function public.customer_account(uuid) from public, anon;
revoke execute on function public.customer_update_account(uuid, text, text, boolean) from public, anon;
revoke execute on function public.customer_delete_address(uuid, uuid) from public, anon;
revoke execute on function public.customer_orders(uuid, integer) from public, anon;
revoke execute on function public.customer_delete_account() from public, anon;
revoke execute on function public.popular_items(uuid) from public;
grant execute on function public.customer_account(uuid) to authenticated;
grant execute on function public.customer_update_account(uuid, text, text, boolean) to authenticated;
grant execute on function public.customer_delete_address(uuid, uuid) to authenticated;
grant execute on function public.customer_orders(uuid, integer) to authenticated;
grant execute on function public.customer_delete_account() to authenticated;
grant execute on function public.popular_items(uuid) to anon, authenticated;
