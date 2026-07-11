-- Admin audit log: tracks all administrative actions performed in the dashboard.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email text,
    actor_role text,
    action text NOT NULL,
    target_type text,
    target_id text,
    target_email text,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address text
);

COMMENT ON TABLE public.admin_audit_log IS 'Immutable log of admin actions for compliance and security review.';

-- Index for fast chronological queries by actor or target.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_id ON public.admin_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_id ON public.admin_audit_log (target_id);

-- Admins can read logs; only authenticated users can insert (handled by API).
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_select ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select
    ON public.admin_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_roles r
            WHERE r.user_id = auth.uid()
              AND r.role IN ('super_admin', 'admin', 'support')
        )
        OR auth.email() = current_setting('app.owner_email', true)
    );
