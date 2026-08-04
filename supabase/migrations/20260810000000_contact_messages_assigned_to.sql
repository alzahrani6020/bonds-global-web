-- ============================================
-- Contact Messages: assignee support
-- Allows assigning an incoming message to an admin user.
-- ============================================

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contact_messages_assigned_to
  ON public.contact_messages(assigned_to);

CREATE INDEX IF NOT EXISTS idx_contact_messages_assigned_by
  ON public.contact_messages(assigned_by);

COMMENT ON COLUMN public.contact_messages.assigned_to IS 'Admin user currently responsible for this message';
COMMENT ON COLUMN public.contact_messages.assigned_by IS 'Admin user who made the assignment';
COMMENT ON COLUMN public.contact_messages.assigned_at IS 'When the assignment was last changed';
