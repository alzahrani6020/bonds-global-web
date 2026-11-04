-- Consolidate semantically duplicate canonical activities without deleting rows.
-- Retired codes remain resolvable via superseded_by + canonical_activity_code_aliases.
-- Legacy economic_activities rows and project_models foreign keys are not rewritten.

CREATE OR REPLACE FUNCTION public.bonds_canonical_activity_semantic_ar(name_ar text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    regexp_replace(
      translate(
        regexp_replace(
          regexp_replace(btrim(COALESCE(name_ar, '')), '^نشاط[[:space:]]+', '', 'i'),
          '^ال',
          ''
        ),
        'أإآٱةى',
        'ااااهي'
      ),
      '[[:space:][:punct:]ـ]+',
      '',
      'g'
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.bonds_canonical_activity_semantic_ar(text) IS
  'Arabic activity identity key: strip نشاط, leading ال, hamza/taa variants and punctuation.';

ALTER TABLE public.canonical_activities
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.canonical_activities(id);

CREATE INDEX IF NOT EXISTS idx_canonical_activities_superseded_by
  ON public.canonical_activities(superseded_by)
  WHERE superseded_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.canonical_activity_code_aliases (
  alias_code text PRIMARY KEY,
  canonical_activity_id uuid NOT NULL
    REFERENCES public.canonical_activities(id) ON DELETE CASCADE,
  source_activity_id uuid
    REFERENCES public.canonical_activities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canonical_activity_code_aliases_canonical
  ON public.canonical_activity_code_aliases(canonical_activity_id);

ALTER TABLE public.canonical_activity_code_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read canonical activity code aliases"
  ON public.canonical_activity_code_aliases;
CREATE POLICY "Public read canonical activity code aliases"
  ON public.canonical_activity_code_aliases
  FOR SELECT TO PUBLIC
  USING (true);

GRANT SELECT ON public.canonical_activity_code_aliases TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.merge_canonical_activity(duplicate_id uuid, survivor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  duplicate_code text;
  survivor_has_primary_sector boolean;
  survivor_has_primary_subsector boolean;
BEGIN
  IF duplicate_id IS NULL OR survivor_id IS NULL OR duplicate_id = survivor_id THEN
    RETURN;
  END IF;

  SELECT code INTO duplicate_code
  FROM public.canonical_activities
  WHERE id = duplicate_id;

  IF duplicate_code IS NULL THEN
    RETURN;
  END IF;

  survivor_has_primary_sector := false;
  survivor_has_primary_subsector := false;
  IF to_regclass('public.canonical_activity_investment_sectors') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.canonical_activity_investment_sectors
      WHERE canonical_activity_id = survivor_id AND is_primary
    ) INTO survivor_has_primary_sector;
  END IF;
  IF to_regclass('public.canonical_activity_investment_subsectors') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.canonical_activity_investment_subsectors
      WHERE canonical_activity_id = survivor_id AND is_primary
    ) INTO survivor_has_primary_subsector;
  END IF;

  UPDATE public.canonical_activity_legacy_aliases
  SET canonical_activity_id = survivor_id
  WHERE canonical_activity_id = duplicate_id;

  INSERT INTO public.canonical_activity_sub_sector_map (
    canonical_activity_id, sub_sector_id, source_legacy_activity_id, mapping_source, is_primary, is_active
  )
  SELECT survivor_id, sub_sector_id, source_legacy_activity_id, mapping_source, false, is_active
  FROM public.canonical_activity_sub_sector_map
  WHERE canonical_activity_id = duplicate_id
  ON CONFLICT (canonical_activity_id, sub_sector_id) DO UPDATE
  SET is_active = public.canonical_activity_sub_sector_map.is_active OR EXCLUDED.is_active;

  IF to_regclass('public.canonical_activity_investment_sectors') IS NOT NULL THEN
  INSERT INTO public.canonical_activity_investment_sectors (
    canonical_activity_id, sector_id, is_primary, source, confidence, metadata
  )
  SELECT
    survivor_id,
    sector_id,
    CASE
      WHEN survivor_has_primary_sector THEN false
      WHEN row_number() OVER (ORDER BY is_primary DESC, confidence DESC NULLS LAST, sector_id) = 1 THEN is_primary
      ELSE false
    END,
    source,
    confidence,
    metadata
  FROM public.canonical_activity_investment_sectors
  WHERE canonical_activity_id = duplicate_id
  ON CONFLICT (canonical_activity_id, sector_id) DO UPDATE
  SET confidence = GREATEST(
        COALESCE(public.canonical_activity_investment_sectors.confidence, 0),
        COALESCE(EXCLUDED.confidence, 0)
      );
  END IF;

  IF to_regclass('public.canonical_activity_investment_subsectors') IS NOT NULL THEN
  INSERT INTO public.canonical_activity_investment_subsectors (
    canonical_activity_id, subsector_id, is_primary, source, confidence, metadata
  )
  SELECT
    survivor_id,
    subsector_id,
    CASE
      WHEN survivor_has_primary_subsector THEN false
      WHEN row_number() OVER (ORDER BY is_primary DESC, confidence DESC NULLS LAST, subsector_id) = 1 THEN is_primary
      ELSE false
    END,
    source,
    confidence,
    metadata
  FROM public.canonical_activity_investment_subsectors
  WHERE canonical_activity_id = duplicate_id
  ON CONFLICT (canonical_activity_id, subsector_id) DO UPDATE
  SET confidence = GREATEST(
        COALESCE(public.canonical_activity_investment_subsectors.confidence, 0),
        COALESCE(EXCLUDED.confidence, 0)
      );
  END IF;

  IF to_regclass('public.canonical_activity_business_forms') IS NOT NULL THEN
  INSERT INTO public.canonical_activity_business_forms (
    canonical_activity_id, business_form_code, country_code,
    is_default, verification_status, source, source_url, confidence, metadata
  )
  SELECT
    survivor_id, business_form_code, country_code,
    is_default, verification_status, source, source_url, confidence, metadata
  FROM public.canonical_activity_business_forms
  WHERE canonical_activity_id = duplicate_id
  ON CONFLICT (canonical_activity_id, business_form_code, country_code) DO NOTHING;
  END IF;

  IF to_regclass('public.canonical_activity_country') IS NOT NULL THEN
  INSERT INTO public.canonical_activity_country (
    canonical_activity_id, country_code, availability_status, regulatory_status,
    classification_system, classification_code, classification_label,
    source, source_url, confidence, metadata
  )
  SELECT
    survivor_id, country_code, availability_status, regulatory_status,
    classification_system, classification_code, classification_label,
    source, source_url, confidence, metadata
  FROM public.canonical_activity_country
  WHERE canonical_activity_id = duplicate_id
  ON CONFLICT (canonical_activity_id, country_code) DO NOTHING;
  END IF;

  IF to_regclass('public.country_regulatory_requirements') IS NOT NULL THEN
    UPDATE public.country_regulatory_requirements
    SET canonical_activity_id = survivor_id
    WHERE canonical_activity_id = duplicate_id;
  END IF;

  IF to_regclass('public.service_activity_map') IS NOT NULL THEN
  INSERT INTO public.service_activity_map (service_id, canonical_activity_id, priority, metadata)
  SELECT service_id, survivor_id, priority, metadata
  FROM public.service_activity_map
  WHERE canonical_activity_id = duplicate_id
  ON CONFLICT (service_id, canonical_activity_id) DO NOTHING;
  END IF;

  IF to_regclass('public.service_procedures') IS NOT NULL THEN
    UPDATE public.service_procedures
    SET canonical_activity_id = survivor_id
    WHERE canonical_activity_id = duplicate_id;
  END IF;

  INSERT INTO public.canonical_activity_code_aliases (alias_code, canonical_activity_id, source_activity_id)
  VALUES (duplicate_code, survivor_id, duplicate_id)
  ON CONFLICT (alias_code) DO UPDATE
  SET canonical_activity_id = EXCLUDED.canonical_activity_id,
      source_activity_id = EXCLUDED.source_activity_id;

  UPDATE public.canonical_activities
  SET
    superseded_by = survivor_id,
    is_active = false,
    updated_at = now()
  WHERE id = duplicate_id
    AND (superseded_by IS DISTINCT FROM survivor_id OR is_active IS DISTINCT FROM false);

  UPDATE public.canonical_activities ca
  SET
    superseded_by = NULL,
    is_active = EXISTS (
      SELECT 1
      FROM public.canonical_activity_legacy_aliases ala
      JOIN public.economic_activities a ON a.id = ala.legacy_activity_id
      WHERE ala.canonical_activity_id = ca.id AND a.is_active = true
    ),
    updated_at = now()
  WHERE ca.id = survivor_id;
END;
$$;

COMMENT ON FUNCTION public.merge_canonical_activity(uuid, uuid) IS
  'Retarget aliases and copy mappings from a duplicate canonical activity onto a survivor. Does not delete rows.';

DO $$
DECLARE
  grp record;
  survivor uuid;
  duplicate uuid;
BEGIN
  FOR grp IN
    SELECT public.bonds_canonical_activity_semantic_ar(ca.normalized_name_ar) AS semantic_key
    FROM public.canonical_activities ca
    WHERE public.bonds_canonical_activity_semantic_ar(ca.normalized_name_ar) IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    SELECT ca.id
    INTO survivor
    FROM public.canonical_activities ca
    LEFT JOIN public.canonical_activity_legacy_aliases ala
      ON ala.canonical_activity_id = ca.id
    WHERE public.bonds_canonical_activity_semantic_ar(ca.normalized_name_ar) = grp.semantic_key
    GROUP BY ca.id, ca.code, ca.name_ar, ca.is_active, ca.superseded_by
    ORDER BY
      (ca.superseded_by IS NULL) DESC,
      ca.is_active DESC,
      (ca.code !~* '_[0-9a-f]{8}$') DESC,
      (ca.name_ar !~ '^ال') DESC,
      (ca.code !~* '(ies|es|s)$') DESC,
      count(ala.id) DESC,
      length(ca.code) ASC,
      ca.code ASC
    LIMIT 1;

    FOR duplicate IN
      SELECT ca.id
      FROM public.canonical_activities ca
      WHERE public.bonds_canonical_activity_semantic_ar(ca.normalized_name_ar) = grp.semantic_key
        AND ca.id <> survivor
    LOOP
      PERFORM public.merge_canonical_activity(duplicate, survivor);
    END LOOP;
  END LOOP;

  FOR grp IN
    SELECT shorter.id AS survivor_id, longer.id AS duplicate_id
    FROM public.canonical_activities longer
    JOIN public.canonical_activities shorter
      ON longer.id <> shorter.id
     AND (
       longer.code = shorter.code || 's'
       OR longer.code = shorter.code || 'es'
       OR (
         shorter.code ~ 'y$'
         AND longer.code = left(shorter.code, length(shorter.code) - 1) || 'ies'
       )
     )
    WHERE longer.superseded_by IS NULL
      AND shorter.superseded_by IS NULL
  LOOP
    PERFORM public.merge_canonical_activity(grp.duplicate_id, grp.survivor_id);
  END LOOP;
END;
$$;

UPDATE public.canonical_activities
SET
  name_ar = 'بيوت محمية للخضروات',
  normalized_name_ar = 'بيوت محمية للخضروات',
  updated_at = now()
WHERE code = 'vegetable_greenhouse'
  AND name_ar LIKE '%thouse%';

UPDATE public.economic_activities
SET
  name_ar = 'بيوت محمية للخضروات',
  updated_at = now()
WHERE code = 'vegetable_greenhouse'
  AND name_ar LIKE '%thouse%';

UPDATE public.project_models
SET
  name_ar = replace(name_ar, 'بيthouse خضروات', 'بيوت محمية للخضروات'),
  updated_at = now()
WHERE name_ar LIKE '%thouse%';

CREATE OR REPLACE VIEW public.canonical_activity_catalog AS
SELECT
  ca.id,
  ca.code,
  ca.name_ar,
  ca.name_en,
  ca.description,
  ca.is_active,
  ca.sort_order,
  COALESCE(
    array_cat(
      COALESCE(
        array_agg(DISTINCT ala.legacy_code) FILTER (WHERE ala.legacy_code IS NOT NULL),
        ARRAY[]::text[]
      ),
      COALESCE(
        array_agg(DISTINCT caa.alias_code) FILTER (WHERE caa.alias_code IS NOT NULL),
        ARRAY[]::text[]
      )
    ),
    ARRAY[]::text[]
  ) AS aliases,
  COALESCE(
    array_agg(DISTINCT es.code)
      FILTER (WHERE es.code IS NOT NULL),
    ARRAY[]::text[]
  ) AS sector_codes,
  COALESCE(
    array_agg(DISTINCT ess.code)
      FILTER (WHERE ess.code IS NOT NULL),
    ARRAY[]::text[]
  ) AS sub_sector_codes,
  count(DISTINCT ala.legacy_code)::integer AS legacy_count,
  count(DISTINCT m.sub_sector_id)::integer AS sub_sector_count,
  ca.superseded_by
FROM public.canonical_activities ca
LEFT JOIN public.canonical_activity_legacy_aliases ala
  ON ala.canonical_activity_id = ca.id
LEFT JOIN public.canonical_activity_code_aliases caa
  ON caa.canonical_activity_id = ca.id
LEFT JOIN public.canonical_activity_sub_sector_map m
  ON m.canonical_activity_id = ca.id
 AND m.is_active = true
LEFT JOIN public.economic_sub_sectors ess
  ON ess.id = m.sub_sector_id
LEFT JOIN public.economic_sectors es
  ON es.id = ess.sector_id
GROUP BY
  ca.id,
  ca.code,
  ca.name_ar,
  ca.name_en,
  ca.description,
  ca.is_active,
  ca.sort_order,
  ca.superseded_by;

ALTER VIEW public.canonical_activity_catalog SET (security_invoker = true);
GRANT SELECT ON public.canonical_activity_catalog TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_canonical_activity(input_code TEXT)
RETURNS TABLE (
  canonical_activity_id UUID,
  canonical_code TEXT,
  canonical_name_ar TEXT,
  aliases TEXT[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    survivor.id,
    survivor.code,
    survivor.name_ar,
    survivor_view.aliases
  FROM public.canonical_activity_catalog v
  JOIN public.canonical_activities c ON c.id = v.id
  JOIN public.canonical_activities survivor
    ON survivor.id = COALESCE(c.superseded_by, c.id)
  JOIN public.canonical_activity_catalog survivor_view
    ON survivor_view.id = survivor.id
  WHERE c.code = input_code
     OR input_code = ANY(v.aliases)
     OR survivor.code = input_code
  ORDER BY (c.superseded_by IS NULL AND c.is_active) DESC, survivor.is_active DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_canonical_activity(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_canonical_activity_from_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sync$
DECLARE
  normalized_ar TEXT;
  semantic_ar TEXT;
  normalized_en TEXT;
  base_code TEXT;
  candidate_code TEXT;
  canonical_id UUID;
  old_canonical_id UUID;
BEGIN
  normalized_ar := regexp_replace(
    regexp_replace(btrim(COALESCE(NEW.name_ar, '')), '^نشاط[[:space:]]+', '', 'i'),
    '^ال',
    ''
  );
  semantic_ar := public.bonds_canonical_activity_semantic_ar(NEW.name_ar);
  normalized_en := regexp_replace(btrim(COALESCE(NEW.name_en, '')), '[[:space:]]+Activity$', '', 'i');

  IF normalized_ar = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT canonical_activity_id INTO old_canonical_id
    FROM public.canonical_activity_legacy_aliases
    WHERE legacy_activity_id = NEW.id
    LIMIT 1;
  END IF;

  SELECT COALESCE(ca.superseded_by, ca.id)
    INTO canonical_id
  FROM public.canonical_activities ca
  WHERE ca.normalized_name_ar = normalized_ar
     OR public.bonds_canonical_activity_semantic_ar(ca.normalized_name_ar) = semantic_ar
  ORDER BY (ca.superseded_by IS NULL) DESC, ca.is_active DESC, length(ca.code) ASC
  LIMIT 1;

  IF canonical_id IS NULL THEN
    base_code := trim(BOTH '_' FROM regexp_replace(lower(normalized_en), '[^a-z0-9]+', '_', 'g'));
    IF base_code = '' THEN
      base_code := 'activity_' || substr(md5(normalized_ar), 1, 12);
    END IF;
    candidate_code := base_code;
    IF EXISTS (SELECT 1 FROM public.canonical_activities WHERE code = candidate_code AND normalized_name_ar <> normalized_ar) THEN
      candidate_code := base_code || '_' || substr(md5(normalized_ar), 1, 8);
    END IF;

    INSERT INTO public.canonical_activities (code, normalized_name_ar, name_ar, name_en, description, is_active, sort_order)
    VALUES (candidate_code, normalized_ar, normalized_ar, NULLIF(normalized_en, ''), NEW.description, NEW.is_active, NEW.sort_order)
    ON CONFLICT (normalized_name_ar) DO UPDATE
    SET name_en = COALESCE(EXCLUDED.name_en, public.canonical_activities.name_en),
        description = COALESCE(EXCLUDED.description, public.canonical_activities.description),
        is_active = EXCLUDED.is_active,
        sort_order = LEAST(public.canonical_activities.sort_order, EXCLUDED.sort_order),
        updated_at = NOW()
    RETURNING COALESCE(superseded_by, id) INTO canonical_id;
  END IF;

  INSERT INTO public.canonical_activity_legacy_aliases (canonical_activity_id, legacy_activity_id, legacy_code, legacy_name_ar, legacy_name_en)
  VALUES (canonical_id, NEW.id, NEW.code, NEW.name_ar, NEW.name_en)
  ON CONFLICT (legacy_activity_id) DO UPDATE
  SET canonical_activity_id = EXCLUDED.canonical_activity_id,
      legacy_code = EXCLUDED.legacy_code,
      legacy_name_ar = EXCLUDED.legacy_name_ar,
      legacy_name_en = EXCLUDED.legacy_name_en;

  DELETE FROM public.canonical_activity_sub_sector_map
  WHERE source_legacy_activity_id = NEW.id
    AND (canonical_activity_id <> canonical_id OR sub_sector_id IS DISTINCT FROM NEW.sub_sector_id);

  IF NEW.sub_sector_id IS NOT NULL THEN
    INSERT INTO public.canonical_activity_sub_sector_map (
      canonical_activity_id, sub_sector_id, source_legacy_activity_id, mapping_source, is_primary, is_active
    )
    VALUES (canonical_id, NEW.sub_sector_id, NEW.id, 'legacy_backfill', false, NEW.is_active)
    ON CONFLICT (canonical_activity_id, sub_sector_id) DO UPDATE
    SET is_active = EXCLUDED.is_active,
        source_legacy_activity_id = COALESCE(
          public.canonical_activity_sub_sector_map.source_legacy_activity_id,
          EXCLUDED.source_legacy_activity_id
        );
  END IF;

  UPDATE public.canonical_activities ca
  SET is_active = EXISTS (
        SELECT 1
        FROM public.canonical_activity_legacy_aliases ala
        JOIN public.economic_activities a ON a.id = ala.legacy_activity_id
        WHERE ala.canonical_activity_id = ca.id AND a.is_active = true
      ) AND ca.superseded_by IS NULL,
      updated_at = NOW()
  WHERE ca.id = canonical_id
     OR ca.id = old_canonical_id;

  RETURN NEW;
END;
$sync$;

REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM anon;
REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM authenticated;

CREATE OR REPLACE VIEW public.project_model_canonical_reconciliation AS
SELECT
  pm.id,
  pm.code,
  pm.is_active,
  pm.is_published,
  pm.size_category,
  pm.activity_id AS legacy_activity_id,
  pm.sector_id AS legacy_sector_id,
  ca.id AS canonical_activity_id,
  ca.code AS canonical_activity_code,
  ca.is_active AS canonical_activity_is_active,
  lsim.investment_sector_id,
  cais.sector_id AS canonical_primary_sector_id,
  concat_ws(
    '|',
    COALESCE(pm.size_category, ''),
    COALESCE(pm.capex_min::text, ''),
    COALESCE(pm.capex_max::text, ''),
    COALESCE(pm.revenue_min::text, ''),
    COALESCE(pm.revenue_max::text, ''),
    COALESCE(pm.employee_count_min::text, ''),
    COALESCE(pm.employee_count_max::text, ''),
    COALESCE(pm.typical_roi_months::text, '')
  ) AS financial_profile_key,
  CASE
    WHEN pm.is_published IS NOT TRUE OR pm.is_active IS NOT TRUE THEN 'unpublished'
    WHEN ala.canonical_activity_id IS NULL OR lsim.investment_sector_id IS NULL THEN 'unmapped'
    WHEN ca.is_active IS NOT TRUE THEN 'inactive'
    WHEN cais.sector_id IS DISTINCT FROM lsim.investment_sector_id THEN 'ambiguous'
    ELSE 'mapped'
  END AS mapping_status
FROM public.project_models pm
LEFT JOIN public.canonical_activity_legacy_aliases ala
  ON ala.legacy_activity_id = pm.activity_id
LEFT JOIN public.canonical_activities ca
  ON ca.id = ala.canonical_activity_id
LEFT JOIN public.legacy_sector_investment_map lsim
  ON lsim.economic_sector_id = pm.sector_id
 AND lsim.is_primary = true
LEFT JOIN public.canonical_activity_investment_sectors cais
  ON cais.canonical_activity_id = ca.id
 AND cais.is_primary = true;

ALTER VIEW public.project_model_canonical_reconciliation SET (security_invoker = true);
GRANT SELECT ON public.project_model_canonical_reconciliation TO anon, authenticated;
