-- ============================================
-- Temporary access grants
-- منح وصول/استخدام مؤقت بدون اشتراك
-- ============================================

-- Allow usage exceptions to expire automatically
ALTER TABLE public.usage_exceptions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.usage_exceptions.expires_at IS 'تاريخ انتهاء الاستثناء (اختياري)';

-- Allow profiles tier to expire automatically (e.g., temporary Pro/Enterprise grant)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.tier_expires_at IS 'تاريخ انتهاء الباقة الممنوحة يدوياً (اختياري)';
