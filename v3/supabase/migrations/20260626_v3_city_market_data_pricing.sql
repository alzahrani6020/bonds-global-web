-- Bonds V3 — Add pricing/engineering columns to city_market_data
ALTER TABLE public.city_market_data
  ADD COLUMN IF NOT EXISTS warehouse_rent_per_sqm numeric,
  ADD COLUMN IF NOT EXISTS factory_rent_per_sqm numeric,
  ADD COLUMN IF NOT EXISTS construction_cost_per_sqm numeric,
  ADD COLUMN IF NOT EXISTS equipment_cost_min numeric,
  ADD COLUMN IF NOT EXISTS equipment_cost_avg numeric,
  ADD COLUMN IF NOT EXISTS equipment_cost_max numeric,
  ADD COLUMN IF NOT EXISTS monthly_operation_cost_min numeric,
  ADD COLUMN IF NOT EXISTS monthly_operation_cost_avg numeric,
  ADD COLUMN IF NOT EXISTS monthly_operation_cost_max numeric;
