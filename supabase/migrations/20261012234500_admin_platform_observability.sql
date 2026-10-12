-- Platform observability, incidents, recovery and configuration governance.

CREATE TABLE IF NOT EXISTS public.admin_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text,
  source text NOT NULL DEFAULT 'api',
  route text,
  error_code text,
  message text NOT NULL,
  stack_hash text,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('warning','error','fatal')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deployment_sha text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrence_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','ignored')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_error_events_status ON public.admin_error_events(status,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_error_events_request ON public.admin_error_events(request_id);

CREATE TABLE IF NOT EXISTS public.admin_request_metrics (
  id bigserial PRIMARY KEY,
  request_id text NOT NULL,
  route text NOT NULL,
  method text NOT NULL,
  status integer,
  duration_ms integer,
  memory_heap_used_mb numeric(12,2),
  memory_rss_mb numeric(12,2),
  deployment_sha text,
  user_id_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_request_metrics_created ON public.admin_request_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_request_metrics_route ON public.admin_request_metrics(route,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_request_metrics_request ON public.admin_request_metrics(request_id);

CREATE TABLE IF NOT EXISTS public.admin_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  run_key text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled','stalled')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  progress numeric(5,2),
  request_id text,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_job_runs_name ON public.admin_job_runs(job_name,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_job_runs_status ON public.admin_job_runs(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','monitoring','resolved')),
  impact text,
  root_cause text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  request_id text,
  deployment_sha text,
  timeline jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_incidents_status ON public.admin_incidents(status,severity,started_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_runbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  service text,
  trigger_condition text,
  steps jsonb NOT NULL DEFAULT '[]',
  rollback_steps jsonb NOT NULL DEFAULT '[]',
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_postmortems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.admin_incidents(id) ON DELETE SET NULL,
  summary text NOT NULL,
  root_cause text,
  contributing_factors jsonb NOT NULL DEFAULT '[]',
  corrective_actions jsonb NOT NULL DEFAULT '[]',
  prevention_actions jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_backup_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  resource text NOT NULL,
  backup_reference text,
  status text NOT NULL CHECK (status IN ('verified','failed','unknown')),
  backup_created_at timestamptz,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restore_tested boolean NOT NULL DEFAULT false,
  restore_tested_at timestamptz,
  rpo_minutes integer,
  evidence jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_admin_backup_checks_resource ON public.admin_backup_checks(resource,verified_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_recovery_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  environment text NOT NULL DEFAULT 'staging',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','passed','failed','cancelled')),
  rpo_target_minutes integer,
  rto_target_minutes integer,
  rpo_actual_minutes integer,
  rto_actual_minutes integer,
  started_at timestamptz,
  completed_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}',
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_config_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  config_key text NOT NULL,
  value_hash text,
  present boolean NOT NULL DEFAULT false,
  source text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(environment,config_key,captured_at)
);
CREATE INDEX IF NOT EXISTS idx_admin_config_snapshots_env ON public.admin_config_snapshots(environment,captured_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_migration_status (
  migration_name text PRIMARY KEY,
  checksum text,
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('pending','applied','failed','unknown')),
  applied_at timestamptz,
  verified_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.admin_integration_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy','degraded','down','unknown')),
  latency_ms integer,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  error_code text,
  details jsonb NOT NULL DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_integration_health_name ON public.admin_integration_health(integration,checked_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text,
  delivery_id text,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','delivered','failed','retrying','ignored')),
  http_status integer,
  attempts integer NOT NULL DEFAULT 1,
  request_id text,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE(provider,delivery_id)
);

CREATE TABLE IF NOT EXISTS public.admin_api_key_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  key_label text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expiring','revoked','missing','unknown')),
  last_rotated_at timestamptz,
  expires_at timestamptz,
  fingerprint text,
  notes text,
  UNIQUE(provider,key_label,environment)
);

CREATE TABLE IF NOT EXISTS public.admin_release_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'vercel',
  environment text NOT NULL DEFAULT 'production',
  deployment_id text,
  deployment_url text,
  commit_sha text,
  branch text,
  status text NOT NULL DEFAULT 'unknown',
  promoted_at timestamptz,
  rollback_of uuid REFERENCES public.admin_release_history(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_release_history_env ON public.admin_release_history(environment,created_at DESC);

ALTER TABLE public.admin_error_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_request_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_runbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_postmortems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_backup_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_recovery_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_migration_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_integration_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_api_key_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_release_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_error_events, public.admin_request_metrics, public.admin_job_runs, public.admin_incidents, public.admin_runbooks, public.admin_postmortems, public.admin_backup_checks, public.admin_recovery_drills, public.admin_config_snapshots, public.admin_migration_status, public.admin_integration_health, public.admin_webhook_deliveries, public.admin_api_key_metadata, public.admin_release_history FROM anon, authenticated;

INSERT INTO public.admin_permissions(permission,description,risk_level) VALUES
('observability.read','Read platform observability','normal'),
('incident.manage','Manage incidents and runbooks','high'),
('recovery.read','Read backup and recovery evidence','high'),
('recovery.manage','Manage recovery drills','critical'),
('configuration.read','Read configuration posture','high'),
('configuration.manage','Manage configuration metadata','critical')
ON CONFLICT(permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role,permission)
SELECT role,permission FROM (VALUES
('super_admin','observability.read'),('super_admin','incident.manage'),('super_admin','recovery.read'),('super_admin','recovery.manage'),('super_admin','configuration.read'),('super_admin','configuration.manage'),
('admin','observability.read'),('admin','incident.manage'),('admin','recovery.read'),('admin','configuration.read'),
('support','observability.read')
) AS x(role,permission) ON CONFLICT(role,permission) DO NOTHING;
