-- Enterprise Soft Deletes & Data Quality Fixes

-- Add deleted_at to transactional tables
ALTER TABLE public.advisory_clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.advisory_projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.recovery_assets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add updated_by audit columns
ALTER TABLE public.advisory_clients ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.advisory_projects ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.recovery_assets ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ai_advisor_reports ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Set default updated_at triggers where missing
DROP TRIGGER IF EXISTS trg_recovery_assets_updated_at ON public.recovery_assets;
CREATE TRIGGER trg_recovery_assets_updated_at BEFORE UPDATE ON public.recovery_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_advisor_reports_updated_by_updated_at ON public.ai_advisor_reports;
CREATE TRIGGER trg_ai_advisor_reports_updated_by_updated_at BEFORE UPDATE ON public.ai_advisor_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Normalize empty emails to NULL so unique constraint allows multiple unknowns
UPDATE public.advisory_clients SET email = NULL WHERE email IS NOT NULL AND length(trim(email)) = 0;

-- Fix duplicate emails before adding unique constraint (keep oldest record)
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT lower(trim(email)) AS email_lower
    FROM public.advisory_clients
    WHERE email IS NOT NULL AND length(trim(email)) > 0
    GROUP BY lower(trim(email))
    HAVING count(*) > 1
  LOOP
    -- Mark newer duplicates with a suffix so unique constraint can be added later
    UPDATE public.advisory_clients c1
    SET email = c1.email || '.dup.' || substr(md5(random()::text), 1, 6)
    FROM (
      SELECT id, row_number() OVER (PARTITION BY lower(trim(email)) ORDER BY created_at, id) AS rn
      FROM public.advisory_clients
      WHERE lower(trim(email)) = rec.email_lower
    ) c2
    WHERE c1.id = c2.id AND c2.rn > 1;
  END LOOP;
END $$;

-- Add unique constraints where safe
ALTER TABLE public.advisory_clients ADD CONSTRAINT uq_advisory_clients_email UNIQUE (email);

-- Add FK from profiles to auth.users
DO $$
BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_auth_users FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;
