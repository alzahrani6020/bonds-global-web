-- Migration: City Intelligence Module
-- Created: 2026-06-18

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles
CREATE TABLE IF NOT EXISTS public.city_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','analyst','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE public.city_roles IS 'Access control for City Intelligence module';

-- Cities
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text,
  country_code text,
  region text,
  population bigint,
  area_km2 numeric(12,2),
  center_lat numeric(10,7),
  center_lng numeric(10,7),
  boundary_geojson jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cities IS 'Cities covered by City Intelligence';

-- Districts / neighborhoods
CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_en text,
  center_lat numeric(10,7),
  center_lng numeric(10,7),
  boundary_geojson jsonb,
  population bigint,
  households bigint,
  avg_income numeric(12,2),
  urban_growth_rate numeric(5,2),
  land_price_per_sqm numeric(12,2),
  rent_per_sqm numeric(12,2),
  commercial_density_score numeric(5,2),
  competition_index numeric(5,2),
  government_projects_count int NOT NULL DEFAULT 0,
  investment_score numeric(5,2),
  investment_rating text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.districts IS 'Districts/neighborhoods with investment indicators';

-- Indicator history / source values
CREATE TABLE IF NOT EXISTS public.city_indicator_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES public.districts(id) ON DELETE CASCADE,
  indicator_key text NOT NULL CHECK (indicator_key IN ('population','income','urban_growth','government_projects','competition','land_price','rent','commercial_density')),
  value_numeric numeric(15,4),
  value_text text,
  unit text,
  year int,
  source text,
  metadata jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.city_indicator_values IS 'Historical/source indicator values';

-- Government / infrastructure projects
CREATE TABLE IF NOT EXISTS public.city_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  name text NOT NULL,
  project_type text,
  budget numeric(15,2),
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ongoing','completed','cancelled')),
  impact_score numeric(5,2) CHECK (impact_score BETWEEN 0 AND 100),
  lat numeric(10,7),
  lng numeric(10,7),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.city_projects IS 'Government and infrastructure projects affecting investment';

-- Competitors / market players
CREATE TABLE IF NOT EXISTS public.city_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text,
  lat numeric(10,7),
  lng numeric(10,7),
  market_share_estimate numeric(5,2),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.city_competitors IS 'Competitors and market density markers';

-- Saved reports
CREATE TABLE IF NOT EXISTS public.city_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  title text NOT NULL,
  config jsonb,
  overall_score numeric(5,2),
  summary text,
  pdf_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.city_reports IS 'Generated City Intelligence reports';

-- Activity logs
CREATE TABLE IF NOT EXISTS public.city_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES public.districts(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.city_activity_logs IS 'City Intelligence activity log';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_districts_city_id ON public.districts(city_id);
CREATE INDEX IF NOT EXISTS idx_districts_status ON public.districts(status);
CREATE INDEX IF NOT EXISTS idx_districts_investment_score ON public.districts(investment_score DESC);
CREATE INDEX IF NOT EXISTS idx_indicator_values_city ON public.city_indicator_values(city_id);
CREATE INDEX IF NOT EXISTS idx_indicator_values_district ON public.city_indicator_values(district_id);
CREATE INDEX IF NOT EXISTS idx_indicator_values_key ON public.city_indicator_values(indicator_key);
CREATE INDEX IF NOT EXISTS idx_city_projects_city_id ON public.city_projects(city_id);
CREATE INDEX IF NOT EXISTS idx_city_competitors_city_id ON public.city_competitors(city_id);
CREATE INDEX IF NOT EXISTS idx_city_reports_city_id ON public.city_reports(city_id);
CREATE INDEX IF NOT EXISTS idx_city_activity_created_at ON public.city_activity_logs(created_at DESC);

-- Updated at triggers
CREATE OR REPLACE FUNCTION public.city_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cities_updated_at ON public.cities;
CREATE TRIGGER trg_cities_updated_at
  BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.city_set_updated_at();

DROP TRIGGER IF EXISTS trg_districts_updated_at ON public.districts;
CREATE TRIGGER trg_districts_updated_at
  BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.city_set_updated_at();

DROP TRIGGER IF EXISTS trg_city_projects_updated_at ON public.city_projects;
CREATE TRIGGER trg_city_projects_updated_at
  BEFORE UPDATE ON public.city_projects
  FOR EACH ROW EXECUTE FUNCTION public.city_set_updated_at();

DROP TRIGGER IF EXISTS trg_city_competitors_updated_at ON public.city_competitors;
CREATE TRIGGER trg_city_competitors_updated_at
  BEFORE UPDATE ON public.city_competitors
  FOR EACH ROW EXECUTE FUNCTION public.city_set_updated_at();

DROP TRIGGER IF EXISTS trg_city_reports_updated_at ON public.city_reports;
CREATE TRIGGER trg_city_reports_updated_at
  BEFORE UPDATE ON public.city_reports
  FOR EACH ROW EXECUTE FUNCTION public.city_set_updated_at();

DROP TRIGGER IF EXISTS trg_city_roles_updated_at ON public.city_roles;
CREATE TRIGGER trg_city_roles_updated_at
  BEFORE UPDATE ON public.city_roles
  FOR EACH ROW EXECUTE FUNCTION public.city_set_updated_at();

-- RLS
ALTER TABLE public.city_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_indicator_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_activity_logs ENABLE ROW LEVEL SECURITY;

-- Role helper
CREATE OR REPLACE FUNCTION public.city_is_manager_or_admin(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.city_roles
    WHERE city_roles.user_id = user_uuid
      AND city_roles.role IN ('admin','analyst')
  ) OR (
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'admin_roles'
    )
    AND EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = user_uuid
        AND admin_roles.role IN ('super_admin','admin')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies helper macro
-- city_roles
DROP POLICY IF EXISTS "city_roles_select" ON public.city_roles;
CREATE POLICY "city_roles_select" ON public.city_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR role = 'admin');

DROP POLICY IF EXISTS "city_roles_admin_write" ON public.city_roles;
CREATE POLICY "city_roles_admin_write" ON public.city_roles
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.city_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.city_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

-- cities
DROP POLICY IF EXISTS "cities_select" ON public.cities;
CREATE POLICY "cities_select" ON public.cities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cities_write" ON public.cities;
CREATE POLICY "cities_write" ON public.cities
  FOR ALL TO authenticated USING (public.city_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.city_is_manager_or_admin(auth.uid()));

-- districts
DROP POLICY IF EXISTS "districts_select" ON public.districts;
CREATE POLICY "districts_select" ON public.districts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "districts_write" ON public.districts;
CREATE POLICY "districts_write" ON public.districts
  FOR ALL TO authenticated USING (public.city_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.city_is_manager_or_admin(auth.uid()));

-- indicator values
DROP POLICY IF EXISTS "indicator_values_select" ON public.city_indicator_values;
CREATE POLICY "indicator_values_select" ON public.city_indicator_values
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "indicator_values_write" ON public.city_indicator_values;
CREATE POLICY "indicator_values_write" ON public.city_indicator_values
  FOR ALL TO authenticated USING (public.city_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.city_is_manager_or_admin(auth.uid()));

-- projects
DROP POLICY IF EXISTS "city_projects_select" ON public.city_projects;
CREATE POLICY "city_projects_select" ON public.city_projects
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "city_projects_write" ON public.city_projects;
CREATE POLICY "city_projects_write" ON public.city_projects
  FOR ALL TO authenticated USING (public.city_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.city_is_manager_or_admin(auth.uid()));

-- competitors
DROP POLICY IF EXISTS "city_competitors_select" ON public.city_competitors;
CREATE POLICY "city_competitors_select" ON public.city_competitors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "city_competitors_write" ON public.city_competitors;
CREATE POLICY "city_competitors_write" ON public.city_competitors
  FOR ALL TO authenticated USING (public.city_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.city_is_manager_or_admin(auth.uid()));

-- reports
DROP POLICY IF EXISTS "city_reports_select" ON public.city_reports;
CREATE POLICY "city_reports_select" ON public.city_reports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "city_reports_write" ON public.city_reports;
CREATE POLICY "city_reports_write" ON public.city_reports
  FOR ALL TO authenticated USING (public.city_is_manager_or_admin(auth.uid()))
  WITH CHECK (public.city_is_manager_or_admin(auth.uid()));

-- activity logs
DROP POLICY IF EXISTS "city_logs_select" ON public.city_activity_logs;
CREATE POLICY "city_logs_select" ON public.city_activity_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "city_logs_write" ON public.city_activity_logs;
CREATE POLICY "city_logs_write" ON public.city_activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Storage bucket for PDF reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('city-intelligence-reports', 'city-intelligence-reports', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
DROP POLICY IF EXISTS "city_reports_storage_select" ON storage.objects;
CREATE POLICY "city_reports_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'city-intelligence-reports');

DROP POLICY IF EXISTS "city_reports_storage_insert" ON storage.objects;
CREATE POLICY "city_reports_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'city-intelligence-reports' AND
    public.city_is_manager_or_admin(auth.uid())
  );

DROP POLICY IF EXISTS "city_reports_storage_delete" ON storage.objects;
CREATE POLICY "city_reports_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'city-intelligence-reports' AND
    public.city_is_manager_or_admin(auth.uid())
  );
