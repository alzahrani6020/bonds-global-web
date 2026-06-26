-- Asset-level Condition Assessment records
-- Stores individual inspection results per asset, separate from the standards table.

CREATE TABLE IF NOT EXISTS public.asset_condition_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL,
  asset_name text,
  asset_identifier text,
  recovery_asset_id uuid REFERENCES public.recovery_assets(id) ON DELETE SET NULL,
  client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assessed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assessment_date date NOT NULL DEFAULT now(),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric(5,2) NOT NULL DEFAULT 0,
  grade text,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  category_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  critical_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  valuation_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'final', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_asset_condition_assessments_class
  ON public.asset_condition_assessments(asset_class);
CREATE INDEX IF NOT EXISTS idx_asset_condition_assessments_client
  ON public.asset_condition_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_asset_condition_assessments_date
  ON public.asset_condition_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_asset_condition_assessments_recovery_asset
  ON public.asset_condition_assessments(recovery_asset_id);

ALTER TABLE public.asset_condition_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Asset condition assessments readable by owner or admin"
  ON public.asset_condition_assessments FOR SELECT
  USING (
    auth.uid() = client_id
    OR auth.uid() = assessed_by
    OR auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Asset condition assessments insertable by authenticated users"
  ON public.asset_condition_assessments FOR INSERT
  WITH CHECK (auth.uid() = assessed_by);

CREATE POLICY "Asset condition assessments updatable by owner or admin"
  ON public.asset_condition_assessments FOR UPDATE
  USING (
    auth.uid() = assessed_by
    OR auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Asset condition assessments deletable by admin"
  ON public.asset_condition_assessments FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
    )
  );
