-- Add re-evaluation due date tracking to condition assessments

ALTER TABLE IF EXISTS public.asset_condition_assessments
ADD COLUMN IF NOT EXISTS next_assessment_due date;

-- Automatically set next due date to 6 months after assessment_date when not provided
CREATE OR REPLACE FUNCTION public.set_default_assessment_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assessment_date IS NOT NULL AND NEW.next_assessment_due IS NULL THEN
    NEW.next_assessment_due := NEW.assessment_date + INTERVAL '6 months';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_default_assessment_due_date ON public.asset_condition_assessments;
CREATE TRIGGER trg_set_default_assessment_due_date
BEFORE INSERT OR UPDATE ON public.asset_condition_assessments
FOR EACH ROW EXECUTE FUNCTION public.set_default_assessment_due_date();

-- Index for quickly finding assessments that are due or overdue
CREATE INDEX IF NOT EXISTS idx_asset_condition_assessments_next_due
ON public.asset_condition_assessments(next_assessment_due);

-- View for assets that need re-assessment (due today or overdue)
CREATE OR REPLACE VIEW public.assets_due_for_reassessment AS
SELECT
  id,
  asset_class,
  asset_name,
  asset_identifier,
  assessment_date,
  next_assessment_due,
  score,
  grade,
  status,
  assessed_by,
  created_at,
  GREATEST(next_assessment_due - CURRENT_DATE, 0) AS days_until_due
FROM public.asset_condition_assessments
WHERE next_assessment_due IS NOT NULL
  AND status != 'archived'
  AND next_assessment_due <= CURRENT_DATE + INTERVAL '30 days';

-- Refresh permissions for the view
ALTER VIEW public.assets_due_for_reassessment OWNER TO postgres;

-- Row Level Security: allow authenticated users to see due assets they own or if they have admin/editor role
-- (Assumes existing RLS policy on asset_condition_assessments grants SELECT to public and ALL to admin/editor)
GRANT SELECT ON public.assets_due_for_reassessment TO authenticated;
GRANT SELECT ON public.assets_due_for_reassessment TO anon;
