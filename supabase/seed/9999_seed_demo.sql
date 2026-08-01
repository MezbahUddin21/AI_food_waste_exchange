-- 9999_seed_demo.sql
-- Demo data for showcasing. Run AFTER creating demo auth users in Supabase
-- (Authentication → Users → Add user), then replace the UUIDs below with the
-- real auth user IDs. Locations are around Dhaka, Bangladesh.
--
-- Demo accounts to create in Supabase Auth (password suggestion: Demo1234!):
--   donor@demo.io, ngo@demo.io, volunteer@demo.io, admin@demo.io

-- ⚠️ REPLACE these with the actual auth.users IDs after creating the accounts:
-- \set donor_uid   '00000000-0000-0000-0000-000000000001'
-- \set ngo_uid     '00000000-0000-0000-0000-000000000002'
-- etc.

do $$
declare
  donor_uid uuid := '00000000-0000-0000-0000-000000000001';  -- REPLACE
  ngo_uid uuid := '00000000-0000-0000-0000-000000000002';     -- REPLACE
  vol_uid uuid := '00000000-0000-0000-0000-000000000003';     -- REPLACE
  admin_uid uuid := '00000000-0000-0000-0000-000000000004';   -- REPLACE
  d_id uuid;
  n_id uuid;
begin
  insert into users (id, email, full_name, role) values
    (donor_uid, 'donor@demo.io', 'Rahim Uddin', 'donor'),
    (ngo_uid, 'ngo@demo.io', 'Fatema Khatun', 'ngo'),
    (vol_uid, 'volunteer@demo.io', 'Karim Ahmed', 'volunteer'),
    (admin_uid, 'admin@demo.io', 'Platform Admin', 'admin');

  insert into donors (user_id, org_name, org_type, address, location, verified)
  values (donor_uid, 'Star Kabab & Restaurant', 'restaurant',
          'Dhanmondi 2, Dhaka', st_setsrid(st_makepoint(90.3742, 23.7461), 4326), true)
  returning id into d_id;

  insert into ngos (user_id, org_name, address, location, capacity_meals_per_day, verified)
  values (ngo_uid, 'JAAGO Foundation Shelter', 'Rayer Bazar, Dhaka',
          st_setsrid(st_makepoint(90.3596, 23.7383), 4326), 300, true)
  returning id into n_id;

  insert into volunteers (user_id, vehicle_type, max_carry_kg, service_radius_km, location, available)
  values (vol_uid, 'motorbike', 25, 15, st_setsrid(st_makepoint(90.3680, 23.7420), 4326), true);

  -- A live listing (fresh biryani, refrigerated → generous window)
  insert into donations (donor_id, title, description, food_category, quantity_servings,
                         quantity_kg, prepared_at, storage, packaging,
                         pickup_window_start, pickup_window_end, spoilage_confidence, location)
  values (d_id, '25 chicken biryani boxes', 'Surplus from a cancelled event booking',
          'cooked_meal', 25, 12.5, now() - interval '1 hour', 'refrigerated', 'sealed',
          now(), now() + interval '14 hours', 0.85,
          st_setsrid(st_makepoint(90.3742, 23.7461), 4326));

  -- A completed donation so analytics has data
  insert into donations (donor_id, title, food_category, quantity_servings, quantity_kg,
                         prepared_at, storage, packaging, pickup_window_start, pickup_window_end,
                         spoilage_confidence, location, status, claimed_by_ngo)
  values (d_id, '40 bread loaves', 'bakery', 40, 20,
          now() - interval '2 days', 'room_temp', 'sealed',
          now() - interval '2 days', now() - interval '1 day', 0.7,
          st_setsrid(st_makepoint(90.3742, 23.7461), 4326), 'verified', n_id);
end $$;
