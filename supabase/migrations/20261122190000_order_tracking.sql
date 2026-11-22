-- Step 8: private tracking link per order, and a marker so the receipt email is sent only once.
alter table public.orders
  add column if not exists access_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  add column if not exists receipt_sent_at timestamptz;
create unique index if not exists orders_access_token_key on public.orders (access_token);
comment on column public.orders.access_token is 'Unguessable token for the customer''s order status link. Server reads it with the service role only.';
