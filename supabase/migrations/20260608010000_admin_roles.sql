-- ============================================
-- Admin Roles & Permissions
-- RBAC for admin dashboard
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'support', 'viewer')),
  granted_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.admin_roles IS 'Admin role assignments for dashboard RBAC';

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage admin roles directly
-- Frontend uses admin-verify API with service_role key

-- Permissions reference (not enforced at DB level, checked in API):
-- super_admin: all + manage_admins + settings
-- admin: users + messages + subscriptions + stats
-- support: users_read + messages_read + messages_write
-- viewer: users_read + messages_read (no write)
