-- 0003_indexes_and_rpc.sql

-- Spatial indexes: make ST_DWithin / distance-ordered queries index-backed.
create index donors_location_gix on donors using gist (location);
create index ngos_location_gix on ngos using gist (location);
create index volunteers_location_gix on volunteers using gist (location);
create index donations_location_gix on donations using gist (location);

create index donations_status_idx on donations (status);
create index donations_pickup_window_end_idx on donations (pickup_window_end);
create index donations_donor_idx on donations (donor_id);
create index assignments_volunteer_idx on assignments (volunteer_id);
create index assignments_donation_idx on assignments (donation_id);
create index notifications_user_read_idx on notifications (user_id, read);
create index status_events_donation_idx on status_events (donation_id);
create index emergency_requests_status_idx on emergency_requests (status);

-- RPC: nearest verified NGOs to a point, with distance in km.
-- Called by the backend, which then sends candidates to the ML service for final ranking.
create or replace function nearby_ngos(
  lat double precision,
  lng double precision,
  max_km double precision default 25,
  wanted_category food_category default null,
  max_results int default 20
)
returns table (
  ngo_id uuid,
  org_name text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  capacity_meals_per_day int,
  accepted_food_types food_category[],
  reliability_score numeric
)
language sql stable as $$
  select
    n.id,
    n.org_name,
    n.address,
    st_y(n.location::geometry),
    st_x(n.location::geometry),
    st_distance(n.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) / 1000.0,
    n.capacity_meals_per_day,
    n.accepted_food_types,
    n.reliability_score
  from ngos n
  where n.verified
    and st_dwithin(n.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, max_km * 1000)
    and (wanted_category is null or wanted_category = any(n.accepted_food_types))
  order by n.location <-> st_setsrid(st_makepoint(lng, lat), 4326)::geography
  limit max_results;
$$;

-- RPC: available volunteers near a point whose service radius covers it.
create or replace function nearby_volunteers(
  lat double precision,
  lng double precision,
  max_results int default 20
)
returns table (
  volunteer_id uuid,
  user_id uuid,
  vehicle_type vehicle_type,
  max_carry_kg numeric,
  distance_km double precision
)
language sql stable as $$
  select
    v.id,
    v.user_id,
    v.vehicle_type,
    v.max_carry_kg,
    st_distance(v.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) / 1000.0
  from volunteers v
  where v.available
    and v.location is not null
    and st_dwithin(v.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, v.service_radius_km * 1000)
  order by v.location <-> st_setsrid(st_makepoint(lng, lat), 4326)::geography
  limit max_results;
$$;

-- RPC: open listed donations near a point (for NGO browse + emergency matching).
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
    and st_dwithin(d.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, max_km * 1000)
  order by d.location <-> st_setsrid(st_makepoint(lng, lat), 4326)::geography
  limit max_results;
$$;
