-- Pay-per-report one-off purchases
CREATE TABLE IF NOT EXISTS public.oneoff_purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product text NOT NULL CHECK (product IN ('ai_report', 'expert_review', 'approved_report')),
  quantity integer NOT NULL DEFAULT 1,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_oneoff_purchases_user_id ON public.oneoff_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_oneoff_purchases_status ON public.oneoff_purchases(status);

-- Track consumable credits on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS oneoff_credits jsonb DEFAULT '{"ai_report": 0, "expert_review": 0, "approved_report": 0}';

ALTER TABLE public.oneoff_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own oneoff purchases"
  ON public.oneoff_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
