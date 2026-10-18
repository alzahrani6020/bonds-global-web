-- Bonds V3 — Keep legacy-to-canonical applicability mappings exact on edits

CREATE OR REPLACE FUNCTION public.sync_canonical_activity_from_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sync$
DECLARE
  normalized_ar TEXT;
  normalized_en TEXT;
  base_code TEXT;
  candidate_code TEXT;
  canonical_id UUID;
BEGIN
  normalized_ar := regexp_replace(btrim(COALESCE(NEW.name_ar, '')), '^نشاط[[:space:]]+', '', 'i');
  normalized_en := regexp_replace(btrim(COALESCE(NEW.name_en, '')), '[[:space:]]+Activity$', '', 'i');

  IF normalized_ar = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO canonical_id
  FROM public.canonical_activities
  WHERE normalized_name_ar = normalized_ar
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
    RETURNING id INTO canonical_id;
  END IF;

  INSERT INTO public.canonical_activity_legacy_aliases (canonical_activity_id, legacy_activity_id, legacy_code, legacy_name_ar, legacy_name_en)
  VALUES (canonical_id, NEW.id, NEW.code, NEW.name_ar, NEW.name_en)
  ON CONFLICT (legacy_activity_id) DO UPDATE
  SET canonical_activity_id = EXCLUDED.canonical_activity_id,
      legacy_code = EXCLUDED.legacy_code,
      legacy_name_ar = EXCLUDED.legacy_name_ar,
      legacy_name_en = EXCLUDED.legacy_name_en;

  -- An edited legacy row can change canonical identity or sub-sector. Remove only
  -- mappings sourced from that row which no longer describe its current state.
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

  -- Recompute active state from all aliases after any move/update.
  UPDATE public.canonical_activities ca
  SET is_active = EXISTS (
        SELECT 1
        FROM public.canonical_activity_legacy_aliases ala
        JOIN public.economic_activities a ON a.id = ala.legacy_activity_id
        WHERE ala.canonical_activity_id = ca.id AND a.is_active = true
      ),
      updated_at = NOW()
  WHERE ca.id = canonical_id
     OR (TG_OP = 'UPDATE' AND ca.id IN (
          SELECT canonical_activity_id
          FROM public.canonical_activity_legacy_aliases
          WHERE legacy_activity_id = NEW.id
        ));

  RETURN NEW;
END;
$sync$;

REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM anon;
REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM authenticated;