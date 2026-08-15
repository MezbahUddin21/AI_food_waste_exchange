-- 0008_atomic_workflows.sql
-- Keep lifecycle state, assignment state, and audit events in one transaction.

create or replace function transition_donation_atomic(
  p_donation_id uuid,
  p_expected_status donation_status,
  p_new_status donation_status,
  p_actor_user_id uuid default null,
  p_claimed_by_ngo uuid default null,
  p_note text default null
)
returns donations
language plpgsql
security definer
set search_path = public
as $$
declare
  changed donations;
begin
  update donations
  set status = p_new_status,
      claimed_by_ngo = coalesce(p_claimed_by_ngo, claimed_by_ngo)
  where id = p_donation_id and status = p_expected_status
  returning * into changed;

  if changed.id is null then
    raise exception 'Donation was modified concurrently -- refresh and retry';
  end if;

  insert into status_events (donation_id, from_status, to_status, actor_user_id, note)
  values (p_donation_id, p_expected_status, p_new_status, p_actor_user_id, p_note);
  return changed;
end;
$$;

create or replace function create_assignment_atomic(
  p_donation_id uuid,
  p_volunteer_id uuid,
  p_actor_user_id uuid
)
returns assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  changed donations;
  created assignments;
begin
  update donations set status = 'assigned'
  where id = p_donation_id and status = 'claimed'
  returning * into changed;

  if changed.id is null then
    raise exception 'Donation is no longer available for assignment';
  end if;

  insert into assignments (donation_id, volunteer_id)
  values (p_donation_id, p_volunteer_id)
  returning * into created;

  insert into status_events (donation_id, from_status, to_status, actor_user_id)
  values (p_donation_id, 'claimed', 'assigned', p_actor_user_id);
  return created;
end;
$$;

create or replace function verify_assignment_handoff_atomic(
  p_assignment_id uuid,
  p_kind text,
  p_actor_user_id uuid
)
returns assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_assignment assignments;
  changed_donation donations;
  changed_assignment assignments;
  expected_assignment assignment_status;
  new_assignment assignment_status;
  expected_donation donation_status;
  new_donation donation_status;
begin
  select * into current_assignment from assignments
  where id = p_assignment_id for update;

  if current_assignment.id is null then
    raise exception 'Assignment not found';
  end if;

  if p_kind = 'pickup' then
    expected_assignment := 'accepted';
    new_assignment := 'picked_up';
    expected_donation := 'assigned';
    new_donation := 'in_transit';
  elsif p_kind = 'delivery' then
    expected_assignment := 'picked_up';
    new_assignment := 'delivered';
    expected_donation := 'in_transit';
    new_donation := 'delivered';
  else
    raise exception 'Unknown handoff kind';
  end if;

  if current_assignment.status <> expected_assignment then
    raise exception 'Assignment is not ready for this handoff';
  end if;

  update donations set status = new_donation
  where id = current_assignment.donation_id and status = expected_donation
  returning * into changed_donation;

  if changed_donation.id is null then
    raise exception 'Donation is not ready for this handoff';
  end if;

  update assignments
  set status = new_assignment,
      pickup_verified_at = case when p_kind = 'pickup' then now() else pickup_verified_at end,
      delivery_verified_at = case when p_kind = 'delivery' then now() else delivery_verified_at end
  where id = p_assignment_id
  returning * into changed_assignment;

  insert into status_events (donation_id, from_status, to_status, actor_user_id)
  values (current_assignment.donation_id, expected_donation, new_donation, p_actor_user_id);
  return changed_assignment;
end;
$$;

revoke all on function transition_donation_atomic(uuid, donation_status, donation_status, uuid, uuid, text) from public, anon, authenticated;
revoke all on function create_assignment_atomic(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function verify_assignment_handoff_atomic(uuid, text, uuid) from public, anon, authenticated;
grant execute on function transition_donation_atomic(uuid, donation_status, donation_status, uuid, uuid, text) to service_role;
grant execute on function create_assignment_atomic(uuid, uuid, uuid) to service_role;
grant execute on function verify_assignment_handoff_atomic(uuid, text, uuid) to service_role;
