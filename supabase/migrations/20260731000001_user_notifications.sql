-- User notifications: messages sent from admins to users.
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    subject text NOT NULL,
    body text NOT NULL,
    read boolean DEFAULT false,
    email_sent boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_notifications IS 'Notifications/messages sent by admins to users. Readable only by the recipient.';

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON public.user_notifications (user_id, read DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON public.user_notifications (created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications.
DROP POLICY IF EXISTS user_notifications_select_own ON public.user_notifications;
CREATE POLICY user_notifications_select_own
    ON public.user_notifications
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can mark their own notifications as read.
DROP POLICY IF EXISTS user_notifications_update_own ON public.user_notifications;
CREATE POLICY user_notifications_update_own
    ON public.user_notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role / admins insert via API; no direct insert from authenticated users needed.
