-- The Jacket Club SR1: shop, opening hours, settings, 15 tables and the 14 UK allergens.
-- The menu itself is loaded in Step 5.

insert into public.allergens (id, name) values
  (1, 'Celery'), (2, 'Gluten'), (3, 'Crustaceans'), (4, 'Eggs'), (5, 'Fish'),
  (6, 'Lupin'), (7, 'Milk'), (8, 'Molluscs'), (9, 'Mustard'), (10, 'Tree nuts'),
  (11, 'Peanuts'), (12, 'Sesame'), (13, 'Soya'), (14, 'Sulphites');

with shop as (
  insert into public.shops (slug, name, company, address, postcode, email)
  values ('the-jacket-club-sr1', 'The Jacket Club SR1', 'Fernando & Sons Property Ltd',
          '12–14 Park Lane, Sunderland', 'SR1 3NX', 'info@thejacketclubsr1.com')
  returning id
), hours as (
  insert into public.opening_hours (shop_id, iso_day, opens, closes)
  select shop.id, d, case when d = 7 then time '11:00' else time '09:30' end, time '22:00'
  from shop, generate_series(1, 7) d
), settings as (
  insert into public.shop_settings (
    shop_id, delivery_first_mile_pence, delivery_per_extra_mile_pence, delivery_max_miles,
    delivery_min_order_pence, booking_deposit_per_person_pence, booking_slot_minutes,
    booking_days_ahead, booking_max_party, booking_refund_notice_hours)
  select id, 199, 80, 4.00, 1200, 200, 120, 7, 20, 2 from shop
)
insert into public.dining_tables (shop_id, number, seats, is_bookable)
select shop.id, n, 2, n <= 10 from shop, generate_series(1, 15) n;
