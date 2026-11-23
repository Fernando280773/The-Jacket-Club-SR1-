-- The first schema's delivery read rules referred to each other (deliveries -> driver_assignments -> deliveries),
-- which Postgres refuses as infinite recursion. Replace them with small lookups that don't go back through the rules.

create or replace function private.order_shop_id(p_order_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select shop_id from public.orders where id = p_order_id;
$$;

create or replace function private.delivery_shop_id(p_delivery_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select o.shop_id from public.deliveries d join public.orders o on o.id = d.order_id where d.id = p_delivery_id;
$$;

revoke execute on function private.order_shop_id(uuid) from public;
revoke execute on function private.delivery_shop_id(uuid) from public;
grant execute on function private.order_shop_id(uuid) to authenticated;
grant execute on function private.delivery_shop_id(uuid) to authenticated;

-- Drivers see only their own deliveries; kitchen and owner see all of their shop's.
drop policy if exists "deliveries for staff" on public.deliveries;
create policy "deliveries for staff" on public.deliveries for select to authenticated using (
  private.is_staff(private.order_shop_id(order_id), array['owner','kitchen']::public.staff_role[])
  or order_id in (select private.my_driver_order_ids())
);

drop policy if exists "assignments for staff" on public.driver_assignments;
create policy "assignments for staff" on public.driver_assignments for select to authenticated using (
  exists (select 1 from public.staff_users s where s.id = driver_id and s.auth_user_id = (select auth.uid()))
  or private.is_staff(private.delivery_shop_id(delivery_id), array['owner','kitchen']::public.staff_role[])
);
