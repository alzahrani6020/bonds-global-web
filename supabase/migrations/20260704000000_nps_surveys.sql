-- NPS surveys sent after report approval
CREATE TABLE IF NOT EXISTS public.nps_surveys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_id uuid REFERENCES public.ai_advisor_reports(id) ON DELETE CASCADE,
  score integer CHECK (score >= 0 AND score <= 10),
  feedback text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'expired')),
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nps_surveys_user_id ON public.nps_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_nps_surveys_status ON public.nps_surveys(status);
CREATE INDEX IF NOT EXISTS idx_nps_surveys_report_id ON public.nps_surveys(report_id);

ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nps surveys"
  ON public.nps_surveys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
