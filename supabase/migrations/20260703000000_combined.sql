-- Letterhead cloud drafts
CREATE TABLE IF NOT EXISTS public.letterhead_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  html jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.letterhead_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own letterhead drafts" ON public.letterhead_drafts;

CREATE POLICY "Users can manage own letterhead drafts"
  ON public.letterhead_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bonds V3 — Seed estimated city_market_data for all modern cities and active activities.
-- This migration fills gaps with model-generated estimates so that City Intelligence,
-- City Comparison, Opportunity Bank, and the AI advisor can return meaningful results.
-- Existing real/sample rows are preserved (ON CONFLICT DO NOTHING).

BEGIN;

-- 1. Helper table: per-activity market baseline profile.
-- These are sector-based defaults with a few activity-level overrides.
CREATE TABLE IF NOT EXISTS public.activity_market_profiles (
  activity_id UUID PRIMARY KEY REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  market_size_per_capita NUMERIC(12,2) NOT NULL DEFAULT 500,
  avg_rent_per_sqm NUMERIC(12,2) NOT NULL DEFAULT 100,
  avg_salary NUMERIC(12,2) NOT NULL DEFAULT 4000,
  labor_availability_score INTEGER NOT NULL DEFAULT 50,
  market_saturation_score INTEGER NOT NULL DEFAULT 50,
  annual_growth_rate NUMERIC(6,3) NOT NULL DEFAULT 5,
  risk_score INTEGER NOT NULL DEFAULT 45,
  profit_margin_avg NUMERIC(6,3) NOT NULL DEFAULT 15,
  expected_demand TEXT NOT NULL DEFAULT 'medium',
  confidence INTEGER NOT NULL DEFAULT 35,
  competitors_per_100k NUMERIC(8,3) NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Populate profiles.
-- Defaults are driven by sector; specific activities get small overrides.
INSERT INTO public.activity_market_profiles (
  activity_id, market_size_per_capita, avg_rent_per_sqm, avg_salary,
  labor_availability_score, market_saturation_score, annual_growth_rate,
  risk_score, profit_margin_avg, expected_demand, confidence, competitors_per_100k
)
SELECT
  a.id,
  -- market_size_per_capita
  CASE
    WHEN a.code IN ('burger_restaurant','restaurant') THEN 1500
    WHEN a.code IN ('coffee_shop','cafe') THEN 900
    WHEN a.code IN ('bakery') THEN 650
    WHEN a.code IN ('food_truck') THEN 350
    WHEN a.code IN ('small_supermarket','supermarket') THEN 4500
    WHEN a.code IN ('pharmacy') THEN 550
    WHEN a.code IN ('medical_lab') THEN 450
    WHEN a.code IN ('dental_clinic') THEN 350
    WHEN a.code IN ('clothing_store','clothing_shop') THEN 1200
    WHEN a.code IN ('mobile_shop','electronics') THEN 900
    WHEN a.code IN ('kindergarten') THEN 250
    WHEN a.code IN ('training_center') THEN 200
    WHEN a.code IN ('boutique_hotel','hotel_boutique') THEN 400
    WHEN a.code IN ('hajj_umrah_agency') THEN 150
    WHEN a.code IN ('payment_gateway','payment_solutions') THEN 120
    WHEN a.code IN ('crowdfunding_platform','crowdfunding') THEN 80
    WHEN a.code IN ('vegetable_greenhouse','greenhouses') THEN 120
    WHEN a.code IN ('water_bottling_plant') THEN 180
    WHEN a.code IN ('packaging_factory','packaging') THEN 250
    WHEN a.code IN ('last_mile_delivery','delivery','short_delivery') THEN 220
    WHEN a.code IN ('plastic_products_factory','plastic_factory_medium','plastic_factory') THEN 280
    WHEN a.code IN ('cold_storage_warehouse','cold_storage_small','cold_storage') THEN 200
    WHEN a.code IN ('residential_contracting','building_contracting') THEN 350
    WHEN s.code = 'food_services' THEN 1000
    WHEN s.code = 'healthcare' THEN 500
    WHEN s.code = 'retail_trade' THEN 1400
    WHEN s.code = 'light_manufacturing' THEN 300
    WHEN s.code = 'logistics_services' THEN 200
    WHEN s.code = 'education' THEN 250
    WHEN s.code = 'construction' THEN 400
    WHEN s.code = 'tourism' THEN 200
    WHEN s.code = 'fintech' THEN 100
    WHEN s.code = 'agriculture' THEN 100
    ELSE 500
  END::NUMERIC(12,2),
  -- avg_rent_per_sqm
  CASE
    WHEN s.code IN ('food_services','healthcare','retail_trade') THEN 140
    WHEN s.code IN ('light_manufacturing','logistics_services','agriculture') THEN 80
    WHEN s.code IN ('tourism') THEN 170
    WHEN s.code IN ('fintech') THEN 130
    WHEN s.code IN ('construction') THEN 70
    WHEN s.code IN ('education') THEN 95
    ELSE 110
  END::NUMERIC(12,2),
  -- avg_salary
  CASE
    WHEN a.code IN ('dental_clinic') THEN 8500
    WHEN a.code IN ('medical_lab') THEN 6500
    WHEN a.code IN ('pharmacy') THEN 5500
    WHEN a.code IN ('payment_gateway','crowdfunding_platform','fintech') THEN 9000
    WHEN a.code IN ('kindergarten','training_center','education') THEN 5000
    WHEN s.code = 'healthcare' THEN 6500
    WHEN s.code = 'fintech' THEN 8500
    WHEN s.code = 'light_manufacturing' THEN 4500
    WHEN s.code = 'logistics_services' THEN 3800
    WHEN s.code = 'construction' THEN 4200
    ELSE 4500
  END::NUMERIC(12,2),
  -- labor_availability_score
  CASE
    WHEN s.code IN ('food_services','retail_trade','logistics_services') THEN 60
    WHEN s.code IN ('healthcare','education') THEN 55
    WHEN s.code IN ('light_manufacturing','construction') THEN 65
    WHEN s.code IN ('fintech') THEN 45
    ELSE 55
  END::INTEGER,
  -- market_saturation_score
  CASE
    WHEN a.code IN ('burger_restaurant','coffee_shop','mobile_shop','clothing_store') THEN 58
    WHEN a.code IN ('food_truck','vegetable_greenhouse') THEN 38
    WHEN a.code IN ('small_supermarket','pharmacy') THEN 50
    WHEN a.code IN ('boutique_hotel','hajj_umrah_agency') THEN 48
    WHEN a.code IN ('payment_gateway','crowdfunding_platform') THEN 68
    WHEN s.code = 'food_services' THEN 55
    WHEN s.code = 'retail_trade' THEN 52
    WHEN s.code = 'healthcare' THEN 42
    WHEN s.code = 'light_manufacturing' THEN 48
    WHEN s.code = 'logistics_services' THEN 50
    WHEN s.code = 'fintech' THEN 65
    ELSE 50
  END::INTEGER,
  -- annual_growth_rate
  CASE
    WHEN s.code = 'food_services' THEN 7
    WHEN s.code = 'fintech' THEN 9
    WHEN s.code = 'healthcare' THEN 6.5
    WHEN s.code = 'education' THEN 6
    WHEN s.code = 'retail_trade' THEN 5
    WHEN s.code = 'tourism' THEN 6
    WHEN s.code = 'logistics_services' THEN 5.5
    WHEN s.code = 'light_manufacturing' THEN 4
    WHEN s.code = 'construction' THEN 3
    WHEN s.code = 'agriculture' THEN 5
    ELSE 5
  END::NUMERIC(6,3),
  -- risk_score
  CASE
    WHEN s.code = 'food_services' THEN 45
    WHEN s.code = 'healthcare' THEN 35
    WHEN s.code = 'retail_trade' THEN 40
    WHEN s.code = 'light_manufacturing' THEN 55
    WHEN s.code = 'logistics_services' THEN 45
    WHEN s.code = 'construction' THEN 60
    WHEN s.code = 'tourism' THEN 50
    WHEN s.code = 'fintech' THEN 55
    WHEN s.code = 'agriculture' THEN 50
    WHEN s.code = 'education' THEN 30
    ELSE 45
  END::INTEGER,
  -- profit_margin_avg
  CASE
    WHEN a.code IN ('pharmacy','medical_lab','dental_clinic') THEN 22
    WHEN a.code IN ('burger_restaurant','coffee_shop','bakery') THEN 18
    WHEN a.code IN ('food_truck') THEN 25
    WHEN a.code IN ('small_supermarket') THEN 12
    WHEN a.code IN ('clothing_store','mobile_shop') THEN 16
    WHEN a.code IN ('boutique_hotel') THEN 20
    WHEN a.code IN ('payment_gateway','crowdfunding_platform') THEN 28
    WHEN s.code = 'food_services' THEN 17
    WHEN s.code = 'healthcare' THEN 22
    WHEN s.code = 'retail_trade' THEN 14
    WHEN s.code = 'light_manufacturing' THEN 13
    WHEN s.code = 'fintech' THEN 25
    ELSE 15
  END::NUMERIC(6,3),
  -- expected_demand
  CASE
    WHEN a.code IN ('food_truck','vegetable_greenhouse') THEN 'high'
    WHEN a.code IN ('pharmacy','medical_lab','dental_clinic','kindergarten') THEN 'high'
    WHEN a.code IN ('payment_gateway','crowdfunding_platform') THEN 'medium'
    WHEN a.code IN ('boutique_hotel','hajj_umrah_agency') THEN 'medium'
    ELSE 'medium'
  END::TEXT,
  35::INTEGER,
  -- competitors_per_100k
  CASE
    WHEN a.code IN ('burger_restaurant','coffee_shop','bakery') THEN 9
    WHEN a.code IN ('food_truck') THEN 3
    WHEN a.code IN ('small_supermarket','supermarket') THEN 2.5
    WHEN a.code IN ('pharmacy') THEN 4
    WHEN a.code IN ('mobile_shop','clothing_store') THEN 8
    WHEN a.code IN ('kindergarten') THEN 2
    WHEN a.code IN ('last_mile_delivery','delivery') THEN 5
    ELSE 5
  END::NUMERIC(8,3)
FROM public.economic_activities a
JOIN public.economic_sectors s ON s.id = a.sector_id
ON CONFLICT (activity_id) DO UPDATE SET
  market_size_per_capita = EXCLUDED.market_size_per_capita,
  avg_rent_per_sqm = EXCLUDED.avg_rent_per_sqm,
  avg_salary = EXCLUDED.avg_salary,
  labor_availability_score = EXCLUDED.labor_availability_score,
  market_saturation_score = EXCLUDED.market_saturation_score,
  annual_growth_rate = EXCLUDED.annual_growth_rate,
  risk_score = EXCLUDED.risk_score,
  profit_margin_avg = EXCLUDED.profit_margin_avg,
  expected_demand = EXCLUDED.expected_demand,
  confidence = EXCLUDED.confidence,
  competitors_per_100k = EXCLUDED.competitors_per_100k,
  updated_at = NOW();

-- 3. Insert estimated market rows for every modern city × activity.
-- Only fills combinations that do not already have data for 2025.
INSERT INTO public.city_market_data (
  city_id, activity_id, data_year, competitors_count, avg_market_share,
  avg_rent_per_sqm, avg_land_price_per_sqm, avg_salary,
  labor_availability_score, market_saturation_score,
  source, market_size, annual_growth_rate, per_capita_spending,
  expected_demand, profit_margin_min, profit_margin_avg, profit_margin_max,
  risk_score, confidence, specialists_count, saudization_rate,
  opportunity_score, opportunity_rank, opportunity_breakdown,
  warehouse_rent_per_sqm, factory_rent_per_sqm, construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  created_at, updated_at
)
SELECT
  c.id,
  a.id,
  2025,
  GREATEST(1, ROUND((COALESCE(c.population, 500000)::NUMERIC / 100000) * p.competitors_per_100k)),
  5::NUMERIC(6,2),
  p.avg_rent_per_sqm,
  (p.avg_rent_per_sqm * 4)::NUMERIC(12,2),
  p.avg_salary,
  p.labor_availability_score,
  LEAST(100, GREATEST(0, p.market_saturation_score + ROUND(LOG(GREATEST(100000, COALESCE(c.population, 500000)::NUMERIC) / 100000) * 3))),
  'model_estimate',
  ROUND((COALESCE(c.population, 500000)::NUMERIC * p.market_size_per_capita * (COALESCE(c.purchasing_power_index, 100)::NUMERIC / 100))),
  p.annual_growth_rate,
  (p.market_size_per_capita * (COALESCE(c.purchasing_power_index, 100)::NUMERIC / 100))::NUMERIC(12,2),
  p.expected_demand,
  GREATEST(5, p.profit_margin_avg - 5),
  p.profit_margin_avg,
  LEAST(60, p.profit_margin_avg + 5),
  p.risk_score,
  p.confidence,
  GREATEST(1, ROUND(COALESCE(c.population, 500000)::NUMERIC / 8000)),
  20::NUMERIC(6,3),
  0,
  NULL,
  JSONB_BUILD_OBJECT('source', 'model_estimate', 'estimated', true),
  (p.avg_rent_per_sqm * 0.8)::NUMERIC(12,2),
  (p.avg_rent_per_sqm * 0.6)::NUMERIC(12,2),
  (p.avg_rent_per_sqm * 8)::NUMERIC(12,2),
  (p.avg_salary * 2)::NUMERIC(14,2),
  (p.avg_salary * 4)::NUMERIC(14,2),
  (p.avg_salary * 8)::NUMERIC(14,2),
  (p.avg_salary * 1.5)::NUMERIC(14,2),
  (p.avg_salary * 3)::NUMERIC(14,2),
  (p.avg_salary * 6)::NUMERIC(14,2),
  NOW(),
  NOW()
FROM public.cities c
CROSS JOIN public.economic_activities a
JOIN public.activity_market_profiles p ON p.activity_id = a.id
WHERE c.code ~ '^[A-Z]{2}-\d{2}-\d{3}$'
  AND NOT EXISTS (
    SELECT 1
    FROM public.city_market_data m
    WHERE m.city_id = c.id
      AND m.activity_id = a.id
      AND m.data_year = 2025
  );

-- 4. Compute opportunity_score for all newly inserted (and any other 2025) rows.
-- The formula mirrors the OpportunityScoringEngine logic using available metrics.
WITH scored AS (
  SELECT
    m.id,
    ROUND(
      LEAST(100, GREATEST(0,
        (COALESCE(m.annual_growth_rate, 0)::NUMERIC / 30) * 20
        + (100 - COALESCE(m.market_saturation_score, 50)) * 0.25
        + COALESCE(m.labor_availability_score, 50) * 0.15
        + (COALESCE(c.purchasing_power_index, 100)::NUMERIC / 150) * 15
        + (100 - COALESCE(m.risk_score, 50)) * 0.05
        + GREATEST(0, 100 - (COALESCE(m.avg_rent_per_sqm, 100) / 2)) * 0.10
        + LEAST(20, COALESCE(m.per_capita_spending, 0)::NUMERIC / 100) * 0.10
      )) * (0.5 + (COALESCE(m.confidence, 35)::NUMERIC / 200)),
      2
    ) AS score
  FROM public.city_market_data m
  JOIN public.cities c ON c.id = m.city_id
  WHERE m.data_year = 2025
    AND (m.source = 'model_estimate' OR m.opportunity_score IS NULL)
)
UPDATE public.city_market_data cmd
SET opportunity_score = scored.score
FROM scored
WHERE cmd.id = scored.id;

-- 5. Recalculate opportunity_rank per activity for 2025.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY activity_id ORDER BY opportunity_score DESC NULLS LAST) AS r
  FROM public.city_market_data
  WHERE data_year = 2025
)
UPDATE public.city_market_data cmd
SET opportunity_rank = ranked.r
FROM ranked
WHERE cmd.id = ranked.id;

COMMIT;

-- ============================================
-- B2B bank/fintech partner inquiries
-- (merged from 20260703000000_bank_partner_requests.sql)
-- ============================================

CREATE TABLE IF NOT EXISTS public.bank_partner_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  country text,
  organization_type text CHECK (organization_type IN ('bank', 'fintech', 'investment_firm', 'government', 'other')),
  use_case text,
  estimated_volume text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo_scheduled', 'pilot', 'closed', 'declined')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_partner_requests_created_at ON public.bank_partner_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_partner_requests_status ON public.bank_partner_requests(status);

ALTER TABLE public.bank_partner_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage bank partner requests" ON public.bank_partner_requests;

CREATE POLICY "Service role can manage bank partner requests"
  ON public.bank_partner_requests
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
