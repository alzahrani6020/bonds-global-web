-- Extend persistent AI lifecycle state with production champion health metrics.
-- Contains aggregate counters only; no prompts, customer content, or model outputs.

ALTER TABLE public.ai_model_lifecycle_state
  ADD COLUMN IF NOT EXISTS production_metrics jsonb NOT NULL DEFAULT
  '{"requests":0,"successes":0,"safe":0,"critical_failures":0,"errors":0,"tool_failures":0,"total_latency_ms":0,"max_latency_ms":0}'::jsonb;

COMMENT ON COLUMN public.ai_model_lifecycle_state.production_metrics IS
  'Aggregate runtime health counters for the active production champion; contains no prompts or model outputs.';
