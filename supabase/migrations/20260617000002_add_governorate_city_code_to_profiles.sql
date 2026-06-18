-- Add governorate and structured city fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS governorate text,
  ADD COLUMN IF NOT EXISTS city_code text,
  ADD COLUMN IF NOT EXISTS city_name text;
