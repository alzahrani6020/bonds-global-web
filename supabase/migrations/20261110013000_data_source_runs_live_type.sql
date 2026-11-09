-- Allow live official-source fetches as a first-class run type.
-- Idempotent: drop/re-add the check so existing DBs that still lack 'live' can apply it.

ALTER TABLE public.data_source_runs
  DROP CONSTRAINT IF EXISTS data_source_runs_run_type_check;

ALTER TABLE public.data_source_runs
  ADD CONSTRAINT data_source_runs_run_type_check
  CHECK (run_type IN ('full', 'incremental', 'manual', 'live'));
