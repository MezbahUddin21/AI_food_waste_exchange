-- 0006_verified_nearby_listings.sql
-- Nearby browse must exclude listings from unverified donor organizations.

create or replace function nearby_donations(
  lat double precision,
  lng double precision,
  max_km double precision default 25,
  max_results int default 50
)
returns table (
  donation_id uuid,
  distance_km double precision
)
language sql stable as $$
  select
    d.id,
    st_distance(d.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) / 1000.0
  from donations d
  join donors donor on donor.id = d.donor_id
  where d.status = 'listed'
    and donor.verified
    and d.pickup_window_end > now()
    and st_dwithin(d.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, max_km * 1000)
  order by d.location <-> st_setsrid(st_makepoint(lng, lat), 4326)::geography
  limit max_results;
$$;
