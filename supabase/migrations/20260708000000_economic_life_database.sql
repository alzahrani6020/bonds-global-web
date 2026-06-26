-- Economic Life Database
-- Central repository for asset life estimates used by BONDS Valuation Intelligence.

CREATE TABLE IF NOT EXISTS public.economic_life_database (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class text NOT NULL UNIQUE,
  name_ar text,
  name_en text,
  economic_life_years numeric NOT NULL DEFAULT 0,
  accounting_life_years numeric NOT NULL DEFAULT 0,
  technical_life_years numeric NOT NULL DEFAULT 0,
  design_life_years numeric NOT NULL DEFAULT 0,
  operational_life_years numeric NOT NULL DEFAULT 0,
  min_life_years numeric NOT NULL DEFAULT 0,
  max_life_years numeric NOT NULL DEFAULT 0,
  source text,
  notes text,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.economic_life_database IS 'Central asset life database for BONDS Valuation Intelligence';

-- Enable RLS
ALTER TABLE public.economic_life_database ENABLE ROW LEVEL SECURITY;

-- Everyone can read; only authenticated users with admin/editor role can write.
CREATE POLICY "Economic life is readable by everyone"
  ON public.economic_life_database
  FOR SELECT
  USING (true);

CREATE POLICY "Economic life is editable by admins"
  ON public.economic_life_database
  FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'editor')
  ));

-- Seed initial data for 35 asset classes.
INSERT INTO public.economic_life_database
  (asset_class, name_ar, name_en, economic_life_years, accounting_life_years, technical_life_years, design_life_years, operational_life_years, min_life_years, max_life_years, source, notes)
VALUES
  ('realEstate', 'العقارات', 'Real Estate', 50, 50, 60, 60, 50, 20, 100, 'BONDS Valuation Standards', 'Buildings and land improvements'),
  ('business', 'الشركات', 'Business', 10, 10, 12, 15, 10, 3, 30, 'BONDS Valuation Standards', 'Going concern enterprise'),
  ('factory', 'المصانع', 'Factory', 25, 20, 30, 35, 25, 10, 50, 'BONDS Valuation Standards', 'Manufacturing facilities'),
  ('machineryEquipment', 'الآلات والمعدات', 'Machinery & Equipment', 15, 10, 18, 20, 15, 5, 30, 'BONDS Valuation Standards', 'Industrial machinery'),
  ('vehiclesFleet', 'المركبات والأساطيل', 'Vehicles & Fleet', 10, 5, 12, 15, 10, 3, 20, 'BONDS Valuation Standards', 'Commercial vehicles'),
  ('agricultureFarms', 'الزراعة والمزارع', 'Agriculture & Farms', 20, 15, 25, 30, 20, 5, 50, 'BONDS Valuation Standards', 'Farms and agricultural land'),
  ('livestock', 'الثروة الحيوانية', 'Livestock', 5, 3, 8, 10, 5, 2, 15, 'BONDS Valuation Standards', 'Breeding and production animals'),
  ('naturalResourcesMining', 'الموارد الطبيعية والتعدين', 'Natural Resources & Mining', 20, 15, 25, 30, 20, 5, 50, 'BONDS Valuation Standards', 'Mines and reserves'),
  ('oilGas', 'النفط والغاز', 'Oil & Gas Assets', 20, 15, 25, 30, 20, 5, 50, 'BONDS Valuation Standards', 'Oil and gas fields'),
  ('infrastructure', 'البنية التحتية', 'Infrastructure', 40, 30, 50, 60, 40, 15, 100, 'BONDS Valuation Standards', 'Roads, utilities, concessions'),
  ('intellectualProperty', 'الملكية الفكرية', 'Intellectual Property', 10, 10, 12, 15, 10, 3, 25, 'BONDS Valuation Standards', 'IP and patents'),
  ('brandsTrademarks', 'العلامات التجارية', 'Brands & Trademarks', 15, 10, 18, 20, 15, 5, 30, 'BONDS Valuation Standards', 'Brand assets'),
  ('patents', 'براءات الاختراع', 'Patents', 12, 10, 15, 20, 12, 3, 25, 'BONDS Valuation Standards', 'Patented technology'),
  ('copyrightsContent', 'حقوق المؤلف والمحتوى', 'Copyrights & Content', 10, 10, 12, 15, 10, 2, 25, 'BONDS Valuation Standards', 'Content and media catalogs'),
  ('franchises', 'الامتيازات التجارية', 'Franchises', 10, 10, 12, 15, 10, 3, 25, 'BONDS Valuation Standards', 'Franchise rights'),
  ('licensesPermits', 'التراخيص والتصاريح', 'Licenses & Permits', 8, 5, 10, 15, 8, 1, 30, 'BONDS Valuation Standards', 'Regulatory licenses'),
  ('financialAssets', 'الأصول المالية', 'Financial Assets', 5, 5, 5, 5, 5, 1, 20, 'BONDS Valuation Standards', 'Listed securities'),
  ('cryptoDigital', 'العملات الرقمية والأصول الرقمية', 'Crypto & Digital Assets', 5, 5, 5, 5, 5, 1, 15, 'BONDS Valuation Standards', 'Crypto and digital tokens'),
  ('commodities', 'السلع', 'Commodities', 1, 1, 1, 1, 1, 0.25, 5, 'BONDS Valuation Standards', 'Physical commodities inventory'),
  ('artCollectibles', 'الفنون والمقتنيات', 'Art & Collectibles', 30, 30, 50, 100, 30, 10, 200, 'BONDS Valuation Standards', 'Art and collectible assets'),
  ('jewelryPreciousMetals', 'المجوهرات والمعادن الثمينة', 'Jewelry & Precious Metals', 30, 30, 50, 100, 30, 10, 200, 'BONDS Valuation Standards', 'Gold, jewelry, precious metals'),
  ('softwareTechnology', 'البرمجيات والتقنية', 'Software & Technology', 7, 5, 8, 10, 7, 2, 15, 'BONDS Valuation Standards', 'Software and SaaS assets'),
  ('medicalEquipment', 'الأجهزة والمعدات الطبية', 'Medical Equipment', 10, 7, 12, 15, 10, 3, 20, 'BONDS Valuation Standards', 'Medical devices'),
  ('educationalEquipment', 'التجهيزات التعليمية', 'Educational Equipment', 10, 7, 12, 15, 10, 3, 20, 'BONDS Valuation Standards', 'Education equipment'),
  ('distressedAsset', 'الأصول المتعثرة', 'Distressed Assets', 5, 3, 8, 10, 5, 1, 15, 'BONDS Valuation Standards', 'Distressed or non-performing assets'),
  ('tourismAsset', 'الأصول السياحية', 'Tourism Assets', 30, 25, 35, 40, 30, 10, 60, 'BONDS Valuation Standards', 'Hotels, resorts, attractions'),
  ('personalWealth', 'الثروة الشخصية', 'Personal Wealth', 10, 10, 12, 15, 10, 3, 30, 'BONDS Valuation Standards', 'Personal and family wealth portfolio'),
  ('scrapSalvage', 'السكراب والخردة', 'Scrap & Salvage', 1, 1, 1, 1, 1, 0.25, 3, 'BONDS Valuation Standards', 'Scrap and salvage materials'),
  ('maritimeAsset', 'الأصول البحرية', 'Maritime Assets', 25, 20, 30, 35, 25, 10, 50, 'BONDS Valuation Standards', 'Vessels, ships, boats'),
  ('logisticsAsset', 'الأصول اللوجستية', 'Logistics Assets', 20, 15, 25, 30, 20, 5, 40, 'BONDS Valuation Standards', 'Warehouses and distribution centers'),
  ('fuelStation', 'محطات الوقود', 'Fuel Stations', 20, 15, 25, 30, 20, 5, 40, 'BONDS Valuation Standards', 'Petrol stations'),
  ('beautyWellness', 'التجميل والصحة', 'Beauty & Wellness', 7, 5, 10, 12, 7, 3, 15, 'BONDS Valuation Standards', 'Salons, spas, wellness centers'),
  ('giftsStationery', 'الهدايا والماليات', 'Gifts & Stationery', 7, 5, 10, 12, 7, 3, 15, 'BONDS Valuation Standards', 'Gift and stationery shops'),
  ('furnitureAsset', 'الأثاث المنزلي والمكتبي', 'Furniture Assets', 10, 7, 12, 15, 10, 3, 20, 'BONDS Valuation Standards', 'Home and office furniture'),
  ('retailBusiness', 'نشاط تجاري عام', 'Retail Business', 7, 5, 10, 12, 7, 3, 20, 'BONDS Valuation Standards', 'General retail commercial activity')
ON CONFLICT (asset_class) DO UPDATE SET
  economic_life_years = EXCLUDED.economic_life_years,
  accounting_life_years = EXCLUDED.accounting_life_years,
  technical_life_years = EXCLUDED.technical_life_years,
  design_life_years = EXCLUDED.design_life_years,
  operational_life_years = EXCLUDED.operational_life_years,
  min_life_years = EXCLUDED.min_life_years,
  max_life_years = EXCLUDED.max_life_years,
  source = EXCLUDED.source,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Index for fast lookup by asset class.
CREATE INDEX IF NOT EXISTS idx_economic_life_asset_class
  ON public.economic_life_database(asset_class);
