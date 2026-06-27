-- BONDS AI Valuation Analyst & Digital Valuation Certificate — Phase 1 schema
-- Tables: asset_valuations, valuation_ai_reports, valuation_certificates

-- ============================================================
-- 1. asset_valuations — canonical header for every valuation run
-- ============================================================
CREATE TABLE IF NOT EXISTS public.asset_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL,
  asset_name text,
  asset_identifier text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  recovery_asset_id uuid REFERENCES public.recovery_assets(id) ON DELETE SET NULL,
  condition_assessment_id uuid REFERENCES public.asset_condition_assessments(id) ON DELETE SET NULL,
  risk_assessment_id uuid REFERENCES public.risk_assessments(id) ON DELETE SET NULL,
  valuation_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  market_data_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  economic_life_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  depreciation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  condition_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  data_quality_score numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','final','archived')),
  valuation_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_valuations_user_id ON public.asset_valuations(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_client_id ON public.asset_valuations(client_id);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_recovery_asset_id ON public.asset_valuations(recovery_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_asset_class ON public.asset_valuations(asset_class);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_status ON public.asset_valuations(status);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_valuation_date ON public.asset_valuations(valuation_date);

COMMENT ON TABLE public.asset_valuations IS 'Canonical header for every BONDS valuation run';

-- ============================================================
-- 2. valuation_ai_reports — AI-generated narrative reports (versioned)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.valuation_ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_valuation_id uuid NOT NULL REFERENCES public.asset_valuations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  ai_version text NOT NULL DEFAULT '1.0.0',
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  executive_summary text,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  threats jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  future_forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_decision text,
  decision_reason text,
  content_html text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  tokens_input int DEFAULT 0,
  tokens_output int DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','approved','rejected')),
  pdf_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_valuation_id, version)
);

CREATE INDEX IF NOT EXISTS idx_valuation_ai_reports_valuation_id ON public.valuation_ai_reports(asset_valuation_id);
CREATE INDEX IF NOT EXISTS idx_valuation_ai_reports_user_id ON public.valuation_ai_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_valuation_ai_reports_status ON public.valuation_ai_reports(status);
CREATE INDEX IF NOT EXISTS idx_valuation_ai_reports_created_at ON public.valuation_ai_reports(created_at DESC);

COMMENT ON TABLE public.valuation_ai_reports IS 'AI-generated valuation narrative reports (versioned)';

-- ============================================================
-- 3. valuation_certificates — BONDS Digital Valuation Certificate (BDVC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.valuation_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_valuation_id uuid NOT NULL REFERENCES public.asset_valuations(id) ON DELETE CASCADE,
  valuation_ai_report_id uuid REFERENCES public.valuation_ai_reports(id) ON DELETE SET NULL,
  certificate_number text NOT NULL UNIQUE,
  asset_class text NOT NULL,
  asset_name text,
  asset_identifier text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  valid_until date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','revoked','expired')),
  valuation_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  methodologies jsonb NOT NULL DEFAULT '[]'::jsonb,
  executive_summary text,
  final_decision text,
  decision_reason text,
  future_forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  seal_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_url text,
  revocation_reason text,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_valuation_certificates_valuation_id ON public.valuation_certificates(asset_valuation_id);
CREATE INDEX IF NOT EXISTS idx_valuation_certificates_report_id ON public.valuation_certificates(valuation_ai_report_id);
CREATE INDEX IF NOT EXISTS idx_valuation_certificates_user_id ON public.valuation_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_valuation_certificates_status ON public.valuation_certificates(status);
CREATE INDEX IF NOT EXISTS idx_valuation_certificates_issued_at ON public.valuation_certificates(issued_at DESC);

COMMENT ON TABLE public.valuation_certificates IS 'BONDS Digital Valuation Certificate (BDVC)';

-- ============================================================
-- 4. Unique certificate number generator: BDVC-YYYY-CC-NNNNNNNN
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_bonds_certificate_number(p_country text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_seq bigint;
  v_lock_id bigint;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_lock_id := hashtext('bdvc_' || v_year || '_' || COALESCE(p_country, 'XX'));
  PERFORM pg_advisory_xact_lock(v_lock_id);

  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.valuation_certificates
  WHERE certificate_number LIKE 'BDVC-' || v_year || '-' || COALESCE(p_country, 'XX') || '-%';

  RETURN 'BDVC-' || v_year || '-' || COALESCE(p_country, 'XX') || '-' || lpad(v_seq::text, 8, '0');
END;
$$;

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE public.asset_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_certificates ENABLE ROW LEVEL SECURITY;

-- asset_valuations policies
DROP POLICY IF EXISTS "asset_valuations_select" ON public.asset_valuations;
CREATE POLICY "asset_valuations_select"
  ON public.asset_valuations FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = asset_valuations.client_id AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "asset_valuations_write" ON public.asset_valuations;
CREATE POLICY "asset_valuations_write"
  ON public.asset_valuations FOR ALL
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
  );

-- valuation_ai_reports policies
DROP POLICY IF EXISTS "valuation_ai_reports_select" ON public.valuation_ai_reports;
CREATE POLICY "valuation_ai_reports_select"
  ON public.valuation_ai_reports FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = valuation_ai_reports.client_id AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "valuation_ai_reports_write" ON public.valuation_ai_reports;
CREATE POLICY "valuation_ai_reports_write"
  ON public.valuation_ai_reports FOR ALL
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
  );

-- valuation_certificates policies
-- Public can verify issued certificates; owners/admins can read their own.
DROP POLICY IF EXISTS "valuation_certificates_select" ON public.valuation_certificates;
CREATE POLICY "valuation_certificates_select"
  ON public.valuation_certificates FOR SELECT
  USING (
    status = 'issued'
    OR auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
    OR EXISTS (
      SELECT 1 FROM public.advisory_clients c
      WHERE c.id = valuation_certificates.client_id AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "valuation_certificates_write" ON public.valuation_certificates;
CREATE POLICY "valuation_certificates_write"
  ON public.valuation_certificates FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin','editor'))
  );

-- service_role bypass (standard pattern)
DROP POLICY IF EXISTS "service_role_manage_valuation_tables" ON public.asset_valuations;
CREATE POLICY "service_role_manage_valuation_tables"
  ON public.asset_valuations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_valuation_ai_reports" ON public.valuation_ai_reports;
CREATE POLICY "service_role_manage_valuation_ai_reports"
  ON public.valuation_ai_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_valuation_certificates" ON public.valuation_certificates;
CREATE POLICY "service_role_manage_valuation_certificates"
  ON public.valuation_certificates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. Storage bucket for certificate PDFs (private by default)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('valuation-certificates', 'valuation-certificates', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
