-- Apply only to the preview-specific profiles table created by migration 70000.
-- Do not alter the pre-existing Production profiles table or its application grants.
DO $preview$
BEGIN
 IF to_regclass('public.profiles') IS NULL OR
    obj_description(to_regclass('public.profiles'),'pg_class') IS DISTINCT FROM
      'BONDS_HR_PREVIEW_PROFILE_CONTRACT_V1' THEN
   RETURN;
 END IF;
  EXECUTE $sql$REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated$sql$;
 EXECUTE $sql$GRANT SELECT, DELETE ON TABLE public.profiles TO authenticated$sql$;
 EXECUTE $sql$GRANT INSERT (id, restaurant_name, country, governorate, city, city_name,
 business_type, phone, employee_count, branch_count, bio, needs, language,
 updated_at, avatar_url, neighborhood, email) ON TABLE public.profiles TO authenticated$sql$;
 EXECUTE $sql$GRANT UPDATE (restaurant_name, country, governorate, city, city_name,
 business_type, phone, employee_count, branch_count, bio, needs, language,
 updated_at, avatar_url, neighborhood, email) ON TABLE public.profiles TO authenticated$sql$;
END;
$preview$;
