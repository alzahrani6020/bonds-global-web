-- Migration: City Intelligence — Role Management RPCs
-- Created: 2026-06-18

-- Search auth.users for role assignment (managers/admins only)
CREATE OR REPLACE FUNCTION public.city_search_users(search_query text DEFAULT '')
RETURNS TABLE (id uuid, email text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.city_is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.raw_user_meta_data->>'full_name' AS full_name
  FROM auth.users u
  WHERE search_query = ''
     OR u.email ILIKE '%' || search_query || '%'
     OR u.id::text = search_query
  ORDER BY u.email
  LIMIT 50;
END;
$$;

-- List existing city_roles with user emails (managers/admins only)
CREATE OR REPLACE FUNCTION public.city_list_city_roles()
RETURNS TABLE (id uuid, user_id uuid, email text, role text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.city_is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT r.id, r.user_id, u.email::text, r.role, r.created_at
  FROM public.city_roles r
  JOIN auth.users u ON u.id = r.user_id
  ORDER BY r.created_at DESC;
END;
$$;

-- Allow managers to see all profiles when assigning roles
DROP POLICY IF EXISTS "city_managers_read_profiles" ON public.profiles;
CREATE POLICY "city_managers_read_profiles"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (public.city_is_manager_or_admin(auth.uid()));

-- Permissions
REVOKE ALL ON FUNCTION public.city_search_users(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.city_search_users(text) TO authenticated;

REVOKE ALL ON FUNCTION public.city_list_city_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.city_list_city_roles() TO authenticated;
