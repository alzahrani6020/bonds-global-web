-- Preview/Staging compatibility: isolated HR environments may lack the
-- base BONDS profiles table needed by /calculators/auth/onboarding.html.
-- Production already has public.profiles; leave it completely unchanged.
DO $migration$
BEGIN
 IF to_regclass('public.profiles') IS NOT NULL THEN
   RETURN;
 END IF;

 CREATE TABLE public.profiles (
   id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
   restaurant_name text,
   country text,
   language text DEFAULT 'ar',
   tier text DEFAULT 'free' CHECK (tier IN ('free','pro','enterprise')),
   status text DEFAULT 'active' CHECK (status IN ('active','inactive','trialing','past_due')),
   stripe_customer_id text,
   stripe_subscription_id text,
   created_at timestamptz DEFAULT now(),
   updated_at timestamptz DEFAULT now(),
   avatar_url text,
   phone text,
   city text,
   neighborhood text,
   peak_hours_start text,
   peak_hours_end text,
   rush_hours_start text,
   rush_hours_end text,
   email text,
   business_type text,
   bio text,
   needs text,
   employee_count integer,
   branch_count integer,
   oneoff_credits jsonb DEFAULT '{"ai_report":0,"expert_review":0,"approved_report":0}'::jsonb,
   role text NOT NULL DEFAULT 'owner',
   tier_expires_at timestamptz,
   profile_completeness integer DEFAULT 0,
   profile_reminder_sent_at timestamptz,
   governorate text,
   city_name text
 );

 EXECUTE 'COMMENT ON TABLE public.profiles IS ''BONDS_HR_PREVIEW_PROFILE_CONTRACT_V1''';
 ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
 CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
 CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id)
   WITH CHECK ((SELECT auth.uid()) = id);
 CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = id);

 REVOKE ALL ON public.profiles FROM PUBLIC, anon;
 GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
 GRANT ALL ON public.profiles TO service_role;
END;
$migration$;
