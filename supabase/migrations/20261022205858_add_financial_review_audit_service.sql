-- Add financial review and audit to the published service catalog.
-- Mirrors production migration version 20261022205858.

insert into public.service_catalog
(code,category_code,name_ar,name_en,short_description_ar,short_description_en,delivery_type,status,is_active,sort_order,default_route_ar,default_route_en,metadata)
values
(
  'financial_review_audit',
  'financial_advisory',
  'المراجعة والتدقيق المالي',
  'Financial Review & Audit',
  'مراجعة القيود والسجلات والأرصدة والتسويات والقوائم المالية، واكتشاف الأخطاء والفروقات ومواطن الضعف الرقابي.',
  'Review journal entries, ledgers, balances, reconciliations and financial statements to identify errors, discrepancies and control weaknesses.',
  'hybrid',
  'published',
  true,
  30,
  null,
  null,
  '{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb
)
on conflict(code) do update set
  category_code=excluded.category_code,
  name_ar=excluded.name_ar,
  name_en=excluded.name_en,
  short_description_ar=excluded.short_description_ar,
  short_description_en=excluded.short_description_en,
  delivery_type=excluded.delivery_type,
  status='published',
  is_active=true,
  sort_order=excluded.sort_order,
  metadata=public.service_catalog.metadata || excluded.metadata,
  updated_at=now();
