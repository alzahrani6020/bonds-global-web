-- Add fields to advisory_projects to support AI auto-fill
ALTER TABLE public.advisory_projects
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS monthly_revenue NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS monthly_costs NUMERIC(15, 2);

CREATE INDEX IF NOT EXISTS idx_advisory_projects_sector ON public.advisory_projects(sector);
CREATE INDEX IF NOT EXISTS idx_advisory_projects_city ON public.advisory_projects(city);
