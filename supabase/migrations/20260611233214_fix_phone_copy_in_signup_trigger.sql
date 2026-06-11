-- ============================================
-- Fix: copy all signup metadata from auth.users to profiles
-- Previous trigger used new.phone which is only set for phone-auth users.
-- Email/password signups store all extra fields in raw_user_meta_data.
-- ============================================

-- 1. Fix the trigger function to read phone (and all fields) from user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, restaurant_name, country, city, business_type, bio, needs, employee_count,
    language, email, phone, tier, status
  ) VALUES (
    new.id,
    new.raw_user_meta_data->>'restaurant_name',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'business_type',
    new.raw_user_meta_data->>'bio',
    new.raw_user_meta_data->>'needs',
    (new.raw_user_meta_data->>'employee_count')::int,
    COALESCE(new.raw_user_meta_data->>'language', 'ar'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', new.phone),
    'free',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    restaurant_name = EXCLUDED.restaurant_name,
    country = EXCLUDED.country,
    city = EXCLUDED.city,
    business_type = EXCLUDED.business_type,
    bio = EXCLUDED.bio,
    needs = EXCLUDED.needs,
    employee_count = EXCLUDED.employee_count,
    language = EXCLUDED.language,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Create missing profiles for existing auth users
INSERT INTO public.profiles (
  id, restaurant_name, country, city, business_type, bio, needs, employee_count,
  language, email, phone, tier, status, created_at
)
SELECT
  u.id,
  u.raw_user_meta_data->>'restaurant_name',
  u.raw_user_meta_data->>'country',
  u.raw_user_meta_data->>'city',
  u.raw_user_meta_data->>'business_type',
  u.raw_user_meta_data->>'bio',
  u.raw_user_meta_data->>'needs',
  (u.raw_user_meta_data->>'employee_count')::int,
  COALESCE(u.raw_user_meta_data->>'language', 'ar'),
  u.email,
  COALESCE(u.raw_user_meta_data->>'phone', u.phone),
  'free',
  'active',
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 4. Backfill all missing profile fields from user_metadata for existing profiles
UPDATE public.profiles p
SET
  restaurant_name = COALESCE(NULLIF(p.restaurant_name, ''), u.raw_user_meta_data->>'restaurant_name'),
  country = COALESCE(NULLIF(p.country, ''), u.raw_user_meta_data->>'country'),
  city = COALESCE(NULLIF(p.city, ''), u.raw_user_meta_data->>'city'),
  business_type = COALESCE(NULLIF(p.business_type, ''), u.raw_user_meta_data->>'business_type'),
  bio = COALESCE(NULLIF(p.bio, ''), u.raw_user_meta_data->>'bio'),
  needs = COALESCE(NULLIF(p.needs, ''), u.raw_user_meta_data->>'needs'),
  employee_count = COALESCE(p.employee_count, (u.raw_user_meta_data->>'employee_count')::int),
  phone = COALESCE(NULLIF(p.phone, ''), u.raw_user_meta_data->>'phone', u.phone)
FROM auth.users u
WHERE p.id = u.id;
