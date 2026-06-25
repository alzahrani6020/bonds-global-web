-- Investment analyses table for the Investment Calculators Center
CREATE TABLE IF NOT EXISTS investment_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '{}',
  recommendation JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_investment_analyses_user_id ON investment_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_analyses_sector ON investment_analyses(sector);

-- RLS policies
ALTER TABLE investment_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investment_analyses_select_own ON investment_analyses;
CREATE POLICY investment_analyses_select_own
  ON investment_analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS investment_analyses_insert_own ON investment_analyses;
CREATE POLICY investment_analyses_insert_own
  ON investment_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS investment_analyses_update_own ON investment_analyses;
CREATE POLICY investment_analyses_update_own
  ON investment_analyses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS investment_analyses_delete_own ON investment_analyses;
CREATE POLICY investment_analyses_delete_own
  ON investment_analyses FOR DELETE
  USING (auth.uid() = user_id);
