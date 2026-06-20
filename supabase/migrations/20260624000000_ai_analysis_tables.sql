-- Bonds AI Analysis Tables
-- Stores AI analysis requests, results, and cache.

-- AI analysis requests
CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES advisory_projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit_assessment', 'feasibility_study', 'distressed_project', 'city_analysis')),
  input_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'error', 'pending_review', 'approved', 'rejected')),
  model TEXT NOT NULL DEFAULT 'gpt-5.4',
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure same input hash is unique per user to avoid duplicate AI calls
CREATE UNIQUE INDEX IF NOT EXISTS ai_requests_user_hash_idx ON ai_requests(user_id, input_hash);
CREATE INDEX IF NOT EXISTS ai_requests_user_created_idx ON ai_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_requests_project_idx ON ai_requests(project_id);

-- AI analysis results (kept separate for review workflow)
CREATE TABLE IF NOT EXISTS ai_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
  result JSONB NOT NULL DEFAULT '{}',
  risk_score INT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_results_request_idx ON ai_results(request_id);

-- Simple cache table (alternative to Redis on free tier)
CREATE TABLE IF NOT EXISTS ai_cache (
  input_hash TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_cache_expires_idx ON ai_cache(expires_at);

-- Row Level Security: users can only see their own requests/results.
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS ai_requests_user_select ON ai_requests;
DROP POLICY IF EXISTS ai_requests_user_insert ON ai_requests;
DROP POLICY IF EXISTS ai_results_user_select ON ai_results;
DROP POLICY IF EXISTS ai_results_user_insert ON ai_results;

-- Allow users to read their own requests
CREATE POLICY ai_requests_user_select ON ai_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own requests
CREATE POLICY ai_requests_user_insert ON ai_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to read results linked to their own requests
CREATE POLICY ai_results_user_select ON ai_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_requests WHERE ai_requests.id = ai_results.request_id AND ai_requests.user_id = auth.uid()
    )
  );

-- Allow users to insert results linked to their own requests
CREATE POLICY ai_results_user_insert ON ai_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_requests WHERE ai_requests.id = ai_results.request_id AND ai_requests.user_id = auth.uid()
    )
  );

-- Cache is managed server-side only; no direct user access
CREATE POLICY ai_cache_no_user_access ON ai_cache
  FOR ALL USING (false);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_requests_updated_at ON ai_requests;
CREATE TRIGGER ai_requests_updated_at
  BEFORE UPDATE ON ai_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
