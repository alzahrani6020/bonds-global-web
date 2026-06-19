-- Enterprise Monitoring, Logging & Error Tracking

CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('debug','info','warning','error','critical')),
  component text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  url text,
  user_agent text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  message text NOT NULL,
  stack text,
  metadata jsonb NOT NULL DEFAULT '{}',
  url text,
  user_agent text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON public.system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_component ON public.error_logs(component);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_logs_admin ON public.system_logs FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());
CREATE POLICY error_logs_admin ON public.error_logs FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Helper: log from SQL
CREATE OR REPLACE FUNCTION public.log_system(p_level text, p_component text, p_message text, p_metadata jsonb DEFAULT '{}')
RETURNS void AS $$
BEGIN
  INSERT INTO public.system_logs (level, component, message, metadata)
  VALUES (p_level, p_component, p_message, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: partition high-volume tables by month ( declarative partitioning for new tables)
-- Note: migrating existing page_views/usage_logs to partitioned tables is a future manual task.
