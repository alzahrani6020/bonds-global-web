-- ============================================
-- Add email & phone to profiles + update trigger
-- ============================================

-- Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Update trigger to copy email & phone from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, restaurant_name, country, language, email, phone
  ) VALUES (
    new.id,
    new.raw_user_meta_data->>'restaurant_name',
    new.raw_user_meta_data->>'country',
    COALESCE(new.raw_user_meta_data->>'language', 'ar'),
    new.email,
    new.phone
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also backfill existing users
UPDATE public.profiles p
SET email = u.email,
    phone = u.phone
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.phone IS NULL);
