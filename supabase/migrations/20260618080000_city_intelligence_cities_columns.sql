-- Migration: Add missing City Intelligence columns to existing cities table
-- The cities table already exists (created by v3 master data) with id/name_ar/name_en.
-- This migration adds the columns City Intelligence expects.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cities'
  ) THEN
    ALTER TABLE public.cities
      ADD COLUMN IF NOT EXISTS name text,
      ADD COLUMN IF NOT EXISTS area_km2 numeric(12,2),
      ADD COLUMN IF NOT EXISTS center_lat numeric(10,7),
      ADD COLUMN IF NOT EXISTS center_lng numeric(10,7),
      ADD COLUMN IF NOT EXISTS boundary_geojson jsonb,
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS metadata jsonb;

    -- Ensure status check constraint
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage
      WHERE table_schema = 'public' AND table_name = 'cities' AND constraint_name = 'cities_status_check'
    ) THEN
      ALTER TABLE public.cities
        ADD CONSTRAINT cities_status_check CHECK (status IN ('active','archived'));
    END IF;

    -- Populate name from existing name / name_en for existing v3 cities
    UPDATE public.cities
    SET name = COALESCE(NULLIF(name, ''), name_en)
    WHERE name IS NULL OR name = '';
  END IF;
END $$;

COMMENT ON TABLE public.cities IS 'Unified cities table (v3 master data + City Intelligence)';
