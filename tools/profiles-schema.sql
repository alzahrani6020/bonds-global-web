-- Run this in Supabase Dashboard → SQL Editor
-- Adds profile fields for restaurant/business info

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS peak_hours_start text,
ADD COLUMN IF NOT EXISTS peak_hours_end text,
ADD COLUMN IF NOT EXISTS rush_hours_start text,
ADD COLUMN IF NOT EXISTS rush_hours_end text;

-- Update RLS policy to allow users to update their own profile
-- (if not already present)
CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
