-- Letterhead cloud drafts
CREATE TABLE IF NOT EXISTS public.letterhead_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  html jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.letterhead_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own letterhead drafts"
  ON public.letterhead_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
