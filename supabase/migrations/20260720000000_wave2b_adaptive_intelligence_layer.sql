-- Wave 2B — Adaptive Intelligence Layer (AIL)
-- Decision profiles, timeline, digital twin, context memory, and learning loop.
-- Idempotent; safe to run on existing databases.

-- -----------------------------------------------------------------------------
-- 1. Decision Profile
-- Replaces traditional user profile with decision-centric patterns.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonds_decision_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  sectors jsonb NOT NULL DEFAULT '[]'::jsonb,
  valuation_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  report_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  expertise_score numeric NOT NULL DEFAULT 0,
  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  formulas jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_decision_profiles IS 'Decision-centric user profile for AIL.';

CREATE INDEX IF NOT EXISTS bonds_decision_profiles_user_id_idx ON public.bonds_decision_profiles (user_id);

DROP TRIGGER IF EXISTS bonds_decision_profiles_updated_at ON public.bonds_decision_profiles;
CREATE TRIGGER bonds_decision_profiles_updated_at
  BEFORE UPDATE ON public.bonds_decision_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Project Timeline
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonds_project_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reference_table text,
  reference_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_project_timeline_events IS 'Chronological record of all project decisions and milestones.';

CREATE INDEX IF NOT EXISTS bonds_project_timeline_events_project_id_idx ON public.bonds_project_timeline_events (project_id);
CREATE INDEX IF NOT EXISTS bonds_project_timeline_events_type_idx ON public.bonds_project_timeline_events (event_type);
CREATE INDEX IF NOT EXISTS bonds_project_timeline_events_created_at_idx ON public.bonds_project_timeline_events (created_at);

-- -----------------------------------------------------------------------------
-- 3. Digital Twin Foundation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonds_digital_twins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_digital_twins IS 'Digital twin snapshot for each project.';

CREATE INDEX IF NOT EXISTS bonds_digital_twins_project_id_idx ON public.bonds_digital_twins (project_id);

DROP TRIGGER IF EXISTS bonds_digital_twins_updated_at ON public.bonds_digital_twins;
CREATE TRIGGER bonds_digital_twins_updated_at
  BEFORE UPDATE ON public.bonds_digital_twins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Context Memory
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonds_project_context_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  last_valuation_id uuid,
  last_financing_id uuid,
  last_report_id uuid,
  last_scenario jsonb,
  last_assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  recent_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_project_context_memory IS 'Last known project context for resuming work.';

CREATE INDEX IF NOT EXISTS bonds_project_context_memory_project_id_idx ON public.bonds_project_context_memory (project_id);

DROP TRIGGER IF EXISTS bonds_project_context_memory_updated_at ON public.bonds_project_context_memory;
CREATE TRIGGER bonds_project_context_memory_updated_at
  BEFORE UPDATE ON public.bonds_project_context_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Learning Loop
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonds_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  report_id uuid,
  recommendation_id uuid,
  action text NOT NULL,
  delta jsonb,
  feedback text,
  confidence_before numeric,
  confidence_after numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bonds_learning_events IS 'Feedback loop events for adaptive recommendations.';

CREATE INDEX IF NOT EXISTS bonds_learning_events_user_id_idx ON public.bonds_learning_events (user_id);
CREATE INDEX IF NOT EXISTS bonds_learning_events_project_id_idx ON public.bonds_learning_events (project_id);
CREATE INDEX IF NOT EXISTS bonds_learning_events_event_type_idx ON public.bonds_learning_events (event_type);

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.bonds_decision_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_project_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_digital_twins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_project_context_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_learning_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_decision_profiles' AND policyname = 'bonds_decision_profiles_user_isolation'
  ) THEN
    CREATE POLICY bonds_decision_profiles_user_isolation ON public.bonds_decision_profiles
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_project_timeline_events' AND policyname = 'bonds_project_timeline_events_user_isolation'
  ) THEN
    CREATE POLICY bonds_project_timeline_events_user_isolation ON public.bonds_project_timeline_events
      USING (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_project_timeline_events.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_project_timeline_events.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_digital_twins' AND policyname = 'bonds_digital_twins_user_isolation'
  ) THEN
    CREATE POLICY bonds_digital_twins_user_isolation ON public.bonds_digital_twins
      USING (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_digital_twins.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_digital_twins.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_project_context_memory' AND policyname = 'bonds_project_context_memory_user_isolation'
  ) THEN
    CREATE POLICY bonds_project_context_memory_user_isolation ON public.bonds_project_context_memory
      USING (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_project_context_memory.project_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bonds_projects p WHERE p.id = bonds_project_context_memory.project_id AND p.user_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bonds_learning_events' AND policyname = 'bonds_learning_events_user_isolation'
  ) THEN
    CREATE POLICY bonds_learning_events_user_isolation ON public.bonds_learning_events
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Service role bypass for new tables
DO $$
DECLARE
  tbl text;
  pol_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bonds_decision_profiles', 'bonds_project_timeline_events', 'bonds_digital_twins',
    'bonds_project_context_memory', 'bonds_learning_events'
  ]
  LOOP
    pol_name := tbl || '_service_role';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = pol_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        pol_name, tbl
      );
    END IF;
  END LOOP;
END $$;
