-- BONDS Depreciation Factors Database
-- Central repository for asset-class depreciation factors and methods.
-- Consumed by the Depreciation Engine in valuation/depreciation-engine.js.

CREATE TABLE IF NOT EXISTS public.depreciation_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL UNIQUE,
  name_ar text,
  name_en text,
  factors jsonb NOT NULL DEFAULT '{}',
  methods jsonb NOT NULL DEFAULT '{}',
  notes text,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.depreciation_factors IS 'Central depreciation factors and methods for BONDS Depreciation Engine';

-- Enable RLS
ALTER TABLE public.depreciation_factors ENABLE ROW LEVEL SECURITY;

-- Everyone can read; only authenticated users with admin/editor role can write.
CREATE POLICY "Depreciation factors are readable by everyone"
  ON public.depreciation_factors
  FOR SELECT
  USING (true);

CREATE POLICY "Depreciation factors are editable by admins"
  ON public.depreciation_factors
  FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ));

-- Seed initial data aligned with valuation/depreciation-standards.js
INSERT INTO public.depreciation_factors
  (asset_class, name_ar, name_en, factors, methods, notes)
VALUES
  ('realEstate', 'العقارات', 'Real Estate',
   '{"economic": 1.0, "operational": 0.8, "environmental": 1.2, "technical": 0.6, "functional": 1.0, "maintenance": 1.1, "misuse": 0.7}',
   '{"accounting": "straight-line", "economic": "straight-line", "operational": "straight-line", "environmental": "straight-line", "technical": "straight-line", "functional": "straight-line", "maintenance": "straight-line", "misuse": "straight-line"}',
   'Long straight-line lives for buildings and land improvements.'),
  ('business', 'الشركات', 'Business',
   '{"economic": 1.2, "operational": 0.9, "environmental": 0.5, "technical": 0.8, "functional": 1.2, "maintenance": 0.6, "misuse": 0.5}',
   '{"accounting": "straight-line", "economic": "declining-balance", "technical": "declining-balance"}',
   'Business value decays with market relevance.'),
  ('factory', 'المصانع', 'Factory',
   '{"economic": 1.0, "operational": 1.2, "environmental": 1.1, "technical": 1.0, "functional": 0.8, "maintenance": 1.3, "misuse": 1.0}',
   '{"accounting": "straight-line", "operational": "units-of-production", "maintenance": "straight-line"}',
   'Heavy usage and maintenance drive factory depreciation.'),
  ('machineryEquipment', 'الآلات والمعدات', 'Machinery & Equipment',
   '{"economic": 1.0, "operational": 1.3, "environmental": 1.0, "technical": 1.2, "functional": 0.9, "maintenance": 1.2, "misuse": 1.1}',
   '{"accounting": "straight-line", "operational": "units-of-production", "technical": "declining-balance"}',
   'Usage and obsolescence dominate.'),
  ('vehiclesFleet', 'المركبات والأساطيل', 'Vehicles & Fleet',
   '{"economic": 1.1, "operational": 1.4, "environmental": 1.1, "technical": 1.0, "functional": 0.8, "maintenance": 1.2, "misuse": 1.3}',
   '{"accounting": "declining-balance", "operational": "units-of-production", "technical": "declining-balance"}',
   'Mileage and age drive vehicle depreciation.'),
  ('agricultureFarms', 'الزراعة والمزارع', 'Agriculture & Farms',
   '{"economic": 0.9, "operational": 1.0, "environmental": 1.3, "technical": 0.6, "functional": 0.7, "maintenance": 1.1, "misuse": 0.8}',
   '{"accounting": "straight-line", "environmental": "straight-line"}',
   'Climate exposure is significant.'),
  ('livestock', 'الثروة الحيوانية', 'Livestock',
   '{"economic": 1.2, "operational": 1.0, "environmental": 1.0, "technical": 0.4, "functional": 0.6, "maintenance": 1.2, "misuse": 0.8}',
   '{"accounting": "straight-line", "maintenance": "straight-line"}',
   'Biological depreciation with health/maintenance factors.'),
  ('naturalResourcesMining', 'الموارد الطبيعية والتعدين', 'Natural Resources & Mining',
   '{"economic": 1.0, "operational": 1.1, "environmental": 1.2, "technical": 0.8, "functional": 0.7, "maintenance": 1.0, "misuse": 0.9}',
   '{"accounting": "units-of-production"}',
   'Depletion-based depreciation.'),
  ('oilGas', 'النفط والغاز', 'Oil & Gas Assets',
   '{"economic": 1.0, "operational": 1.1, "environmental": 1.3, "technical": 0.9, "functional": 0.7, "maintenance": 1.1, "misuse": 1.0}',
   '{"accounting": "units-of-production"}',
   'Reserve-based depletion.'),
  ('infrastructure', 'البنية التحتية', 'Infrastructure',
   '{"economic": 0.9, "operational": 1.0, "environmental": 1.2, "technical": 0.7, "functional": 0.8, "maintenance": 1.2, "misuse": 0.9}',
   '{"accounting": "straight-line"}',
   'Long-life straight-line with environmental factor.'),
  ('intellectualProperty', 'الملكية الفكرية', 'Intellectual Property',
   '{"economic": 1.3, "operational": 0.5, "environmental": 0.2, "technical": 1.5, "functional": 1.3, "maintenance": 0.5, "misuse": 0.4}',
   '{"accounting": "straight-line", "technical": "declining-balance"}',
   'Obsolescence is the dominant factor.'),
  ('brandsTrademarks', 'العلامات التجارية', 'Brands & Trademarks',
   '{"economic": 1.2, "operational": 0.5, "environmental": 0.2, "technical": 0.8, "functional": 1.2, "maintenance": 0.6, "misuse": 0.3}',
   '{"accounting": "straight-line"}',
   'Brand strength reduces functional depreciation.'),
  ('patents', 'براءات الاختراع', 'Patents',
   '{"economic": 1.2, "operational": 0.5, "environmental": 0.2, "technical": 1.6, "functional": 1.1, "maintenance": 0.4, "misuse": 0.3}',
   '{"accounting": "straight-line", "technical": "declining-balance"}',
   'Legal life limits; technology obsolescence is high.'),
  ('copyrightsContent', 'حقوق المؤلف والمحتوى', 'Copyrights & Content',
   '{"economic": 1.1, "operational": 0.5, "environmental": 0.2, "technical": 1.2, "functional": 1.0, "maintenance": 0.4, "misuse": 0.3}',
   '{"accounting": "straight-line"}',
   'Content amortization over useful life.'),
  ('franchises', 'الامتيازات التجارية', 'Franchises',
   '{"economic": 1.1, "operational": 0.8, "environmental": 0.3, "technical": 0.7, "functional": 1.1, "maintenance": 0.6, "misuse": 0.4}',
   '{"accounting": "straight-line"}',
   'Contract-life amortization.'),
  ('licensesPermits', 'التراخيص والتصاريح', 'Licenses & Permits',
   '{"economic": 1.1, "operational": 0.6, "environmental": 0.3, "technical": 0.6, "functional": 1.2, "maintenance": 0.4, "misuse": 0.3}',
   '{"accounting": "straight-line"}',
   'License duration drives amortization.'),
  ('financialAssets', 'الأصول المالية', 'Financial Assets',
   '{"economic": 1.0, "operational": 0.2, "environmental": 0.1, "technical": 0.5, "functional": 0.6, "maintenance": 0.1, "misuse": 0.2}',
   '{"accounting": "straight-line"}',
   'Market value changes dominate; minimal physical depreciation.'),
  ('cryptoDigital', 'العملات الرقمية والأصول الرقمية', 'Crypto & Digital Assets',
   '{"economic": 1.2, "operational": 0.2, "environmental": 0.1, "technical": 1.4, "functional": 1.0, "maintenance": 0.2, "misuse": 0.5}',
   '{"accounting": "declining-balance", "technical": "declining-balance"}',
   'High volatility and technology risk.'),
  ('commodities', 'السلع', 'Commodities',
   '{"economic": 1.0, "operational": 0.5, "environmental": 0.3, "technical": 0.2, "functional": 0.4, "maintenance": 0.2, "misuse": 0.2}',
   '{"accounting": "straight-line"}',
   'Short holding period; market price driven.'),
  ('artCollectibles', 'الفنون والمقتنيات', 'Art & Collectibles',
   '{"economic": 0.6, "operational": 0.3, "environmental": 1.0, "technical": 0.3, "functional": 0.4, "maintenance": 0.8, "misuse": 0.6}',
   '{"accounting": "straight-line"}',
   'May appreciate; depreciation only for condition loss.'),
  ('jewelryPreciousMetals', 'المجوهرات والمعادن الثمينة', 'Jewelry & Precious Metals',
   '{"economic": 0.7, "operational": 0.3, "environmental": 0.8, "technical": 0.3, "functional": 0.4, "maintenance": 0.6, "misuse": 0.5}',
   '{"accounting": "straight-line"}',
   'Material value resists depreciation.'),
  ('softwareTechnology', 'البرمجيات والتقنية', 'Software & Technology',
   '{"economic": 1.3, "operational": 0.6, "environmental": 0.2, "technical": 1.7, "functional": 1.2, "maintenance": 0.8, "misuse": 0.4}',
   '{"accounting": "declining-balance", "technical": "declining-balance"}',
   'Rapid technical obsolescence.'),
  ('medicalEquipment', 'الأجهزة والمعدات الطبية', 'Medical Equipment',
   '{"economic": 1.1, "operational": 1.1, "environmental": 0.9, "technical": 1.4, "functional": 0.9, "maintenance": 1.2, "misuse": 0.9}',
   '{"accounting": "straight-line", "technical": "declining-balance"}',
   'Regulatory and technology obsolescence.'),
  ('educationalEquipment', 'التجهيزات التعليمية', 'Educational Equipment',
   '{"economic": 1.0, "operational": 1.0, "environmental": 0.9, "technical": 1.2, "functional": 0.8, "maintenance": 1.0, "misuse": 0.9}',
   '{"accounting": "straight-line"}',
   'Moderate usage and technology obsolescence.'),
  ('distressedAsset', 'الأصول المتعثرة', 'Distressed Assets',
   '{"economic": 1.4, "operational": 0.9, "environmental": 1.0, "technical": 1.1, "functional": 1.2, "maintenance": 1.3, "misuse": 1.0}',
   '{"accounting": "declining-balance"}',
   'Accelerated depreciation due to distress.'),
  ('tourismAsset', 'الأصول السياحية', 'Tourism Assets',
   '{"economic": 1.0, "operational": 1.1, "environmental": 1.1, "technical": 0.9, "functional": 1.0, "maintenance": 1.1, "misuse": 0.8}',
   '{"accounting": "straight-line"}',
   'Usage and location exposure matter.'),
  ('personalWealth', 'الثروة الشخصية', 'Personal Wealth',
   '{"economic": 1.0, "operational": 0.3, "environmental": 0.3, "technical": 0.6, "functional": 0.7, "maintenance": 0.4, "misuse": 0.4}',
   '{"accounting": "straight-line"}',
   'Portfolio-level depreciation assumptions.'),
  ('scrapSalvage', 'السكراب والخردة', 'Scrap & Salvage',
   '{"economic": 1.0, "operational": 0.5, "environmental": 0.8, "technical": 0.4, "functional": 0.5, "maintenance": 0.5, "misuse": 0.5}',
   '{"accounting": "straight-line"}',
   'Value approximates scrap/salvage value.'),
  ('maritimeAsset', 'الأصول البحرية', 'Maritime Assets',
   '{"economic": 1.0, "operational": 1.2, "environmental": 1.3, "technical": 1.0, "functional": 0.8, "maintenance": 1.2, "misuse": 1.0}',
   '{"accounting": "straight-line", "operational": "units-of-production"}',
   'Marine exposure and operating hours dominate.'),
  ('logisticsAsset', 'الأصول اللوجستية', 'Logistics Assets',
   '{"economic": 1.0, "operational": 1.2, "environmental": 1.0, "technical": 1.0, "functional": 0.9, "maintenance": 1.1, "misuse": 1.0}',
   '{"accounting": "straight-line", "operational": "units-of-production"}',
   'Throughput-based wear.'),
  ('fuelStation', 'محطات الوقود', 'Fuel Stations',
   '{"economic": 1.0, "operational": 1.1, "environmental": 1.2, "technical": 0.9, "functional": 0.9, "maintenance": 1.1, "misuse": 0.9}',
   '{"accounting": "straight-line"}',
   'Environmental and regulatory factors.'),
  ('beautyWellness', 'التجميل والصحة', 'Beauty & Wellness',
   '{"economic": 1.1, "operational": 1.0, "environmental": 0.8, "technical": 1.0, "functional": 1.1, "maintenance": 1.0, "misuse": 0.8}',
   '{"accounting": "straight-line"}',
   'Trend-driven functional obsolescence.'),
  ('giftsStationery', 'الهدايا والماليات', 'Gifts & Stationery',
   '{"economic": 1.1, "operational": 0.9, "environmental": 0.7, "technical": 0.9, "functional": 1.0, "maintenance": 0.8, "misuse": 0.7}',
   '{"accounting": "straight-line"}',
   'Retail-style depreciation.'),
  ('furnitureAsset', 'الأثاث المنزلي والمكتبي', 'Furniture Assets',
   '{"economic": 1.0, "operational": 1.0, "environmental": 0.9, "technical": 0.7, "functional": 0.9, "maintenance": 1.0, "misuse": 0.9}',
   '{"accounting": "straight-line"}',
   'Physical wear and minor obsolescence.'),
  ('retailBusiness', 'نشاط تجاري عام', 'Retail Business',
   '{"economic": 1.2, "operational": 1.0, "environmental": 0.7, "technical": 1.0, "functional": 1.1, "maintenance": 0.9, "misuse": 0.7}',
   '{"accounting": "straight-line"}',
   'Market-driven economic depreciation.')
ON CONFLICT (asset_class) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  factors = EXCLUDED.factors,
  methods = EXCLUDED.methods,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Index for fast lookup by asset class.
CREATE INDEX IF NOT EXISTS idx_depreciation_factors_asset_class
  ON public.depreciation_factors(asset_class);
