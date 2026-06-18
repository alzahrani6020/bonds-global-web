-- Bonds V3 — Data Engine defaults & missing metric definitions
-- Ensures all metrics produced by the benchmark/pricing engines are registered.

INSERT INTO public.metric_definitions (code, category, name_ar, name_en, unit, data_type, default_confidence_method, description, sort_order)
VALUES
  ('profit_margin_min', 'market', 'هامش الربح الأدنى', 'Profit Margin Min', '%', 'percent', 'estimated', 'أدنى هامش ربح متوقع للنشاط', 25),
  ('profit_margin_avg', 'market', 'هامش الربح المتوسط', 'Profit Margin Avg', '%', 'percent', 'estimated', 'متوسط هامش الربح المتوقع للنشاط', 26),
  ('profit_margin_max', 'market', 'هامش الربح الأعلى', 'Profit Margin Max', '%', 'percent', 'estimated', 'أعلى هامش ربح متوقع للنشاط', 27),
  ('monthly_operation_cost_min', 'pricing', 'تكلفة التشغيل الشهرية الأدنى', 'Monthly Operation Cost Min', 'SAR', 'currency', 'estimated', 'أدنى تكلفة تشغيل شهرية للنشاط', 29),
  ('monthly_operation_cost_avg', 'pricing', 'تكلفة التشغيل الشهرية المتوسطة', 'Monthly Operation Cost Avg', 'SAR', 'currency', 'estimated', 'متوسط تكلفة التشغيل الشهرية للنشاط', 30),
  ('monthly_operation_cost_max', 'pricing', 'تكلفة التشغيل الشهرية الأعلى', 'Monthly Operation Cost Max', 'SAR', 'currency', 'estimated', 'أعلى تكلفة تشغيل شهرية للنشاط', 31),
  ('risk_score', 'market', 'درجة المخاطرة', 'Risk Score', 'score', 'number', 'estimated', 'درجة مخاطرة النشاط في المدينة (0-100)', 32)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  unit = EXCLUDED.unit,
  data_type = EXCLUDED.data_type,
  default_confidence_method = EXCLUDED.default_confidence_method,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
