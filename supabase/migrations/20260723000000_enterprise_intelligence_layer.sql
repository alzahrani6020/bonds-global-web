-- Wave 4.3 — Enterprise Intelligence Layer
-- Stores intelligence runs, decision graphs, and synthesized recommendations.

-- Main audit trail for every enterprise intelligence run.
CREATE TABLE IF NOT EXISTS enterprise_intelligence_runs (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID,
  user_id UUID,
  project_id UUID,
  intent TEXT,
  sector TEXT,
  country TEXT,
  city TEXT,
  inputs JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eir_user_id ON enterprise_intelligence_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_eir_project_id ON enterprise_intelligence_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_eir_intent ON enterprise_intelligence_runs(intent);
CREATE INDEX IF NOT EXISTS idx_eir_created_at ON enterprise_intelligence_runs(created_at DESC);

-- Optional persisted decision graph snapshots for explainability/audit.
CREATE TABLE IF NOT EXISTS enterprise_intelligence_graphs (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT REFERENCES enterprise_intelligence_runs(id) ON DELETE CASCADE,
  graph JSONB NOT NULL DEFAULT '{}',
  critical_path JSONB NOT NULL DEFAULT '[]',
  bottleneck JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eig_run_id ON enterprise_intelligence_graphs(run_id);

-- Optional persisted synthesized recommendation actions.
CREATE TABLE IF NOT EXISTS enterprise_intelligence_recommendations (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT REFERENCES enterprise_intelligence_runs(id) ON DELETE CASCADE,
  actions JSONB NOT NULL DEFAULT '[]',
  top_action JSONB,
  confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eir_rec_run_id ON enterprise_intelligence_recommendations(run_id);

-- Row Level Security (RLS) policies for enterprise data isolation.
ALTER TABLE enterprise_intelligence_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_intelligence_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_intelligence_recommendations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'enterprise_intelligence_runs'
      AND policyname = 'enterprise_intelligence_runs_owner_policy'
  ) THEN
    CREATE POLICY enterprise_intelligence_runs_owner_policy
      ON enterprise_intelligence_runs
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'enterprise_intelligence_graphs'
      AND policyname = 'enterprise_intelligence_graphs_owner_policy'
  ) THEN
    CREATE POLICY enterprise_intelligence_graphs_owner_policy
      ON enterprise_intelligence_graphs
      USING (EXISTS (
        SELECT 1 FROM enterprise_intelligence_runs r
        WHERE r.id = enterprise_intelligence_graphs.run_id AND r.user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'enterprise_intelligence_recommendations'
      AND policyname = 'enterprise_intelligence_recommendations_owner_policy'
  ) THEN
    CREATE POLICY enterprise_intelligence_recommendations_owner_policy
      ON enterprise_intelligence_recommendations
      USING (EXISTS (
        SELECT 1 FROM enterprise_intelligence_runs r
        WHERE r.id = enterprise_intelligence_recommendations.run_id AND r.user_id = auth.uid()
      ));
  END IF;
END $$;
