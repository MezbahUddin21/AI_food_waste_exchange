-- 0010_verified_profile_updates.sql
-- Profiles may be changed only after admin approval. Changes to operational
-- details return the profile to the verification queue in the same transaction.

alter table volunteers
  add column if not exists verified boolean not null default false;

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

  if target_role = 'donor' then
    update donors
    set org_name = case when p_role_updates ? 'org_name' then p_role_updates ->> 'org_name' else org_name end,
        org_type = case when p_role_updates ? 'org_type' then (p_role_updates ->> 'org_type')::org_type else org_type end,
        address = case when p_role_updates ? 'address' then p_role_updates ->> 'address' else address end,
        location = case when p_role_updates ? 'location' then st_geogfromtext(p_role_updates ->> 'location') else location end,
        verified = case when p_requires_reverification then false else verified end
    where user_id = p_user_id;
  elsif target_role = 'ngo' then
    update ngos
    set org_name = case when p_role_updates ? 'org_name' then p_role_updates ->> 'org_name' else org_name end,
        address = case when p_role_updates ? 'address' then p_role_updates ->> 'address' else address end,
        location = case when p_role_updates ? 'location' then st_geogfromtext(p_role_updates ->> 'location') else location end,
        capacity_meals_per_day = case when p_role_updates ? 'capacity_meals_per_day' then (p_role_updates ->> 'capacity_meals_per_day')::int else capacity_meals_per_day end,
        accepted_food_types = case when p_role_updates ? 'accepted_food_types' then array(select jsonb_array_elements_text(p_role_updates -> 'accepted_food_types')::food_category) else accepted_food_types end,
        verified = case when p_requires_reverification then false else verified end
    where user_id = p_user_id;
  elsif target_role = 'volunteer' then
    update volunteers
    set vehicle_type = case when p_role_updates ? 'vehicle_type' then (p_role_updates ->> 'vehicle_type')::vehicle_type else vehicle_type end,
        max_carry_kg = case when p_role_updates ? 'max_carry_kg' then (p_role_updates ->> 'max_carry_kg')::numeric else max_carry_kg end,
        service_radius_km = case when p_role_updates ? 'service_radius_km' then (p_role_updates ->> 'service_radius_km')::numeric else service_radius_km end,
        location = case when p_role_updates ? 'location' then st_geogfromtext(p_role_updates ->> 'location') else location end,
        available = case when p_role_updates ? 'available' then (p_role_updates ->> 'available')::boolean else available end,
        verified = case when p_requires_reverification then false else verified end
    where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function update_profile_atomic(uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function update_profile_atomic(uuid, jsonb, jsonb, boolean) to service_role;

notify pgrst, 'reload schema';
