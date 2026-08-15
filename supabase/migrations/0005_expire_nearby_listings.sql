-- 0005_expire_nearby_listings.sql
-- Never return food whose safe pickup window has elapsed.

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
  where d.status = 'listed'
    and d.pickup_window_end > now()
    and st_dwithin(d.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, max_km * 1000)
  order by d.location <-> st_setsrid(st_makepoint(lng, lat), 4326)::geography
  limit max_results;
$$;
