-- Project Context Layer — valuation bridge.
-- The valuation UI writes asset_valuations, while project lifecycle, Investment Intelligence,
-- Digital Twin and ECC read bonds_valuations by project_id. A valuation saved with a
-- project_id is mirrored into bonds_valuations after verifying project ownership.
-- Additive and idempotent: no existing column, row or policy is changed.

ALTER TABLE public.asset_valuations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.bonds_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asset_valuations_project_id
  ON public.asset_valuations(project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.asset_valuations.project_id IS
  'Optional bonds_projects link; mirrored into bonds_valuations for project lifecycle gates.';

CREATE OR REPLACE FUNCTION public.bonds_sync_asset_valuation_to_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text := 'AV-' || NEW.id::text;
  v_value numeric := 0;
  v_method text;
BEGIN
  IF NEW.project_id IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.project_id IS NOT NULL THEN
      DELETE FROM public.bonds_valuations WHERE valuation_number = v_number;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bonds_projects p
    WHERE p.id = NEW.project_id AND p.user_id = NEW.user_id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PROJECT_NOT_OWNED' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(NEW.results -> 'fair_value') = 'number' THEN
    v_value := (NEW.results ->> 'fair_value')::numeric;
  ELSIF jsonb_typeof(NEW.results -> 'market_value') = 'number' THEN
    v_value := (NEW.results ->> 'market_value')::numeric;
  END IF;
  v_method := COALESCE(NULLIF(NEW.results ->> 'method', ''), 'bvs_' || NEW.asset_class);

  INSERT INTO public.bonds_valuations (
    valuation_number, project_id, method, value, data_quality_score, confidence_score,
    valuation_date, status, metadata
  ) VALUES (
    v_number, NEW.project_id, v_method, v_value, NEW.data_quality_score, NEW.confidence_score,
    NEW.valuation_date, NEW.status,
    jsonb_build_object(
      'source', 'asset_valuations',
      'asset_valuation_id', NEW.id,
      'asset_class', NEW.asset_class,
      'asset_name', NEW.asset_name
    )
  )
  ON CONFLICT (valuation_number) DO UPDATE SET
    project_id = EXCLUDED.project_id,
    method = EXCLUDED.method,
    value = EXCLUDED.value,
    data_quality_score = EXCLUDED.data_quality_score,
    confidence_score = EXCLUDED.confidence_score,
    valuation_date = EXCLUDED.valuation_date,
    status = EXCLUDED.status,
    metadata = public.bonds_valuations.metadata || EXCLUDED.metadata;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bonds_sync_asset_valuation_to_project() FROM PUBLIC;

DROP TRIGGER IF EXISTS asset_valuations_project_bridge ON public.asset_valuations;
CREATE TRIGGER asset_valuations_project_bridge
  AFTER INSERT OR UPDATE OF project_id, results, confidence_score, data_quality_score, status, valuation_date
  ON public.asset_valuations
  FOR EACH ROW EXECUTE FUNCTION public.bonds_sync_asset_valuation_to_project();
