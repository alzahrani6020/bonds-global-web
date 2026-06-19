-- Enterprise Performance Indexes & Cleanup

-- Remove duplicate indexes
DROP INDEX IF EXISTS public.idx_subscriptions_stripe_sub;
DROP INDEX IF EXISTS public.idx_subscriptions_stripe_subscription_id;

-- Add missing reporting indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_start ON public.subscriptions(current_period_start);
CREATE INDEX IF NOT EXISTS idx_moyasar_invoices_paid_at ON public.moyasar_invoices(paid_at);
CREATE INDEX IF NOT EXISTS idx_advisory_projects_created_at ON public.advisory_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_assets_created_at ON public.recovery_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_requests_created_at ON public.bank_transfer_requests(created_at DESC);

-- Composite indexes for common admin filters
CREATE INDEX IF NOT EXISTS idx_advisory_projects_status_created ON public.advisory_projects(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisory_clients_status_created ON public.advisory_clients(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_assets_status_created ON public.recovery_assets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_advisor_reports_status_created ON public.ai_advisor_reports(created_by, created_at DESC);

-- Lower-case email indexes for duplicate detection
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_advisory_clients_email_lower ON public.advisory_clients(lower(email));
