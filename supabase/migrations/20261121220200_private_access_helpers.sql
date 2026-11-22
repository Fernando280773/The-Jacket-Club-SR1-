-- Move access helpers out of the public API schema (Supabase security advisor).
-- Policies refer to functions by id, so they keep working after the move.
create schema if not exists private;
grant usage on schema private to anon, authenticated;
alter function public.is_staff(uuid, public.staff_role[]) set schema private;
alter function public.my_customer_ids() set schema private;
revoke execute on function private.is_staff(uuid, public.staff_role[]) from public;
revoke execute on function private.my_customer_ids() from public;
grant execute on function private.is_staff(uuid, public.staff_role[]) to anon, authenticated;
grant execute on function private.my_customer_ids() to anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

comment on table public.baskets is 'Written and read only by the server (service role). No browser access by design.';
comment on table public.basket_lines is 'Written and read only by the server (service role). No browser access by design.';
comment on table public.basket_line_options is 'Written and read only by the server (service role). No browser access by design.';
