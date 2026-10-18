-- Bonds V3 — Canonical Activity Taxonomy
-- Additive, reversible-by-drop migration. Legacy economic_activities rows and all
-- downstream foreign keys remain untouched. This layer gives the application one
-- canonical identity per economic activity while preserving every legacy code and
-- sector/sub-sector context.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.canonical_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  normalized_name_ar TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.canonical_activity_legacy_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_activity_id UUID NOT NULL
    REFERENCES public.canonical_activities(id) ON DELETE CASCADE,
  legacy_activity_id UUID UNIQUE
    REFERENCES public.economic_activities(id) ON DELETE SET NULL,
  legacy_code TEXT NOT NULL UNIQUE,
  legacy_name_ar TEXT,
  legacy_name_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.canonical_activity_sub_sector_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_activity_id UUID NOT NULL
    REFERENCES public.canonical_activities(id) ON DELETE CASCADE,
  sub_sector_id UUID NOT NULL
    REFERENCES public.economic_sub_sectors(id) ON DELETE CASCADE,
  source_legacy_activity_id UUID
    REFERENCES public.economic_activities(id) ON DELETE SET NULL,
  mapping_source TEXT NOT NULL DEFAULT 'legacy_backfill'
    CHECK (mapping_source IN ('legacy_backfill', 'curated', 'import')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canonical_activity_id, sub_sector_id)
);

CREATE INDEX IF NOT EXISTS idx_canonical_activity_aliases_canonical
  ON public.canonical_activity_legacy_aliases(canonical_activity_id);

CREATE INDEX IF NOT EXISTS idx_canonical_activity_sub_sector_canonical
  ON public.canonical_activity_sub_sector_map(canonical_activity_id);

CREATE INDEX IF NOT EXISTS idx_canonical_activity_sub_sector_sub_sector
  ON public.canonical_activity_sub_sector_map(sub_sector_id);

-- Backfill one canonical record per semantic Arabic display name. The current
-- generated taxonomy repeats the same exact activity label across many sectors;
-- stripping the presentation prefix "نشاط" gives the canonical grouping key.
WITH source_rows AS (
  SELECT
    a.id,
    a.code,
    a.name_ar,
    a.name_en,
    a.description,
    a.is_active,
    a.sort_order,
    a.sub_sector_id,
    regexp_replace(btrim(a.name_ar), '^نشاط[[:space:]]+', '', 'i') AS normalized_name_ar,
    regexp_replace(btrim(COALESCE(a.name_en, '')), '[[:space:]]+Activity$', '', 'i') AS normalized_name_en
  FROM public.economic_activities a
  WHERE btrim(COALESCE(a.name_ar, '')) <> ''
),
grouped AS (
  SELECT
    normalized_name_ar,
    (array_agg(name_ar ORDER BY sort_order, code))[1] AS original_name_ar,
    NULLIF((array_agg(NULLIF(normalized_name_en, '') ORDER BY sort_order, code))[1], '') AS canonical_name_en,
    (array_agg(description ORDER BY sort_order, code))[1] AS canonical_description,
    bool_or(is_active) AS is_active,
    min(sort_order) AS sort_order
  FROM source_rows
  GROUP BY normalized_name_ar
),
coded AS (
  SELECT
    *,
    trim(BOTH '_' FROM regexp_replace(
      lower(COALESCE(canonical_name_en, '')),
      '[^a-z0-9]+',
      '_',
      'g'
    )) AS base_code
  FROM grouped
),
ranked AS (
  SELECT
    *,
    CASE
      WHEN base_code = '' THEN 'activity_' || substr(md5(normalized_name_ar), 1, 12)
      WHEN count(*) OVER (PARTITION BY base_code) > 1
        THEN base_code || '_' || substr(md5(normalized_name_ar), 1, 8)
      ELSE base_code
    END AS canonical_code
  FROM coded
)
INSERT INTO public.canonical_activities (
  code,
  normalized_name_ar,
  name_ar,
  name_en,
  description,
  is_active,
  sort_order
)
SELECT
  canonical_code,
  normalized_name_ar,
  normalized_name_ar,
  canonical_name_en,
  canonical_description,
  is_active,
  sort_order
FROM ranked
ON CONFLICT (normalized_name_ar) DO UPDATE
SET
  name_ar = EXCLUDED.name_ar,
  name_en = COALESCE(EXCLUDED.name_en, public.canonical_activities.name_en),
  description = COALESCE(EXCLUDED.description, public.canonical_activities.description),
  is_active = EXCLUDED.is_active,
  sort_order = LEAST(public.canonical_activities.sort_order, EXCLUDED.sort_order),
  updated_at = NOW();

-- Preserve every legacy activity code as a resolvable alias.
INSERT INTO public.canonical_activity_legacy_aliases (
  canonical_activity_id,
  legacy_activity_id,
  legacy_code,
  legacy_name_ar,
  legacy_name_en
)
SELECT
  ca.id,
  a.id,
  a.code,
  a.name_ar,
  a.name_en
FROM public.economic_activities a
JOIN public.canonical_activities ca
  ON ca.normalized_name_ar =
     regexp_replace(btrim(a.name_ar), '^نشاط[[:space:]]+', '', 'i')
ON CONFLICT (legacy_code) DO UPDATE
SET
  canonical_activity_id = EXCLUDED.canonical_activity_id,
  legacy_activity_id = EXCLUDED.legacy_activity_id,
  legacy_name_ar = EXCLUDED.legacy_name_ar,
  legacy_name_en = EXCLUDED.legacy_name_en;

-- Preserve sector/sub-sector applicability separately from activity identity.
INSERT INTO public.canonical_activity_sub_sector_map (
  canonical_activity_id,
  sub_sector_id,
  source_legacy_activity_id,
  mapping_source,
  is_primary,
  is_active
)
SELECT DISTINCT ON (ca.id, a.sub_sector_id)
  ca.id,
  a.sub_sector_id,
  a.id,
  'legacy_backfill',
  false,
  a.is_active
FROM public.economic_activities a
JOIN public.canonical_activities ca
  ON ca.normalized_name_ar =
     regexp_replace(btrim(a.name_ar), '^نشاط[[:space:]]+', '', 'i')
WHERE a.sub_sector_id IS NOT NULL
ORDER BY ca.id, a.sub_sector_id, a.sort_order, a.code
ON CONFLICT (canonical_activity_id, sub_sector_id) DO UPDATE
SET
  source_legacy_activity_id = COALESCE(
    public.canonical_activity_sub_sector_map.source_legacy_activity_id,
    EXCLUDED.source_legacy_activity_id
  ),
  is_active = EXCLUDED.is_active;

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
    array_agg(DISTINCT ala.legacy_code)
      FILTER (WHERE ala.legacy_code IS NOT NULL),
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
  count(DISTINCT m.sub_sector_id)::integer AS sub_sector_count
FROM public.canonical_activities ca
LEFT JOIN public.canonical_activity_legacy_aliases ala
  ON ala.canonical_activity_id = ca.id
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
  ca.sort_order;

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
    c.id,
    c.code,
    c.name_ar,
    v.aliases
  FROM public.canonical_activity_catalog v
  JOIN public.canonical_activities c ON c.id = v.id
  WHERE c.code = input_code
     OR input_code = ANY(v.aliases)
  LIMIT 1
$$;

ALTER TABLE public.canonical_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_activity_legacy_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_activity_sub_sector_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read canonical activities"
  ON public.canonical_activities;
CREATE POLICY "Public read canonical activities"
  ON public.canonical_activities
  FOR SELECT TO PUBLIC
  USING (is_active = true);

DROP POLICY IF EXISTS "Public read canonical activity aliases"
  ON public.canonical_activity_legacy_aliases;
CREATE POLICY "Public read canonical activity aliases"
  ON public.canonical_activity_legacy_aliases
  FOR SELECT TO PUBLIC
  USING (true);

DROP POLICY IF EXISTS "Public read canonical activity mappings"
  ON public.canonical_activity_sub_sector_map;
CREATE POLICY "Public read canonical activity mappings"
  ON public.canonical_activity_sub_sector_map
  FOR SELECT TO PUBLIC
  USING (is_active = true);

GRANT SELECT ON public.canonical_activity_catalog TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_canonical_activity(TEXT) TO anon, authenticated;

COMMENT ON TABLE public.canonical_activities IS
  'Canonical economic activity identities. Sector context is intentionally stored in canonical_activity_sub_sector_map.';
COMMENT ON TABLE public.canonical_activity_legacy_aliases IS
  'Backward-compatible resolver from every legacy economic_activities code to one canonical activity.';
COMMENT ON TABLE public.canonical_activity_sub_sector_map IS
  'Many-to-many applicability between canonical activities and economic sub-sectors.';

-- Keep the canonical layer synchronized for future imports/admin writes. This
-- makes the fix durable: new legacy rows resolve into an existing canonical
-- identity instead of creating another user-facing activity.
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

  SELECT id
    INTO canonical_id
  FROM public.canonical_activities
  WHERE normalized_name_ar = normalized_ar
  LIMIT 1;

  IF canonical_id IS NULL THEN
    base_code := trim(BOTH '_' FROM regexp_replace(
      lower(normalized_en),
      '[^a-z0-9]+',
      '_',
      'g'
    ));

    IF base_code = '' THEN
      base_code := 'activity_' || substr(md5(normalized_ar), 1, 12);
    END IF;

    candidate_code := base_code;

    IF EXISTS (
      SELECT 1
      FROM public.canonical_activities
      WHERE code = candidate_code
        AND normalized_name_ar <> normalized_ar
    ) THEN
      candidate_code := base_code || '_' || substr(md5(normalized_ar), 1, 8);
    END IF;

    INSERT INTO public.canonical_activities (
      code, normalized_name_ar, name_ar, name_en, description, is_active, sort_order
    )
    VALUES (
      candidate_code, normalized_ar, normalized_ar, NULLIF(normalized_en, ''),
      NEW.description, NEW.is_active, NEW.sort_order
    )
    ON CONFLICT (normalized_name_ar) DO UPDATE
    SET
      name_en = COALESCE(EXCLUDED.name_en, public.canonical_activities.name_en),
      description = COALESCE(EXCLUDED.description, public.canonical_activities.description),
      is_active = EXCLUDED.is_active,
      sort_order = LEAST(public.canonical_activities.sort_order, EXCLUDED.sort_order),
      updated_at = NOW()
    RETURNING id INTO canonical_id;
  ELSE
    UPDATE public.canonical_activities
    SET
      is_active = (
        SELECT bool_or(a.is_active)
        FROM public.economic_activities a
        WHERE regexp_replace(btrim(a.name_ar), '^نشاط[[:space:]]+', '', 'i') = normalized_ar
      ),
      updated_at = NOW()
    WHERE id = canonical_id;
  END IF;

  INSERT INTO public.canonical_activity_legacy_aliases (
    canonical_activity_id, legacy_activity_id, legacy_code, legacy_name_ar, legacy_name_en
  )
  VALUES (canonical_id, NEW.id, NEW.code, NEW.name_ar, NEW.name_en)
  ON CONFLICT (legacy_activity_id) DO UPDATE
  SET
    canonical_activity_id = EXCLUDED.canonical_activity_id,
    legacy_code = EXCLUDED.legacy_code,
    legacy_name_ar = EXCLUDED.legacy_name_ar,
    legacy_name_en = EXCLUDED.legacy_name_en;

  IF NEW.sub_sector_id IS NOT NULL THEN
    INSERT INTO public.canonical_activity_sub_sector_map (
      canonical_activity_id, sub_sector_id, source_legacy_activity_id, mapping_source, is_primary, is_active
    )
    VALUES (canonical_id, NEW.sub_sector_id, NEW.id, 'legacy_backfill', false, NEW.is_active)
    ON CONFLICT (canonical_activity_id, sub_sector_id) DO UPDATE
    SET
      is_active = EXCLUDED.is_active,
      source_legacy_activity_id = COALESCE(
        public.canonical_activity_sub_sector_map.source_legacy_activity_id,
        EXCLUDED.source_legacy_activity_id
      );
  END IF;

  RETURN NEW;
END;
$sync$;
DROP TRIGGER IF EXISTS trg_sync_canonical_activity_from_legacy
  ON public.economic_activities;

CREATE TRIGGER trg_sync_canonical_activity_from_legacy
AFTER INSERT OR UPDATE OF code, name_ar, name_en, description, sub_sector_id, is_active, sort_order
ON public.economic_activities
FOR EACH ROW
EXECUTE FUNCTION public.sync_canonical_activity_from_legacy();

COMMENT ON FUNCTION public.sync_canonical_activity_from_legacy() IS
  'Synchronizes future economic_activities writes into the canonical activity registry without changing legacy foreign keys.';

