-- 0002_tables.sql
-- Core entities. users.id mirrors Supabase auth.users.id (created via trigger or by the backend
-- on first profile registration).

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text,
  role user_role not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table donors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references users(id) on delete cascade,
  org_name text not null,
  org_type org_type not null default 'other',
  address text not null,
  location geography(point, 4326) not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table ngos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references users(id) on delete cascade,
  org_name text not null,
  address text not null,
  location geography(point, 4326) not null,
  capacity_meals_per_day int not null default 100,
  accepted_food_types food_category[] not null default array['cooked_meal','bakery','produce','dairy','packaged','other']::food_category[],
  reliability_score numeric(3,2) not null default 1.00, -- 0..1, updated from completed pickups
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table volunteers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references users(id) on delete cascade,
  vehicle_type vehicle_type not null default 'none',
  max_carry_kg numeric(6,1) not null default 10,
  service_radius_km numeric(5,1) not null default 10,
  location geography(point, 4326),
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table donations (
  id uuid primary key default uuid_generate_v4(),
  donor_id uuid not null references donors(id) on delete cascade,
  title text not null,
  description text,
  food_category food_category not null,
  quantity_servings int not null check (quantity_servings > 0),
  quantity_kg numeric(7,2),
  photo_urls text[] not null default '{}',
  prepared_at timestamptz not null,
  storage storage_condition not null default 'room_temp',
  packaging packaging_type not null default 'covered',
  -- Filled by the ML service on creation:
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  spoilage_confidence numeric(3,2),
  location geography(point, 4326) not null, -- copied from donor at creation time
  status donation_status not null default 'listed',
  claimed_by_ngo uuid references ngos(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid not null references donations(id) on delete cascade,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  status assignment_status not null default 'offered',
  -- QR tokens are opaque secrets; the QR image encodes them. Scanning posts the token back.
  pickup_qr_token uuid not null default uuid_generate_v4(),
  delivery_qr_token uuid not null default uuid_generate_v4(),
  pickup_verified_at timestamptz,
  delivery_verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Full audit trail of every donation status change.
create table status_events (
  id bigint generated always as identity primary key,
  donation_id uuid not null references donations(id) on delete cascade,
  from_status donation_status,
  to_status donation_status not null,
  actor_user_id uuid references users(id),
  note text,
  created_at timestamptz not null default now()
);

create table emergency_requests (
  id uuid primary key default uuid_generate_v4(),
  ngo_id uuid not null references ngos(id) on delete cascade,
  food_category food_category not null,
  quantity_servings int not null check (quantity_servings > 0),
  needed_by timestamptz not null,
  radius_km numeric(5,1) not null default 15,
  note text,
  status emergency_status not null default 'open',
  created_at timestamptz not null default now()
);

create table notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  type text not null, -- e.g. new_listing_nearby, donation_claimed, assignment_offered, pickup_reminder, expiry_warning, emergency_broadcast
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- updated_at trigger for donations
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger donations_updated_at before update on donations
  for each row execute function set_updated_at();
