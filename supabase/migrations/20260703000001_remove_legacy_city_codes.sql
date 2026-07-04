-- Bonds V3 — Remove legacy short city codes and modernize text references.
-- Maps profiles.city_code and project_scenarios.city_code from legacy 3-letter codes
-- (e.g. RUH, JED) to modern XX-NN-NNN codes, then deletes the legacy city rows.
-- Related tables that reference cities by UUID will cascade.

BEGIN;

-- Update text city_code references only in tables/columns that exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'city_code'
  ) THEN
    UPDATE public.profiles p
    SET city_code = m.modern_code
    FROM (
      SELECT * FROM (VALUES
        ('ABH', 'SA-06-001'),
        ('ALY', 'EG-02-001'),
        ('AMM', 'JO-01-001'),
        ('AUH', 'AE-02-001'),
        ('BUR', 'SA-04-001'),
        ('CAI', 'EG-01-001'),
        ('DMM', 'SA-05-001'),
        ('DOH', 'QA-01-001'),
        ('DXB', 'AE-01-001'),
        ('ELQ', 'SA-04-001'),
        ('HIL', 'SA-08-001'),
        ('JED', 'SA-02-002'),
        ('KHB', 'SA-05-002'),
        ('MAK', 'SA-02-001'),
        ('MED', 'SA-03-001'),
        ('RUH', 'SA-01-001'),
        ('TBT', 'SA-07-001'),
        ('TBU', 'SA-07-001'),
        ('TIF', 'SA-02-003'),
        ('YNB', 'SA-03-002')
      ) AS t(legacy_code, modern_code)
    ) m
    WHERE p.city_code = m.legacy_code;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_scenarios'
      AND column_name = 'city_code'
  ) THEN
    UPDATE public.project_scenarios ps
    SET city_code = m.modern_code
    FROM (
      SELECT * FROM (VALUES
        ('ABH', 'SA-06-001'),
        ('ALY', 'EG-02-001'),
        ('AMM', 'JO-01-001'),
        ('AUH', 'AE-02-001'),
        ('BUR', 'SA-04-001'),
        ('CAI', 'EG-01-001'),
        ('DMM', 'SA-05-001'),
        ('DOH', 'QA-01-001'),
        ('DXB', 'AE-01-001'),
        ('ELQ', 'SA-04-001'),
        ('HIL', 'SA-08-001'),
        ('JED', 'SA-02-002'),
        ('KHB', 'SA-05-002'),
        ('MAK', 'SA-02-001'),
        ('MED', 'SA-03-001'),
        ('RUH', 'SA-01-001'),
        ('TBT', 'SA-07-001'),
        ('TBU', 'SA-07-001'),
        ('TIF', 'SA-02-003'),
        ('YNB', 'SA-03-002')
      ) AS t(legacy_code, modern_code)
    ) m
    WHERE ps.city_code = m.legacy_code;
  END IF;
END $$;

-- Delete legacy city rows. All UUID FK references use ON DELETE CASCADE/SET NULL.
DELETE FROM public.cities
WHERE code !~ '^[A-Z]{2}-[0-9]{2}-[0-9]{3}$';

COMMIT;
