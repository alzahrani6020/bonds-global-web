-- Helper: create the public.profiles baseline table.
-- In the original environment this table was created outside migrations (via
-- Supabase Auth trigger setup). Several early migrations assume it exists.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  full_name text,
  avatar_url text,
  website text,
  company_name text,
  role text,
  restaurant_name text,
  country text DEFAULT 'SA',
  city text,
  city_name text,
  city_code text,
  governorate text,
  business_type text,
  bio text,
  needs text,
  employee_count integer,
  branch_count integer DEFAULT 1,
  language text DEFAULT 'ar',
  tier text DEFAULT 'free',
  status text DEFAULT 'active',
  stripe_customer_id text,
  oneoff_credits jsonb DEFAULT '{"ai_report": 0, "expert_review": 0, "approved_report": 0}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
