-- Step 13: orders placed in staff test mode (live payment test, practice service) are marked,
-- so the kitchen screen labels them and they can be cleared before opening.
alter table public.orders add column if not exists is_staff_test boolean not null default false;
