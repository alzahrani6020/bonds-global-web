-- Observability, incidents, recovery, integration and configuration metadata.

CREATE TABLE IF NOT EXISTS public.admin_request_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL UNIQUE,
  endpoint text NOT NULL,
  method text,
  status_code integer,
  duration_ms integer,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text,
  source text NOT NULL,
  message text NOT NULL,
  stack text,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('warning','error','critical')),
  request_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','ignored')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.admin_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled','stalled')),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved')),
  impact text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  root_cause text,
  resolution text,
  postmortem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  note text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.runbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  service text,
  symptoms text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  rollback_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.backup_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  backup_reference text,
  backup_created_at timestamptz,
  verification_status text NOT NULL DEFAULT 'unknown' CHECK (verification_status IN ('unknown','verified','failed')),
  restore_tested boolean NOT NULL DEFAULT false,
  restore_tested_at timestamptz,
  rpo_minutes integer,
  rto_minutes integer,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recovery_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','passed','failed')),
  started_at timestamptz,
  finished_at timestamptz,
  measured_rpo_minutes integer,
  measured_rto_minutes integer,
  findings text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_health (
  integration_key text PRIMARY KEY,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy','degraded','down','unknown')),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  latency_ms integer,
  error_code text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  event_type text,
  external_id text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processing','succeeded','failed','dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0,
  request_id text,
  payload_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.api_key_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuration_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  config_key text NOT NULL,
  value_hash text,
  present boolean NOT NULL DEFAULT false,
  source text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, config_key, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_trace_created ON public.admin_request_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_status ON public.admin_error_events(status, severity, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_key ON public.admin_job_runs(job_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status, severity, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON public.webhook_events(status, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_request_traces','admin_error_events','admin_job_runs','incidents','incident_events',
    'runbooks','backup_verifications','recovery_drills','integration_health','webhook_events',
    'api_key_metadata','configuration_snapshots'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY admin_platform_read ON public.%I FOR SELECT TO authenticated USING (public.is_admin_platform_user())', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;
