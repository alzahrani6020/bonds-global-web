-- ============================================
-- Pricing & Commission Settings
-- Adds configurable prices, VAT, and commission rates to site_settings
-- ============================================

INSERT INTO public.site_settings (key, value) VALUES
  -- Subscription prices (SAR, VAT included)
  ('price_pro_sar', '82'),
  ('price_enterprise_sar', '212'),
  ('price_pro_base_sar', '71'),
  ('price_enterprise_base_sar', '184'),

  -- One-off product prices (SAR, VAT included)
  ('oneoff_ai_report_price_sar', '49'),
  ('oneoff_expert_review_price_sar', '149'),
  ('oneoff_approved_report_price_sar', '249'),

  -- One-off base prices (before VAT)
  ('oneoff_ai_report_base_sar', '43'),
  ('oneoff_expert_review_base_sar', '130'),
  ('oneoff_approved_report_base_sar', '217'),

  -- Tax & commissions
  ('vat_rate_percent', '15'),
  ('advisor_default_commission_rate', '25'),

  -- Moyasar/manual bank transfer prices (usually same as subscription)
  ('moyasar_pro_price_sar', '82'),
  ('moyasar_enterprise_price_sar', '212')
ON CONFLICT (key) DO NOTHING;
