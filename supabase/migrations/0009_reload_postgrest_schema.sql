-- 0009_reload_postgrest_schema.sql
-- Make newly installed RPC functions immediately visible to the Supabase API.

notify pgrst, 'reload schema';
