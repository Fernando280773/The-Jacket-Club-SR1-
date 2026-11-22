-- Step 5: items can be pinned to the "Club favourites" row on the menu.
alter table public.items add column is_featured boolean not null default false;
