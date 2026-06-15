-- Bonds V3 — Master Data v2
-- Adds detailed activity level and regulatory requirements.

-- 1. Detailed activities (between activity and project model)
CREATE TABLE IF NOT EXISTS public.economic_activity_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_economic_activity_details_activity_id
  ON public.economic_activity_details(activity_id);

ALTER TABLE public.project_models
  ADD COLUMN IF NOT EXISTS activity_detail_id uuid
  REFERENCES public.economic_activity_details(id) ON DELETE SET NULL;

-- 2. Regulatory / licensing requirements
CREATE TABLE IF NOT EXISTS public.regulatory_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid REFERENCES public.economic_sectors(id) ON DELETE CASCADE,
  sub_sector_id uuid REFERENCES public.economic_sub_sectors(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  activity_detail_id uuid REFERENCES public.economic_activity_details(id) ON DELETE CASCADE,
  project_model_id uuid REFERENCES public.project_models(id) ON DELETE CASCADE,
  requirement_name_ar text NOT NULL,
  requirement_name_en text,
  issuing_authority text,
  estimated_cost numeric(14,2),
  mandatory boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_requirements_sector_id
  ON public.regulatory_requirements(sector_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_requirements_activity_id
  ON public.regulatory_requirements(activity_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_requirements_activity_detail_id
  ON public.regulatory_requirements(activity_detail_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_requirements_project_model_id
  ON public.regulatory_requirements(project_model_id);

-- 3. Enable RLS and add policies
ALTER TABLE public.economic_activity_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read activity details"
  ON public.economic_activity_details
  FOR SELECT
  TO anon, authenticated, service_role
  USING (is_active = true);

CREATE POLICY "Service role can manage activity details"
  ON public.economic_activity_details
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can read regulatory requirements"
  ON public.regulatory_requirements
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

CREATE POLICY "Service role can manage regulatory requirements"
  ON public.regulatory_requirements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
