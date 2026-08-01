-- 0004_rls_and_storage.sql
-- The NestJS backend talks to the DB with the service_role key, which bypasses RLS.
-- RLS is still enabled defensively so the anon/public key can't read or write anything
-- except what we explicitly allow (users can read their own profile & notifications
-- directly from the frontend via supabase-js if desired).

alter table users enable row level security;
alter table donors enable row level security;
alter table ngos enable row level security;
alter table volunteers enable row level security;
alter table donations enable row level security;
alter table assignments enable row level security;
alter table status_events enable row level security;
alter table emergency_requests enable row level security;
alter table notifications enable row level security;

-- Own profile
create policy "read own user row" on users
  for select using (auth.uid() = id);

-- Own notifications (read + mark read)
create policy "read own notifications" on notifications
  for select using (auth.uid() = user_id);
create policy "update own notifications" on notifications
  for update using (auth.uid() = user_id);

-- Public browse of active listings (read-only; writes go through the backend)
create policy "anyone authenticated can browse listed donations" on donations
  for select using (auth.role() = 'authenticated');

create policy "authenticated can view verified ngos" on ngos
  for select using (auth.role() = 'authenticated');

-- Storage bucket for food photos (public read, authenticated write).
insert into storage.buckets (id, name, public)
values ('food-photos', 'food-photos', true)
on conflict (id) do nothing;

create policy "authenticated upload food photos" on storage.objects
  for insert with check (bucket_id = 'food-photos' and auth.role() = 'authenticated');

create policy "public read food photos" on storage.objects
  for select using (bucket_id = 'food-photos');
