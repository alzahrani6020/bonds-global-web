-- Bonds V3 — Canonical catalog represents taxonomy, not data availability.
-- Inactive legacy activity rows remain visible as canonical taxonomy entries;
-- API responses expose is_active/recordStatus so consumers can distinguish them.

DROP POLICY IF EXISTS "Public read canonical activities" ON public.canonical_activities;
CREATE POLICY "Public read canonical activities"
  ON public.canonical_activities
  FOR SELECT TO PUBLIC
  USING (true);