-- Only extend grants for the preview-only profiles table, never Production.
DO $preview$
BEGIN
 IF to_regclass('public.profiles') IS NULL OR
    obj_description(to_regclass('public.profiles'),'pg_class') IS DISTINCT FROM
      'BONDS_HR_PREVIEW_PROFILE_CONTRACT_V1' THEN
   RETURN;
 END IF;
 EXECUTE 'GRANT UPDATE (id) ON TABLE public.profiles TO authenticated';
END
$preview$;
