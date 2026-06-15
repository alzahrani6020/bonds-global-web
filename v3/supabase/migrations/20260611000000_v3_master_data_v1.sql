-- Bonds V3 Enterprise — Economic Master Data V1
-- Initial schema for sectors, sub-sectors, activities, project models,
-- financial assumptions, market intelligence, risk engine and enterprise entities.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-----------------------------------------------------------------------------
-- 1. Economic taxonomy: sectors → sub-sectors → activities
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.economic_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  risk_category TEXT CHECK (risk_category IN ('low', 'medium', 'high', 'volatile')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.economic_sub_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES public.economic_sectors(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.economic_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES public.economic_sectors(id) ON DELETE CASCADE,
  sub_sector_id UUID NOT NULL REFERENCES public.economic_sub_sectors(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-----------------------------------------------------------------------------
-- 2. Project Models (the core reusable templates)
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES public.economic_sectors(id) ON DELETE CASCADE,
  sub_sector_id UUID NOT NULL REFERENCES public.economic_sub_sectors(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  model_type TEXT NOT NULL DEFAULT 'greenfield' CHECK (model_type IN ('greenfield', 'franchise', 'existing', 'expansion')),
  size_category TEXT NOT NULL DEFAULT 'medium' CHECK (size_category IN ('small', 'medium', 'large', 'mega')),
  default_currency TEXT NOT NULL DEFAULT 'SAR',
  -- Typical ranges (SAR)
  capex_min NUMERIC(14,2),
  capex_max NUMERIC(14,2),
  revenue_min NUMERIC(14,2),
  revenue_max NUMERIC(14,2),
  employee_count_min INTEGER,
  employee_count_max INTEGER,
  typical_roi_months INTEGER,
  -- Taxonomy / search
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-----------------------------------------------------------------------------
-- 3. Financial assumptions engine
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'revenue', 'cogs', 'opex', 'capex', 'tax', 'depreciation',
    'working_capital', 'financing', 'hr', 'utilities', 'rent'
  )),
  unit_type TEXT NOT NULL CHECK (unit_type IN (
    'percentage', 'fixed_amount', 'ratio', 'count', 'days', 'months', 'per_unit'
  )),
  default_value NUMERIC(14,4) NOT NULL,
  min_value NUMERIC(14,4),
  max_value NUMERIC(14,4),
  description TEXT,
  source TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-model overrides of assumptions
CREATE TABLE IF NOT EXISTS public.project_model_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_model_id UUID NOT NULL REFERENCES public.project_models(id) ON DELETE CASCADE,
  assumption_id UUID NOT NULL REFERENCES public.financial_assumptions(id) ON DELETE CASCADE,
  value NUMERIC(14,4) NOT NULL,
  override_notes TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_model_id, assumption_id)
);

-----------------------------------------------------------------------------
-- 4. Market Intelligence
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  region TEXT,
  country_code TEXT NOT NULL DEFAULT 'SA',
  population INTEGER,
  population_growth_rate NUMERIC(6,3),
  avg_household_income NUMERIC(14,2),
  purchasing_power_index NUMERIC(6,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.city_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  competitors_count INTEGER,
  avg_market_share NUMERIC(6,2), -- percentage
  avg_rent_per_sqm NUMERIC(14,2),
  avg_land_price_per_sqm NUMERIC(14,2),
  avg_salary NUMERIC(14,2),
  labor_availability_score INTEGER CHECK (labor_availability_score BETWEEN 0 AND 100),
  market_saturation_score INTEGER CHECK (market_saturation_score BETWEEN 0 AND 100),
  data_year INTEGER NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city_id, activity_id, data_year)
);

-----------------------------------------------------------------------------
-- 5. Risk Engine
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'market', 'financial', 'operational', 'legal', 'environmental', 'geopolitical'
  )),
  weight NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  default_score INTEGER NOT NULL DEFAULT 50 CHECK (default_score BETWEEN 0 AND 100),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_model_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_model_id UUID NOT NULL REFERENCES public.project_models(id) ON DELETE CASCADE,
  risk_factor_id UUID NOT NULL REFERENCES public.risk_factors(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_model_id, risk_factor_id)
);

-- Optional: city-specific risk adjustments
CREATE TABLE IF NOT EXISTS public.city_risk_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  risk_factor_id UUID NOT NULL REFERENCES public.risk_factors(id) ON DELETE CASCADE,
  adjustment INTEGER NOT NULL DEFAULT 0, -- added to base score
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city_id, risk_factor_id)
);

-----------------------------------------------------------------------------
-- 6. Enterprise entities
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('investor', 'consultant', 'bank', 'enterprise')),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

-----------------------------------------------------------------------------
-- 7. User projects and reports
-----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  project_model_id UUID NOT NULL REFERENCES public.project_models(id) ON DELETE CASCADE,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
  -- User overrides and computed results (immutable snapshots)
  assumptions JSONB DEFAULT '{}',
  financial_results JSONB DEFAULT '{}',
  risk_results JSONB DEFAULT '{}',
  ai_insights JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('feasibility', 'investor', 'bank', 'executive')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'docx', 'pptx')),
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-----------------------------------------------------------------------------
-- 8. Indexes
-----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_economic_sub_sectors_sector_id ON public.economic_sub_sectors(sector_id);
CREATE INDEX IF NOT EXISTS idx_economic_activities_sector_id ON public.economic_activities(sector_id);
CREATE INDEX IF NOT EXISTS idx_economic_activities_sub_sector_id ON public.economic_activities(sub_sector_id);
CREATE INDEX IF NOT EXISTS idx_project_models_sector_id ON public.project_models(sector_id);
CREATE INDEX IF NOT EXISTS idx_project_models_activity_id ON public.project_models(activity_id);
CREATE INDEX IF NOT EXISTS idx_project_models_published ON public.project_models(is_published, is_active);
CREATE INDEX IF NOT EXISTS idx_project_model_assumptions_model_id ON public.project_model_assumptions(project_model_id);
CREATE INDEX IF NOT EXISTS idx_city_market_data_city_activity_year ON public.city_market_data(city_id, activity_id, data_year);
CREATE INDEX IF NOT EXISTS idx_project_model_risks_model_id ON public.project_model_risks(project_model_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON public.user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_company_id ON public.user_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON public.reports(project_id);

-----------------------------------------------------------------------------
-- 9. Row Level Security
-----------------------------------------------------------------------------

-- Master data: readable by everyone, writable only via service role
ALTER TABLE public.economic_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_sub_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_model_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_model_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_risk_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read economic_sectors" ON public.economic_sectors;
CREATE POLICY "Public read economic_sectors"
  ON public.economic_sectors FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Public read economic_sub_sectors" ON public.economic_sub_sectors;
CREATE POLICY "Public read economic_sub_sectors"
  ON public.economic_sub_sectors FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Public read economic_activities" ON public.economic_activities;
CREATE POLICY "Public read economic_activities"
  ON public.economic_activities FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Public read project_models" ON public.project_models;
CREATE POLICY "Public read project_models"
  ON public.project_models FOR SELECT TO PUBLIC USING (is_published = true AND is_active = true);
DROP POLICY IF EXISTS "Public read financial_assumptions" ON public.financial_assumptions;
CREATE POLICY "Public read financial_assumptions"
  ON public.financial_assumptions FOR SELECT TO PUBLIC USING (is_active = true);
DROP POLICY IF EXISTS "Public read project_model_assumptions" ON public.project_model_assumptions;
CREATE POLICY "Public read project_model_assumptions"
  ON public.project_model_assumptions FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Public read cities" ON public.cities;
CREATE POLICY "Public read cities"
  ON public.cities FOR SELECT TO PUBLIC USING (is_active = true);
DROP POLICY IF EXISTS "Public read city_market_data" ON public.city_market_data;
CREATE POLICY "Public read city_market_data"
  ON public.city_market_data FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Public read risk_factors" ON public.risk_factors;
CREATE POLICY "Public read risk_factors"
  ON public.risk_factors FOR SELECT TO PUBLIC USING (is_active = true);
DROP POLICY IF EXISTS "Public read project_model_risks" ON public.project_model_risks;
CREATE POLICY "Public read project_model_risks"
  ON public.project_model_risks FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Public read city_risk_adjustments" ON public.city_risk_adjustments;
CREATE POLICY "Public read city_risk_adjustments"
  ON public.city_risk_adjustments FOR SELECT TO PUBLIC USING (true);

-- Enterprise / user data: private
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own companies" ON public.companies;
CREATE POLICY "Users can view own companies"
  ON public.companies FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own company memberships" ON public.company_members;
CREATE POLICY "Users can view own company memberships"
  ON public.company_members FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own projects" ON public.user_projects;
CREATE POLICY "Users can view own projects"
  ON public.user_projects FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own projects" ON public.user_projects;
CREATE POLICY "Users can insert own projects"
  ON public.user_projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own projects" ON public.user_projects;
CREATE POLICY "Users can update own projects"
  ON public.user_projects FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT TO authenticated USING (
    project_id IN (SELECT id FROM public.user_projects WHERE user_id = auth.uid())
  );

-----------------------------------------------------------------------------
-- 10. Auto-update updated_at trigger
-----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'economic_sectors', 'economic_sub_sectors', 'economic_activities',
      'project_models', 'financial_assumptions', 'project_model_assumptions',
      'cities', 'city_market_data', 'risk_factors', 'project_model_risks',
      'city_risk_adjustments', 'companies', 'company_members',
      'user_projects', 'reports'
    )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;',
      t, t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END $$;
-- Bonds V3 — Utility RPC for executing seed SQL from scripts
-- WARNING: This function runs with service-role privileges. Do not expose to public.

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM authenticated;
