-- Bonds Global — user taxonomy proposals
-- Keeps user suggestions outside canonical taxonomy until reviewed.

CREATE TABLE IF NOT EXISTS public.taxonomy_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text REFERENCES public.country_profiles(country_code) ON DELETE SET NULL,
  proposal_type text NOT NULL CHECK (proposal_type IN ('sector','activity')),
  proposed_name_ar text NOT NULL CHECK (char_length(btrim(proposed_name_ar)) BETWEEN 2 AND 160),
  proposed_name_en text CHECK (proposed_name_en IS NULL OR char_length(btrim(proposed_name_en)) <= 160),
  parent_sector_code text,
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','mapped','rejected')),
  canonical_target_code text,
  review_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_proposals_user_created
  ON public.taxonomy_proposals(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_taxonomy_proposals_review
  ON public.taxonomy_proposals(status, proposal_type, country_code, created_at DESC);

ALTER TABLE public.taxonomy_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own taxonomy proposals" ON public.taxonomy_proposals;
CREATE POLICY "Users insert own taxonomy proposals"
  ON public.taxonomy_proposals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Users read own taxonomy proposals" ON public.taxonomy_proposals;
CREATE POLICY "Users read own taxonomy proposals"
  ON public.taxonomy_proposals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.taxonomy_proposals TO authenticated;

COMMENT ON TABLE public.taxonomy_proposals IS
  'User-submitted sector/activity suggestions pending review; never treated as canonical taxonomy until mapped or approved.';
