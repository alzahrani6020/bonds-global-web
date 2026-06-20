-- AI Review Requests — expand for specialist review workflow v2
ALTER TABLE public.ai_review_requests
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Update status constraint to match the review pipeline
ALTER TABLE public.ai_review_requests
  DROP CONSTRAINT IF EXISTS ai_review_requests_status_check;

ALTER TABLE public.ai_review_requests
  ADD CONSTRAINT ai_review_requests_status_check
  CHECK (status IN ('pending_review', 'assigned', 'under_review', 'approved', 'returned'));

-- Default new rows and migrate legacy statuses
ALTER TABLE public.ai_review_requests
  ALTER COLUMN status SET DEFAULT 'pending_review';

UPDATE public.ai_review_requests
  SET status = 'pending_review'
  WHERE status NOT IN ('pending_review', 'assigned', 'under_review', 'approved', 'returned');

-- Indexes for workflow queries
CREATE INDEX IF NOT EXISTS ai_review_requests_request_idx ON ai_review_requests(request_id);
CREATE INDEX IF NOT EXISTS ai_review_requests_assigned_idx ON ai_review_requests(assigned_to);
