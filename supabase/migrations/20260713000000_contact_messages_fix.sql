-- Fix contact_messages table to match api/platform.js siteContactHandler payload
-- Root cause: handler inserts `city` (column missing) and may send email: null
-- while the table had `email text NOT NULL` → every insert failed silently.

-- 1) Add missing city column
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS city text;

-- 2) Make email optional (phone is the required contact channel)
ALTER TABLE public.contact_messages
  ALTER COLUMN email DROP NOT NULL;
