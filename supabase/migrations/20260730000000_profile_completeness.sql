-- Track profile completeness so admins can filter and nudge incomplete users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_completeness integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_completeness
  ON public.profiles(profile_completeness);

CREATE OR REPLACE FUNCTION public.compute_profile_completeness(p public.profiles)
RETURNS integer AS $$
DECLARE
  total integer := 9;
  filled integer := 0;
BEGIN
  IF p.restaurant_name IS NOT NULL AND length(trim(p.restaurant_name)) > 0 THEN filled := filled + 1; END IF;
  IF p.phone IS NOT NULL AND length(trim(p.phone)) > 0 THEN filled := filled + 1; END IF;
  IF p.country IS NOT NULL AND length(trim(p.country)) > 0 THEN filled := filled + 1; END IF;
  IF p.city IS NOT NULL AND length(trim(p.city)) > 0 THEN filled := filled + 1; END IF;
  IF p.business_type IS NOT NULL AND length(trim(p.business_type)) > 0 THEN filled := filled + 1; END IF;
  IF p.employee_count IS NOT NULL AND p.employee_count > 0 THEN filled := filled + 1; END IF;
  IF p.branch_count IS NOT NULL AND p.branch_count > 0 THEN filled := filled + 1; END IF;
  IF p.bio IS NOT NULL AND length(trim(p.bio)) > 0 THEN filled := filled + 1; END IF;
  IF p.needs IS NOT NULL AND length(trim(p.needs)) > 0 THEN filled := filled + 1; END IF;
  RETURN (filled * 100) / total;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_profile_completeness()
RETURNS trigger AS $$
BEGIN
  NEW.profile_completeness := public.compute_profile_completeness(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profile_completeness ON public.profiles;
CREATE TRIGGER trigger_update_profile_completeness
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_completeness();

-- Backfill existing rows
UPDATE public.profiles
SET profile_completeness = public.compute_profile_completeness(profiles.*)
WHERE profile_completeness IS NULL OR profile_completeness = 0;
