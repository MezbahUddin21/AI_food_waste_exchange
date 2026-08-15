-- 0007_harden_rls_and_storage.sql
-- Align policy names with their real scope and constrain public photo uploads.

create or replace function is_verified_donor(donor_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from donors d where d.id = donor_uuid and d.verified
  );
$$;

revoke all on function is_verified_donor(uuid) from public;
grant execute on function is_verified_donor(uuid) to authenticated;

drop policy if exists "anyone authenticated can browse listed donations" on donations;
create policy "authenticated browse active verified donations" on donations
  for select to authenticated
  using (
    status = 'listed'
    and pickup_window_end > now()
    and is_verified_donor(donor_id)
  );

drop policy if exists "authenticated can view verified ngos" on ngos;
create policy "authenticated can view verified ngos" on ngos
  for select to authenticated
  using (verified);

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'food-photos';

drop policy if exists "authenticated upload food photos" on storage.objects;
create policy "users upload own food photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'food-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
