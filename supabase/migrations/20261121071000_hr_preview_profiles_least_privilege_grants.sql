-- Restrict default Supabase grants on preview profiles.
-- RLS does not prevent TRUNCATE: authenticated must not own TRUNCATE, REFERENCES or TRIGGER.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.profiles TO authenticated;
GRANT INSERT (id, restaurant_name, country, governorate, city, city_name,
 business_type, phone, employee_count, branch_count, bio, needs, language,
 updated_at, avatar_url, neighborhood, email) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (restaurant_name, country, governorate, city, city_name,
 business_type, phone, employee_count, branch_count, bio, needs, language,
 updated_at, avatar_url, neighborhood, email) ON TABLE public.profiles TO authenticated;
