-- Helper: expose uuid_generate_v4 in public schema for older migrations
-- Supabase installs uuid-ossp in the extensions schema by default, but some
-- historical migrations call uuid_generate_v4() without schema qualification.
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT extensions.uuid_generate_v4();
$$;
