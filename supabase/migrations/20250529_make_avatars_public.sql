-- Make the 'avatars' storage bucket publicly accessible
-- This allows public URLs to work without authentication
-- Run this in Supabase Dashboard → SQL Editor

-- Option 1: If bucket already exists, make it public
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- Option 2: If bucket doesn't exist, create it as public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Verify
SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';
