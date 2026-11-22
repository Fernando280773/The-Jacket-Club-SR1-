-- Step 10: admin.
-- From here the database is the master for prices, sold out, descriptions and photos (the menu sheet is no longer synced over it).
-- Every admin change goes through these functions, which check the signed-in person's role and the limits.

alter table public.shop_settings add column if not exists paused_message text;
alter table public.shop_settings drop constraint if exists shop_settings_paused_message_len;
alter table public.shop_settings add constraint shop_settings_paused_message_len check (char_length(paused_message) <= 120);

-- Owner: edit an item. Price is whole pence, £0 to £100.
create or replace function public.admin_update_item(
  p_item_id uuid, p_name text, p_description text, p_price_pence integer, p_is_available boolean, p_is_featured boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid;
begin
  select shop_id into v_shop from public.items where id = p_item_id;
  if v_shop is null or not private.is_staff(v_shop, array['owner']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_price_pence is null or p_price_pence < 0 or p_price_pence > 10000 then
    raise exception 'price must be between £0 and £100' using errcode = '22023';
  end if;
  if coalesce(char_length(trim(p_name)), 0) not between 1 and 80 then
    raise exception 'name must be 1 to 80 characters' using errcode = '22023';
  end if;
  if char_length(p_description) > 300 then
    raise exception 'description must be up to 300 characters' using errcode = '22023';
  end if;
  update public.items
  set name = trim(p_name), description = nullif(trim(p_description), ''), price_pence = p_price_pence,
      is_available = p_is_available, is_featured = p_is_featured
  where id = p_item_id;
end;
$$;

-- Owner: set or clear an item's photo (a URL from this project's menu-photos bucket).
create or replace function public.admin_set_item_photo(p_item_id uuid, p_photo_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid;
begin
  select shop_id into v_shop from public.items where id = p_item_id;
  if v_shop is null or not private.is_staff(v_shop, array['owner']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_photo_url is not null and p_photo_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/menu-photos/' then
    raise exception 'photo must be uploaded through the admin' using errcode = '22023';
  end if;
  update public.items set photo_url = p_photo_url where id = p_item_id;
end;
$$;

-- Owner or kitchen: sold out / back on.
create or replace function public.set_item_available(p_item_id uuid, p_available boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid;
begin
  select shop_id into v_shop from public.items where id = p_item_id;
  if v_shop is null or not private.is_staff(v_shop, array['owner','kitchen']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.items set is_available = p_available where id = p_item_id;
end;
$$;

create or replace function public.set_option_available(p_option_id uuid, p_available boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid;
begin
  select shop_id into v_shop from public.options where id = p_option_id;
  if v_shop is null or not private.is_staff(v_shop, array['owner','kitchen']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.options set is_available = p_available where id = p_option_id;
end;
$$;

-- Owner: price of an extra, £0 to £20.
create or replace function public.admin_update_option_price(p_option_id uuid, p_price_change_pence integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_shop uuid;
begin
  select shop_id into v_shop from public.options where id = p_option_id;
  if v_shop is null or not private.is_staff(v_shop, array['owner']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_price_change_pence is null or p_price_change_pence < 0 or p_price_change_pence > 2000 then
    raise exception 'extra price must be between £0 and £20' using errcode = '22023';
  end if;
  update public.options set price_change_pence = p_price_change_pence where id = p_option_id;
end;
$$;

-- Owner: the whole week's hours at once. p_hours = [{"iso_day":1,"opens":"09:30","closes":"22:00"}, ...]; a missing day is closed.
create or replace function public.admin_set_hours(p_shop_id uuid, p_hours jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_day jsonb;
begin
  if not private.is_staff(p_shop_id, array['owner']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 7 then
    raise exception 'hours must be a list of up to 7 days' using errcode = '22023';
  end if;
  for v_day in select * from jsonb_array_elements(p_hours) loop
    if (v_day->>'iso_day')::int not between 1 and 7 or (v_day->>'closes')::time <= (v_day->>'opens')::time then
      raise exception 'each day needs closing after opening' using errcode = '22023';
    end if;
  end loop;
  delete from public.opening_hours where shop_id = p_shop_id;
  insert into public.opening_hours (shop_id, iso_day, opens, closes)
  select p_shop_id, (d->>'iso_day')::smallint, (d->>'opens')::time, (d->>'closes')::time from jsonb_array_elements(p_hours) d;
end;
$$;

-- Owner: pause or restart online ordering, with an optional message for customers.
create or replace function public.admin_set_ordering(p_shop_id uuid, p_accepting boolean, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff(p_shop_id, array['owner']::public.staff_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.shop_settings
  set is_accepting_orders = p_accepting,
      paused_message = case when p_accepting then null else nullif(left(trim(p_message), 120), '') end
  where shop_id = p_shop_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_update_item(uuid, text, text, integer, boolean, boolean)',
    'public.admin_set_item_photo(uuid, text)',
    'public.set_item_available(uuid, boolean)',
    'public.set_option_available(uuid, boolean)',
    'public.admin_update_option_price(uuid, integer)',
    'public.admin_set_hours(uuid, jsonb)',
    'public.admin_set_ordering(uuid, boolean, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Changes only through the functions above: remove the broad owner write policies on menu tables.
drop policy if exists "owner manages" on public.items;
drop policy if exists "owner manages" on public.options;
drop policy if exists "owner manages" on public.opening_hours;
drop policy if exists "owner manages" on public.shop_settings;

-- Photos: anyone can view; only the shop's owner can upload, into a folder named after the shop id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-photos', 'menu-photos', true, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg'];

drop policy if exists "owner uploads menu photos" on storage.objects;
create policy "owner uploads menu photos" on storage.objects for insert to authenticated
with check (
  bucket_id = 'menu-photos'
  and private.is_staff(((storage.foldername(name))[1])::uuid, array['owner']::public.staff_role[])
);
