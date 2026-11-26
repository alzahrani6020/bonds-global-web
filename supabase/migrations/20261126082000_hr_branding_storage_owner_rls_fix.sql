-- Fix HR branding uploads rejected by the original RLS policy.
-- The original predicate uses unqualified name inside a CRM workspace
-- subquery; PostgreSQL resolves it to c.name, not storage.objects.name.
-- This migration changes only the three existing branding policies:
-- no tables, storage objects, user memberships, or data are modified.
ALTER POLICY hr_branding_owner_select ON storage.objects
USING (
  bucket_id = 'hr-company-branding'
  AND storage.objects.name ~ '^[0-9a-f-]{36}/logo[.](png|jpg|webp)$'
  AND EXISTS (
    SELECT 1 FROM public.crm_app_workspaces c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.owner_user_id = (SELECT auth.uid())
  )
);

ALTER POLICY hr_branding_owner_insert ON storage.objects
WITH CHECK (
  bucket_id = 'hr-company-branding'
  AND storage.objects.name ~ '^[0-9a-f-]{36}/logo[.](png|jpg|webp)$'
  AND EXISTS (
    SELECT 1 FROM public.crm_app_workspaces c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.owner_user_id = (SELECT auth.uid())
  )
);

ALTER POLICY hr_branding_owner_update ON storage.objects
USING (
  bucket_id = 'hr-company-branding'
  AND storage.objects.name ~ '^[0-9a-f-]{36}/logo[.](png|jpg|webp)$'
  AND EXISTS (
    SELECT 1 FROM public.crm_app_workspaces c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.owner_user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'hr-company-branding'
  AND storage.objects.name ~ '^[0-9a-f-]{36}/logo[.](png|jpg|webp)$'
  AND EXISTS (
    SELECT 1 FROM public.crm_app_workspaces c
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.owner_user_id = (SELECT auth.uid())
  )
);
