-- Risk Intelligence Engine: store risk assessments per asset

CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL,
  asset_name text,
  asset_identifier text,
  recovery_asset_id uuid REFERENCES public.recovery_assets(id) ON DELETE SET NULL,
  client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assessed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assessment_date date NOT NULL DEFAULT now(),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_index numeric(5,2) NOT NULL DEFAULT 0,
  risk_grade text,
  risk_level text,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  category_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  critical_risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  mitigations jsonb NOT NULL DEFAULT '[]'::jsonb,
  valuation_adjustments jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'final', 'archived'))
);

COMMENT ON TABLE public.risk_assessments IS 'Risk Intelligence assessments per asset';

ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Risk assessments readable by owner or admin" ON public.risk_assessments;
CREATE POLICY "Risk assessments readable by owner or admin"
  ON public.risk_assessments FOR SELECT
  USING (
    auth.uid() = client_id
    OR auth.uid() = assessed_by
    OR auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Risk assessments insertable by authenticated users" ON public.risk_assessments;
CREATE POLICY "Risk assessments insertable by authenticated users"
  ON public.risk_assessments FOR INSERT
  WITH CHECK (auth.uid() = assessed_by);

DROP POLICY IF EXISTS "Risk assessments updatable by owner or admin" ON public.risk_assessments;
CREATE POLICY "Risk assessments updatable by owner or admin"
  ON public.risk_assessments FOR UPDATE
  USING (
    auth.uid() = assessed_by
    OR auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Risk assessments deletable by admin" ON public.risk_assessments;
CREATE POLICY "Risk assessments deletable by admin"
  ON public.risk_assessments FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
    )
  );

CREATE INDEX IF NOT EXISTS idx_risk_assessments_class
  ON public.risk_assessments(asset_class);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_client
  ON public.risk_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_date
  ON public.risk_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_recovery_asset
  ON public.risk_assessments(recovery_asset_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_grade
  ON public.risk_assessments(risk_grade);

-- Helper view: high-risk assets
CREATE OR REPLACE VIEW public.high_risk_assets AS
SELECT
  id,
  asset_class,
  asset_name,
  asset_identifier,
  assessment_date,
  risk_index,
  risk_grade,
  risk_level,
  status,
  assessed_by,
  created_at
FROM public.risk_assessments
WHERE status != 'archived'
  AND risk_index >= 70;

ALTER VIEW public.high_risk_assets OWNER TO postgres;

GRANT SELECT ON public.high_risk_assets TO authenticated;
GRANT SELECT ON public.high_risk_assets TO anon;
