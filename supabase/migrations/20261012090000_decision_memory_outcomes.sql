-- BONDS Decision Memory and Outcome Feedback
-- Additive migration. Preserves existing decision_memory deployments when present.

CREATE TABLE IF NOT EXISTS public.decision_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text,
  entity_type text NOT NULL DEFAULT 'project',
  decision_type text NOT NULL DEFAULT 'investment_decision',
  decision text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_memory_entity
  ON public.decision_memory(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_decision_memory_created_by
  ON public.decision_memory(created_by, created_at DESC);

ALTER TABLE public.decision_memory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'decision_memory'
      AND policyname = 'decision_memory_owner_read'
  ) THEN
    CREATE POLICY decision_memory_owner_read
      ON public.decision_memory
      FOR SELECT TO authenticated
      USING (created_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'decision_memory'
      AND policyname = 'decision_memory_owner_insert'
  ) THEN
    CREATE POLICY decision_memory_owner_insert
      ON public.decision_memory
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'decision_memory'
      AND policyname = 'decision_memory_service_all'
  ) THEN
    CREATE POLICY decision_memory_service_all
      ON public.decision_memory
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.decision_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES public.decision_memory(id) ON DELETE CASCADE,
  actual_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  variance jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'recorded',
  notes text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_decision
  ON public.decision_outcomes(decision_id, recorded_at DESC);

ALTER TABLE public.decision_outcomes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'decision_outcomes'
      AND policyname = 'decision_outcomes_owner_read'
  ) THEN
    CREATE POLICY decision_outcomes_owner_read
      ON public.decision_outcomes
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.decision_memory dm
          WHERE dm.id = decision_outcomes.decision_id
            AND dm.created_by = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'decision_outcomes'
      AND policyname = 'decision_outcomes_owner_insert'
  ) THEN
    CREATE POLICY decision_outcomes_owner_insert
      ON public.decision_outcomes
      FOR INSERT TO authenticated
      WITH CHECK (
        recorded_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.decision_memory dm
          WHERE dm.id = decision_outcomes.decision_id
            AND dm.created_by = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'decision_outcomes'
      AND policyname = 'decision_outcomes_service_all'
  ) THEN
    CREATE POLICY decision_outcomes_service_all
      ON public.decision_outcomes
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.decision_memory IS
  'Auditable investment/economic decisions with expected outcomes and confidence.';
COMMENT ON TABLE public.decision_outcomes IS
  'Observed outcomes linked to decisions for variance analysis and future calibration.';
