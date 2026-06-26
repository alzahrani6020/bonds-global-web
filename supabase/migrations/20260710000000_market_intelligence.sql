-- BONDS Market Intelligence Database
-- Central repository for market data used by BONDS Valuation Intelligence.

CREATE TABLE IF NOT EXISTS public.market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL,
  country text,
  city text,
  average_selling_price numeric NOT NULL DEFAULT 0,
  average_buying_price numeric NOT NULL DEFAULT 0,
  transaction_count numeric NOT NULL DEFAULT 0,
  supply_index numeric NOT NULL DEFAULT 5,
  demand_index numeric NOT NULL DEFAULT 5,
  competitor_count numeric NOT NULL DEFAULT 0,
  average_sale_speed_days numeric NOT NULL DEFAULT 0,
  inflation_rate numeric NOT NULL DEFAULT 0.03,
  interest_rate numeric NOT NULL DEFAULT 0.05,
  economic_growth_rate numeric NOT NULL DEFAULT 0.03,
  source text,
  recorded_at date DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(asset_class, country, city)
);

COMMENT ON TABLE public.market_data IS 'Central market intelligence data for BONDS Valuation Intelligence';

-- Enable RLS
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

-- Everyone can read; only authenticated users with admin/editor role can write.
CREATE POLICY "Market data is readable by everyone"
  ON public.market_data
  FOR SELECT
  USING (true);

CREATE POLICY "Market data is editable by admins"
  ON public.market_data
  FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ));

-- Seed initial data for 35 asset classes (global defaults).
INSERT INTO public.market_data
  (asset_class, country, city, average_selling_price, average_buying_price, transaction_count, supply_index, demand_index, competitor_count, average_sale_speed_days, inflation_rate, interest_rate, economic_growth_rate, source)
VALUES
  ('realEstate', NULL, NULL, 2500000, 2300000, 120, 5, 6, 50, 90, 0.025, 0.06, 0.035, 'BONDS Market Intelligence'),
  ('business', NULL, NULL, 5000000, 4500000, 45, 4, 5, 30, 180, 0.025, 0.07, 0.03, 'BONDS Market Intelligence'),
  ('factory', NULL, NULL, 8000000, 7200000, 20, 3, 4, 15, 240, 0.025, 0.065, 0.025, 'BONDS Market Intelligence'),
  ('machineryEquipment', NULL, NULL, 1200000, 1000000, 80, 5, 5, 40, 60, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('vehiclesFleet', NULL, NULL, 600000, 550000, 200, 6, 6, 25, 30, 0.025, 0.055, 0.03, 'BONDS Market Intelligence'),
  ('agricultureFarms', NULL, NULL, 3500000, 3200000, 35, 4, 5, 10, 150, 0.025, 0.06, 0.025, 'BONDS Market Intelligence'),
  ('livestock', NULL, NULL, 500000, 450000, 60, 5, 5, 8, 45, 0.025, 0.06, 0.02, 'BONDS Market Intelligence'),
  ('naturalResourcesMining', NULL, NULL, 15000000, 14000000, 10, 3, 4, 5, 365, 0.03, 0.07, 0.02, 'BONDS Market Intelligence'),
  ('oilGas', NULL, NULL, 25000000, 23000000, 8, 3, 4, 6, 365, 0.03, 0.07, 0.02, 'BONDS Market Intelligence'),
  ('infrastructure', NULL, NULL, 30000000, 28000000, 5, 2, 3, 4, 540, 0.025, 0.065, 0.025, 'BONDS Market Intelligence'),
  ('intellectualProperty', NULL, NULL, 2000000, 1800000, 40, 5, 6, 35, 120, 0.025, 0.07, 0.04, 'BONDS Market Intelligence'),
  ('brandsTrademarks', NULL, NULL, 3000000, 2700000, 30, 5, 6, 25, 150, 0.025, 0.07, 0.035, 'BONDS Market Intelligence'),
  ('patents', NULL, NULL, 1500000, 1300000, 25, 4, 5, 20, 180, 0.025, 0.07, 0.035, 'BONDS Market Intelligence'),
  ('copyrightsContent', NULL, NULL, 1200000, 1000000, 50, 5, 6, 30, 90, 0.025, 0.07, 0.04, 'BONDS Market Intelligence'),
  ('franchises', NULL, NULL, 2500000, 2200000, 35, 4, 5, 18, 150, 0.025, 0.07, 0.03, 'BONDS Market Intelligence'),
  ('licensesPermits', NULL, NULL, 800000, 700000, 55, 5, 5, 22, 90, 0.025, 0.065, 0.03, 'BONDS Market Intelligence'),
  ('financialAssets', NULL, NULL, 1000000, 950000, 500, 5, 5, 0, 1, 0.02, 0.04, 0.03, 'BONDS Market Intelligence'),
  ('cryptoDigital', NULL, NULL, 500000, 480000, 1000, 8, 8, 0, 1, 0.03, 0.05, 0.05, 'BONDS Market Intelligence'),
  ('commodities', NULL, NULL, 300000, 280000, 800, 5, 5, 0, 7, 0.025, 0.045, 0.02, 'BONDS Market Intelligence'),
  ('artCollectibles', NULL, NULL, 5000000, 4500000, 25, 4, 5, 40, 270, 0.025, 0.05, 0.03, 'BONDS Market Intelligence'),
  ('jewelryPreciousMetals', NULL, NULL, 4000000, 3600000, 60, 5, 6, 35, 60, 0.02, 0.045, 0.025, 'BONDS Market Intelligence'),
  ('softwareTechnology', NULL, NULL, 3500000, 3000000, 70, 6, 7, 50, 120, 0.025, 0.06, 0.05, 'BONDS Market Intelligence'),
  ('medicalEquipment', NULL, NULL, 2500000, 2200000, 40, 4, 5, 20, 120, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('educationalEquipment', NULL, NULL, 1800000, 1600000, 45, 4, 5, 18, 120, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('distressedAsset', NULL, NULL, 1000000, 900000, 15, 7, 3, 10, 90, 0.03, 0.08, 0.01, 'BONDS Market Intelligence'),
  ('tourismAsset', NULL, NULL, 7000000, 6500000, 20, 4, 5, 12, 210, 0.025, 0.065, 0.035, 'BONDS Market Intelligence'),
  ('personalWealth', NULL, NULL, 2000000, 1900000, 100, 5, 5, 0, 30, 0.025, 0.05, 0.03, 'BONDS Market Intelligence'),
  ('scrapSalvage', NULL, NULL, 150000, 130000, 120, 5, 5, 8, 14, 0.025, 0.06, 0.02, 'BONDS Market Intelligence'),
  ('maritimeAsset', NULL, NULL, 12000000, 11000000, 12, 3, 4, 6, 300, 0.025, 0.065, 0.025, 'BONDS Market Intelligence'),
  ('logisticsAsset', NULL, NULL, 9000000, 8500000, 18, 4, 5, 10, 180, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('fuelStation', NULL, NULL, 5000000, 4600000, 30, 4, 5, 14, 150, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('beautyWellness', NULL, NULL, 1200000, 1100000, 55, 5, 5, 25, 90, 0.025, 0.06, 0.035, 'BONDS Market Intelligence'),
  ('giftsStationery', NULL, NULL, 800000, 720000, 70, 5, 5, 30, 60, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('furnitureAsset', NULL, NULL, 900000, 800000, 65, 5, 5, 28, 75, 0.025, 0.06, 0.03, 'BONDS Market Intelligence'),
  ('retailBusiness', NULL, NULL, 2500000, 2300000, 50, 5, 5, 35, 120, 0.025, 0.06, 0.035, 'BONDS Market Intelligence')
ON CONFLICT (asset_class, country, city) DO UPDATE SET
  average_selling_price = EXCLUDED.average_selling_price,
  average_buying_price = EXCLUDED.average_buying_price,
  transaction_count = EXCLUDED.transaction_count,
  supply_index = EXCLUDED.supply_index,
  demand_index = EXCLUDED.demand_index,
  competitor_count = EXCLUDED.competitor_count,
  average_sale_speed_days = EXCLUDED.average_sale_speed_days,
  inflation_rate = EXCLUDED.inflation_rate,
  interest_rate = EXCLUDED.interest_rate,
  economic_growth_rate = EXCLUDED.economic_growth_rate,
  source = EXCLUDED.source,
  updated_at = now();

-- Index for fast lookup.
CREATE INDEX IF NOT EXISTS idx_market_data_lookup
  ON public.market_data(asset_class, country, city);
