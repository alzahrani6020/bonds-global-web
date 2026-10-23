-- Financial data/decision layer completion.
-- Extends the existing Phase-1 financial_datasets envelope; no parallel architecture.

ALTER TABLE public.financial_datasets
  ADD COLUMN IF NOT EXISTS client_id uuid NULL,
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dataset_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_dataset_id uuid NULL REFERENCES public.financial_datasets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_of_id uuid NULL REFERENCES public.financial_datasets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS input_hash text NULL,
  ADD COLUMN IF NOT EXISTS input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS derived_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dependency_graph jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_pack jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decision_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stale_reason text NULL,
  ADD COLUMN IF NOT EXISTS parser_version text NOT NULL DEFAULT 'document-parser-core-v1',
  ADD COLUMN IF NOT EXISTS mapping_version text NOT NULL DEFAULT 'financial-field-dictionary-v1',
  ADD COLUMN IF NOT EXISTS engine_version text NULL,
  ADD COLUMN IF NOT EXISTS analysis_version text NOT NULL DEFAULT 'financial-dataset-v2',
  ADD COLUMN IF NOT EXISTS retention_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_executed_at timestamptz NULL;

DO $$ BEGIN
  ALTER TABLE public.financial_datasets
    ADD CONSTRAINT financial_datasets_document_type_check
    CHECK (document_type IN (
      'balance_sheet','income_statement','cash_flow','trial_balance',
      'bank_statement','feasibility_study','financial_report','audit_report','unknown'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.financial_datasets
    ADD CONSTRAINT financial_datasets_quality_status_check
    CHECK (quality_status IN ('complete','partial','conflicting','unverified','verified'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.financial_datasets
    ADD CONSTRAINT financial_datasets_approval_status_check
    CHECK (approval_status IN ('draft','reviewed','approved'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.financial_datasets
    ADD CONSTRAINT financial_datasets_dataset_version_check CHECK (dataset_version > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_financial_datasets_user_hash
  ON public.financial_datasets(user_id, input_hash)
  WHERE input_hash IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_datasets_parent_version
  ON public.financial_datasets(parent_dataset_id, dataset_version DESC)
  WHERE parent_dataset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_datasets_user_project_active
  ON public.financial_datasets(user_id, project_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_datasets_stale
  ON public.financial_datasets(user_id, is_stale, updated_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.financial_datasets.input_hash IS
  'SHA-256 of normalized reviewed/extracted dataset inputs for duplicate detection.';
COMMENT ON COLUMN public.financial_datasets.input_snapshot IS
  'Immutable execution input snapshot captured from the approved dataset.';
COMMENT ON COLUMN public.financial_datasets.execution_history IS
  'Append-only execution snapshots; previous entries are retained and may be marked stale.';
COMMENT ON COLUMN public.financial_datasets.evidence_pack IS
  'Bounded evidence bundle linking provenance, validation, versions and execution context.';
COMMENT ON COLUMN public.financial_datasets.decision_record IS
  'Latest governed decision/result record derived from deterministic execution.';
