-- ============================================
-- Fix: attach trigger to auto-create profiles on signup
-- Also backfill missing profiles for existing users
-- ============================================

-- 1. Ensure the function exists (idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, restaurant_name, country, language, email, phone, tier, status
  ) VALUES (
    new.id,
    new.raw_user_meta_data->>'restaurant_name',
    new.raw_user_meta_data->>'country',
    COALESCE(new.raw_user_meta_data->>'language', 'ar'),
    new.email,
    new.phone,
    'free',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill missing profiles for existing auth users
INSERT INTO public.profiles (id, restaurant_name, country, language, email, phone, tier, status, created_at)
SELECT
  u.id,
  u.raw_user_meta_data->>'restaurant_name',
  u.raw_user_meta_data->>'country',
  COALESCE(u.raw_user_meta_data->>'language', 'ar'),
  u.email,
  u.phone,
  'free',
  'active',
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 4. Backfill email/phone for existing profiles that are null
UPDATE public.profiles p
SET email = u.email,
    phone = u.phone
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.phone IS NULL);
