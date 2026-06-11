-- ============================================
-- Fix: copy phone from user_metadata during signup
-- Previous trigger used new.phone which is only set for phone-auth users.
-- Email/password signups store phone in raw_user_meta_data->>'phone'.
-- ============================================

-- 1. Fix the trigger function to read phone from user_metadata
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

-- 3. Backfill missing phone numbers from user_metadata for existing profiles
UPDATE public.profiles p
SET phone = COALESCE(u.raw_user_meta_data->>'phone', u.phone)
FROM auth.users u
WHERE p.id = u.id
  AND (p.phone IS NULL OR p.phone = '');
