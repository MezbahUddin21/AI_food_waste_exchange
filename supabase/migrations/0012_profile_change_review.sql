-- 0012_profile_change_review.sql
-- Sensitive profile edits remain proposals until an administrator reviews them.

create table if not exists profile_change_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  role user_role not null,
  current_values jsonb not null default '{}'::jsonb,
  requested_values jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_message text,
  reviewed_by uuid references users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists one_pending_profile_change_per_user
  on profile_change_requests (user_id)
  where status = 'pending';
create index if not exists profile_change_requests_status_created_idx
  on profile_change_requests (status, created_at desc);

alter table profile_change_requests enable row level security;

create or replace function update_profile_atomic(
  p_user_id uuid,
  p_user_updates jsonb default '{}'::jsonb,
  p_role_updates jsonb default '{}'::jsonb,
  p_requires_reverification boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role user_role;
  is_verified boolean;
  old_values jsonb := '{}'::jsonb;
begin
  select role into target_role from users where id = p_user_id for update;
  if target_role is null then
    raise exception 'Profile not found';
  end if;

  if target_role = 'donor' then
    select verified into is_verified from donors where user_id = p_user_id for update;
  elsif target_role = 'ngo' then
    select verified into is_verified from ngos where user_id = p_user_id for update;
  elsif target_role = 'volunteer' then
    select verified into is_verified from volunteers where user_id = p_user_id for update;
  else
    is_verified := true;
  end if;

  if not coalesce(is_verified, false) then
    raise exception 'Profile must be verified before it can be edited';
  end if;

  update users
  set full_name = case when p_user_updates ? 'full_name' then p_user_updates ->> 'full_name' else full_name end,
      phone = case when p_user_updates ? 'phone' then p_user_updates ->> 'phone' else phone end,
      avatar_url = case when p_user_updates ? 'avatar_url' then p_user_updates ->> 'avatar_url' else avatar_url end
  where id = p_user_id;

  if p_requires_reverification and jsonb_object_length(p_role_updates) > 0 then
    if exists (
      select 1 from profile_change_requests
      where user_id = p_user_id and status = 'pending'
    ) then
      raise exception 'A profile change is already waiting for administrator review';
    end if;

    if target_role = 'donor' then
      select jsonb_build_object(
        'org_name', org_name,
        'org_type', org_type,
        'address', address,
        'location', st_astext(location::geometry)
      ) into old_values
      from donors where user_id = p_user_id;
    elsif target_role = 'ngo' then
      select jsonb_build_object(
        'org_name', org_name,
        'address', address,
        'location', st_astext(location::geometry),
        'capacity_meals_per_day', capacity_meals_per_day,
        'accepted_food_types', accepted_food_types
      ) into old_values
      from ngos where user_id = p_user_id;
    elsif target_role = 'volunteer' then
      select jsonb_build_object(
        'vehicle_type', vehicle_type,
        'max_carry_kg', max_carry_kg,
        'service_radius_km', service_radius_km,
        'location', case when location is null then null else st_astext(location::geometry) end
      ) into old_values
      from volunteers where user_id = p_user_id;
    else
      raise exception 'This role does not support reviewed profile changes';
    end if;

    insert into profile_change_requests (user_id, role, current_values, requested_values)
    values (p_user_id, target_role, old_values, p_role_updates);
  elsif target_role = 'volunteer' and p_role_updates ? 'available' then
    update volunteers
    set available = (p_role_updates ->> 'available')::boolean
    where user_id = p_user_id;
  end if;
end;
$$;

create or replace function review_profile_change_atomic(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_approve boolean,
  p_message text default null
)
returns profile_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request profile_change_requests;
begin
  if not exists (select 1 from users where id = p_admin_user_id and role = 'admin') then
    raise exception 'Only an administrator can review profile changes';
  end if;

  select * into request from profile_change_requests
  where id = p_request_id for update;
  if request.id is null then
    raise exception 'Profile change request not found';
  end if;
  if request.status <> 'pending' then
    raise exception 'Profile change request has already been reviewed';
  end if;
  if not p_approve and nullif(trim(p_message), '') is null then
    raise exception 'A message is required when rejecting profile changes';
  end if;

  if p_approve then
    if request.role = 'donor' then
      update donors
      set org_name = case when request.requested_values ? 'org_name' then request.requested_values ->> 'org_name' else org_name end,
          org_type = case when request.requested_values ? 'org_type' then (request.requested_values ->> 'org_type')::org_type else org_type end,
          address = case when request.requested_values ? 'address' then request.requested_values ->> 'address' else address end,
          location = case when request.requested_values ? 'location' then st_geogfromtext(request.requested_values ->> 'location') else location end
      where user_id = request.user_id;
    elsif request.role = 'ngo' then
      update ngos
      set org_name = case when request.requested_values ? 'org_name' then request.requested_values ->> 'org_name' else org_name end,
          address = case when request.requested_values ? 'address' then request.requested_values ->> 'address' else address end,
          location = case when request.requested_values ? 'location' then st_geogfromtext(request.requested_values ->> 'location') else location end,
          capacity_meals_per_day = case when request.requested_values ? 'capacity_meals_per_day' then (request.requested_values ->> 'capacity_meals_per_day')::int else capacity_meals_per_day end,
          accepted_food_types = case when request.requested_values ? 'accepted_food_types' then array(select jsonb_array_elements_text(request.requested_values -> 'accepted_food_types')::food_category) else accepted_food_types end
      where user_id = request.user_id;
    elsif request.role = 'volunteer' then
      update volunteers
      set vehicle_type = case when request.requested_values ? 'vehicle_type' then (request.requested_values ->> 'vehicle_type')::vehicle_type else vehicle_type end,
          max_carry_kg = case when request.requested_values ? 'max_carry_kg' then (request.requested_values ->> 'max_carry_kg')::numeric else max_carry_kg end,
          service_radius_km = case when request.requested_values ? 'service_radius_km' then (request.requested_values ->> 'service_radius_km')::numeric else service_radius_km end,
          location = case when request.requested_values ? 'location' then st_geogfromtext(request.requested_values ->> 'location') else location end
      where user_id = request.user_id;
    end if;
  end if;

  update profile_change_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      admin_message = nullif(trim(p_message), ''),
      reviewed_by = p_admin_user_id,
      reviewed_at = now()
  where id = p_request_id
  returning * into request;

  return request;
end;
$$;

revoke all on table profile_change_requests from anon, authenticated;
grant select, insert, update, delete on table profile_change_requests to service_role;
revoke all on function update_profile_atomic(uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function review_profile_change_atomic(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function update_profile_atomic(uuid, jsonb, jsonb, boolean) to service_role;
grant execute on function review_profile_change_atomic(uuid, uuid, boolean, text) to service_role;

notify pgrst, 'reload schema';
