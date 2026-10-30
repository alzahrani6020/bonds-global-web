-- Persistent aggregate history for Bonds Native runtime reliability.
-- Operational telemetry only: no prompts, customer content, model outputs, or raw node URLs.
-- Service-role only. Node endpoints are stored only as SHA-256 hashes.

CREATE TABLE IF NOT EXISTS public.ai_native_reliability_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL CHECK (
    event_type IN (
      'snapshot',
      'retry',
      'failover',
      'breaker_open',
      'breaker_closed',
      'slo_degraded',
      'slo_recovered'
    )
  ),
  node_id text NOT NULL,
  node_endpoint_hash text,
  operation text NOT NULL DEFAULT 'generate',
  status text NOT NULL CHECK (
    status IN ('insufficient_data', 'healthy', 'degraded')
  ),
  requests bigint NOT NULL DEFAULT 0 CHECK (requests >= 0),
  successes bigint NOT NULL DEFAULT 0 CHECK (successes >= 0),
  failures bigint NOT NULL DEFAULT 0 CHECK (failures >= 0),
  failure_rate double precision NOT NULL DEFAULT 0 CHECK (
    failure_rate >= 0 AND failure_rate <= 1
  ),
  recoverable_failures bigint NOT NULL DEFAULT 0 CHECK (recoverable_failures >= 0),
  retries bigint NOT NULL DEFAULT 0 CHECK (retries >= 0),
  failovers bigint NOT NULL DEFAULT 0 CHECK (failovers >= 0),
  average_latency_ms double precision NOT NULL DEFAULT 0 CHECK (average_latency_ms >= 0),
  max_latency_ms double precision NOT NULL DEFAULT 0 CHECK (max_latency_ms >= 0),
  last_failure_code text,
  last_failure_category text,
  breaker_open boolean NOT NULL DEFAULT false,
  breaker_failures bigint NOT NULL DEFAULT 0 CHECK (breaker_failures >= 0),
  lifecycle_generation bigint,
  champion_model_id text,
  challenger_model_id text,
  canary_percentage double precision CHECK (
    canary_percentage IS NULL OR
    (canary_percentage >= 0 AND canary_percentage <= 100)
  ),
  incident_id uuid REFERENCES public.admin_incidents(id) ON DELETE SET NULL,
  deployment_sha text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_native_reliability_history_observed_at_idx
  ON public.ai_native_reliability_history (observed_at DESC);

CREATE INDEX IF NOT EXISTS ai_native_reliability_history_node_observed_idx
  ON public.ai_native_reliability_history (node_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS ai_native_reliability_history_incident_idx
  ON public.ai_native_reliability_history (incident_id)
  WHERE incident_id IS NOT NULL;

ALTER TABLE public.ai_native_reliability_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_native_reliability_history
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.ai_native_reliability_history
  TO service_role;

DROP POLICY IF EXISTS "service_role_manage_ai_native_reliability_history"
  ON public.ai_native_reliability_history;

CREATE POLICY "service_role_manage_ai_native_reliability_history"
  ON public.ai_native_reliability_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ai_native_reliability_history IS
  'Aggregate Bonds Native reliability history. Service-role only; contains no prompts, customer content, model outputs, or raw node URLs.';

COMMENT ON COLUMN public.ai_native_reliability_history.node_endpoint_hash IS
  'SHA-256 hash of the configured node endpoint; the raw endpoint is intentionally not persisted.';

COMMENT ON COLUMN public.ai_native_reliability_history.incident_id IS
  'Optional correlation to an unresolved admin incident for the same deployment SHA.';
