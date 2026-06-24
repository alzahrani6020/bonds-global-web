-- Track which payment provider activated a subscription
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'moyasar', 'bank_transfer', 'manual'));

COMMENT ON COLUMN public.subscriptions.payment_method IS 'Payment provider that activated the subscription: stripe, moyasar, bank_transfer, or manual.';
