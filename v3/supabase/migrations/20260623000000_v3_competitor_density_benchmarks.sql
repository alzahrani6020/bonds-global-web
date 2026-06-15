-- Bonds V3 — Seed country-level competitor density benchmarks
-- Used by InferenceEngine to produce more realistic competitors_count estimates.
-- Values are approximate industry benchmarks per 10,000 population for dental clinics.

INSERT INTO public.country_benchmarks (country_code, metric_code, benchmark_value, year, source)
VALUES
  ('SA', 'competitors_per_10k_dental_clinics', 3.5, 2025, 'MoH / SCFHS dental workforce estimates'),
  ('AE', 'competitors_per_10k_dental_clinics', 3.0, 2025, 'Bonds internal estimate'),
  ('QA', 'competitors_per_10k_dental_clinics', 3.2, 2025, 'Bonds internal estimate'),
  ('EG', 'competitors_per_10k_dental_clinics', 1.2, 2025, 'Bonds internal estimate'),
  ('JO', 'competitors_per_10k_dental_clinics', 1.5, 2025, 'Bonds internal estimate')
ON CONFLICT (country_code, metric_code, year) DO UPDATE SET
  benchmark_value = EXCLUDED.benchmark_value,
  source = EXCLUDED.source;
