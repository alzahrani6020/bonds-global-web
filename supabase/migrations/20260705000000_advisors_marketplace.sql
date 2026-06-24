-- Advisor Marketplace MVP
-- Adds public advisor profiles and earnings tracking for Bonds-certified advisors.

-- ============================================
-- 1. Advisor profiles (public, linked to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.advisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  bio text,
  avatar_url text,
  specializations text[] DEFAULT '{}',
  languages text[] DEFAULT '{"ar","en"}',
  years_experience integer DEFAULT 0,
  certifications text[] DEFAULT '{}',
  commission_rate numeric(5,2) NOT NULL DEFAULT 25.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  hourly_rate numeric(10,2),
  is_public boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_advisors_user_id ON public.advisors(user_id);
CREATE INDEX IF NOT EXISTS idx_advisors_status_public ON public.advisors(status, is_public);
CREATE INDEX IF NOT EXISTS idx_advisors_sort_order ON public.advisors(sort_order DESC, created_at DESC);

COMMENT ON TABLE public.advisors IS 'Bonds-certified advisors available for client review requests.';

-- ============================================
-- 2. Link AI review requests to advisors
-- ============================================
ALTER TABLE public.ai_review_requests
  ADD COLUMN IF NOT EXISTS advisor_id uuid REFERENCES public.advisors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_by_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advisor_notes text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS oneoff_purchase_id uuid REFERENCES public.oneoff_purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_review_requests_advisor_idx ON public.ai_review_requests(advisor_id);

-- ============================================
-- 3. Advisor earnings ledger
-- ============================================
CREATE TABLE IF NOT EXISTS public.advisor_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id uuid NOT NULL REFERENCES public.advisors(id) ON DELETE CASCADE,
  review_request_id uuid REFERENCES public.ai_review_requests(id) ON DELETE SET NULL,
  oneoff_purchase_id uuid REFERENCES public.oneoff_purchases(id) ON DELETE SET NULL,
  description text NOT NULL,
  gross_amount numeric(10,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL DEFAULT 25.00,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  net_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisor_earnings_advisor_id ON public.advisor_earnings(advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_earnings_status ON public.advisor_earnings(status);
CREATE INDEX IF NOT EXISTS idx_advisor_earnings_review ON public.advisor_earnings(review_request_id);

COMMENT ON TABLE public.advisor_earnings IS 'Commission ledger for advisor marketplace payouts.';

-- ============================================
-- 4. Row Level Security
-- ============================================
ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_earnings ENABLE ROW LEVEL SECURITY;

-- Advisors: users can read their own profile
DROP POLICY IF EXISTS advisors_user_select ON public.advisors;
CREATE POLICY advisors_user_select ON public.advisors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (status = 'approved' AND is_public = true));

-- Admins: full access (admin_roles must exist; if not, policy is harmless but restricted)
DROP POLICY IF EXISTS advisors_admin_all ON public.advisors;
CREATE POLICY advisors_admin_all ON public.advisors
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','support')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','support')));

-- Advisor earnings: advisors read own, admins all
DROP POLICY IF EXISTS advisor_earnings_advisor_select ON public.advisor_earnings;
CREATE POLICY advisor_earnings_advisor_select ON public.advisor_earnings
  FOR SELECT TO authenticated
  USING (advisor_id IN (SELECT id FROM public.advisors WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS advisor_earnings_admin_all ON public.advisor_earnings;
CREATE POLICY advisor_earnings_admin_all ON public.advisor_earnings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','finance')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','finance')));

-- ============================================
-- 5. Trigger: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS advisors_updated_at ON public.advisors;
CREATE TRIGGER advisors_updated_at
  BEFORE UPDATE ON public.advisors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS advisor_earnings_updated_at ON public.advisor_earnings;
CREATE TRIGGER advisor_earnings_updated_at
  BEFORE UPDATE ON public.advisor_earnings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 6. Trigger: auto-create earnings when review approved
-- ============================================
CREATE OR REPLACE FUNCTION public.create_advisor_earning_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_advisor public.advisors%ROWTYPE;
  v_gross numeric(10,2);
  v_commission_rate numeric(5,2);
  v_commission numeric(10,2);
  v_net numeric(10,2);
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' AND NEW.advisor_id IS NOT NULL THEN
    SELECT * INTO v_advisor FROM public.advisors WHERE id = NEW.advisor_id;
    IF FOUND THEN
      -- Default gross amount and commission from site_settings
      SELECT COALESCE(NULLIF(value, '')::numeric, 149.00)
        INTO v_gross
        FROM public.site_settings
        WHERE key = 'oneoff_expert_review_price_sar';

      SELECT COALESCE(NULLIF(value, '')::numeric, v_advisor.commission_rate)
        INTO v_commission_rate
        FROM public.site_settings
        WHERE key = 'advisor_default_commission_rate';

      v_commission := ROUND(v_gross * (v_commission_rate / 100), 2);
      v_net := v_gross - v_commission;

      INSERT INTO public.advisor_earnings (
        advisor_id,
        review_request_id,
        description,
        gross_amount,
        commission_rate,
        commission_amount,
        net_amount,
        status
      ) VALUES (
        NEW.advisor_id,
        NEW.id,
        'Expert review commission',
        v_gross,
        v_commission_rate,
        v_commission,
        v_net,
        'pending'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_review_requests_advisor_earning ON public.ai_review_requests;
CREATE TRIGGER ai_review_requests_advisor_earning
  AFTER UPDATE ON public.ai_review_requests
  FOR EACH ROW EXECUTE FUNCTION public.create_advisor_earning_on_approval();
