-- Phase D.1 — Investment Intelligence Suite: Core Tables
-- Stores investment memoranda, readiness scores, AI reviews, and versions.
-- All financial data is referenced from bonds_projects/bonds_valuations/bonds_financing;
-- these tables only hold BIIS-specific metadata and generated content.

CREATE TABLE IF NOT EXISTS public.investment_memoranda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'investment_memorandum' CHECK (type IN ('investment_memorandum', 'teaser', 'one_pager', 'cim')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'archived')),
  language TEXT NOT NULL DEFAULT 'ar',
  currency TEXT NOT NULL DEFAULT 'SAR',
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  evidence_bundle JSONB NOT NULL DEFAULT '[]',
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ai_review_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.investment_memoranda IS 'Generated investment memoranda and related investor-facing documents.';

CREATE INDEX IF NOT EXISTS idx_investment_memoranda_project_id ON public.investment_memoranda(project_id);
CREATE INDEX IF NOT EXISTS idx_investment_memoranda_user_id ON public.investment_memoranda(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_memoranda_type ON public.investment_memoranda(type);
CREATE INDEX IF NOT EXISTS idx_investment_memoranda_status ON public.investment_memoranda(status);

DROP TRIGGER IF EXISTS investment_memoranda_updated_at ON public.investment_memoranda;
CREATE TRIGGER investment_memoranda_updated_at
  BEFORE UPDATE ON public.investment_memoranda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.investment_memoranda_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memorandum_id UUID NOT NULL REFERENCES public.investment_memoranda(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  evidence_bundle JSONB NOT NULL DEFAULT '[]',
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (memorandum_id, version_number)
);

COMMENT ON TABLE public.investment_memoranda_versions IS 'Audit history of investment memoranda content changes.';

CREATE INDEX IF NOT EXISTS idx_investment_memoranda_versions_memorandum_id ON public.investment_memoranda_versions(memorandum_id);
CREATE INDEX IF NOT EXISTS idx_investment_memoranda_versions_number ON public.investment_memoranda_versions(version_number);

CREATE TABLE IF NOT EXISTS public.investment_readiness_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  grade TEXT,
  strengths JSONB NOT NULL DEFAULT '[]',
  weaknesses JSONB NOT NULL DEFAULT '[]',
  missing_items JSONB NOT NULL DEFAULT '[]',
  action_plan JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.investment_readiness_scores IS 'Investment readiness analysis per project.';

CREATE INDEX IF NOT EXISTS idx_investment_readiness_project_id ON public.investment_readiness_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_investment_readiness_user_id ON public.investment_readiness_scores(user_id);

CREATE TABLE IF NOT EXISTS public.ai_investment_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memorandum_id UUID NOT NULL REFERENCES public.investment_memoranda(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.bonds_projects(id) ON DELETE CASCADE,
  reviewer_type TEXT NOT NULL DEFAULT 'ai',
  verdict TEXT NOT NULL DEFAULT 'needs_revision' CHECK (verdict IN ('approved', 'needs_revision', 'rejected')),
  convincing BOOLEAN,
  has_conflicts BOOLEAN DEFAULT false,
  has_gaps BOOLEAN DEFAULT false,
  has_exaggeration BOOLEAN DEFAULT false,
  numbers_reasonable BOOLEAN DEFAULT true,
  risks_mentioned BOOLEAN DEFAULT false,
  language_appropriate BOOLEAN DEFAULT true,
  issues JSONB NOT NULL DEFAULT '[]',
  suggestions JSONB NOT NULL DEFAULT '[]',
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_investment_reviews IS 'AI-generated reviews of investment memoranda before approval.';

CREATE INDEX IF NOT EXISTS idx_ai_investment_reviews_memorandum_id ON public.ai_investment_reviews(memorandum_id);
CREATE INDEX IF NOT EXISTS idx_ai_investment_reviews_project_id ON public.ai_investment_reviews(project_id);

-- Row Level Security
ALTER TABLE public.investment_memoranda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_memoranda_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_readiness_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_investment_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investment_memoranda_own ON public.investment_memoranda;
CREATE POLICY investment_memoranda_own ON public.investment_memoranda
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS investment_memoranda_versions_own ON public.investment_memoranda_versions;
CREATE POLICY investment_memoranda_versions_own ON public.investment_memoranda_versions
  USING (EXISTS (
    SELECT 1 FROM public.investment_memoranda m
    WHERE m.id = investment_memoranda_versions.memorandum_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS investment_readiness_scores_own ON public.investment_readiness_scores;
CREATE POLICY investment_readiness_scores_own ON public.investment_readiness_scores
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_investment_reviews_own ON public.ai_investment_reviews;
CREATE POLICY ai_investment_reviews_own ON public.ai_investment_reviews
  USING (EXISTS (
    SELECT 1 FROM public.investment_memoranda m
    WHERE m.id = ai_investment_reviews.memorandum_id AND m.user_id = auth.uid()
  ));
