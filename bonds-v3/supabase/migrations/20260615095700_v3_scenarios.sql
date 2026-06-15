-- Bonds V3 — Advanced Scenario Engine
-- Stores user/project scenarios for sensitivity analysis.

CREATE TABLE IF NOT EXISTS public.project_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.user_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  project_model_code text NOT NULL,
  city_code text,
  baseline_assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  shocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_saved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_scenarios_user_id
  ON public.project_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_project_scenarios_project_id
  ON public.project_scenarios(project_id);
CREATE INDEX IF NOT EXISTS idx_project_scenarios_created_at
  ON public.project_scenarios(created_at DESC);

ALTER TABLE public.project_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scenarios"
  ON public.project_scenarios FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all scenarios"
  ON public.project_scenarios FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS project_scenarios_updated_at ON public.project_scenarios;
CREATE TRIGGER project_scenarios_updated_at
  BEFORE UPDATE ON public.project_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
