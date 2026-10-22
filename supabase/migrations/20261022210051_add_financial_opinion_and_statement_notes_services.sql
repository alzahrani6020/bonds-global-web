-- Add financial/accounting opinion and notes to financial statements services.
-- Mirrors production migration version 20261022210051.

insert into public.service_catalog
(code,category_code,name_ar,name_en,short_description_ar,short_description_en,delivery_type,status,is_active,sort_order,default_route_ar,default_route_en,metadata)
values
(
  'financial_accounting_opinion',
  'financial_advisory',
  'الرأي المالي والمحاسبي',
  'Financial & Accounting Opinion',
  'إعداد رأي مهني مالي ومحاسبي مبني على البيانات والمستندات المتاحة، دون أن يحل محل تقرير مراجع حسابات قانوني مستقل عندما يكون مطلوباً نظاماً.',
  'Prepare a professional financial and accounting opinion based on available data and documents; it does not replace an independent statutory auditor report where legally required.',
  'advisory',
  'published',
  true,
  32,
  null,
  null,
  '{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb
),
(
  'financial_statement_notes',
  'financial_advisory',
  'الإيضاحات المتممة للقوائم المالية',
  'Notes to the Financial Statements',
  'إعداد وتنظيم الإيضاحات والسياسات والمعلومات المساندة المتممة للقوائم المالية وربطها ببنود القوائم ذات الصلة.',
  'Prepare and organize disclosures, accounting policies and supporting information accompanying the financial statements.',
  'advisory',
  'published',
  true,
  33,
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
