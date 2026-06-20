-- AI Review Requests Table
-- Allows clients to request human expert review of AI-generated analyses.

CREATE TABLE IF NOT EXISTS ai_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_review_requests_user_idx ON ai_review_requests(user_id);
CREATE INDEX IF NOT EXISTS ai_review_requests_status_idx ON ai_review_requests(status);

ALTER TABLE ai_review_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_review_requests_user_select ON ai_review_requests;
DROP POLICY IF EXISTS ai_review_requests_user_insert ON ai_review_requests;

CREATE POLICY ai_review_requests_user_select ON ai_review_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY ai_review_requests_user_insert ON ai_review_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
