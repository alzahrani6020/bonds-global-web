-- Seed super_admin role for the owner account
-- This ensures the owner can access the admin dashboard even if ADMIN_EMAIL env var is not set.
INSERT INTO public.admin_roles (user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE email = 'hmd.dev@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
