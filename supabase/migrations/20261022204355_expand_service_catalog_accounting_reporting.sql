-- Expand the published service catalog with accounting and financial reporting services.
-- This migration mirrors the production migration version 20261022204355.
-- Idempotent by service code; no generated IDs are referenced.

insert into public.service_catalog
(code, category_code, name_ar, name_en, short_description_ar, short_description_en, delivery_type, status, is_active, sort_order, default_route_ar, default_route_en, metadata)
values
('daily_journal_entries','financial_advisory','القيود اليومية','Daily Journal Entries','إعداد وتسجيل القيود اليومية المحاسبية ومراجعة توازنها.','Prepare and record daily journal entries and review debit-credit balance.','advisory','published',true,11,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('general_ledger','financial_advisory','دفتر الأستاذ العام','General Ledger','ترحيل ومراجعة الحركات والأرصدة على حسابات دفتر الأستاذ العام.','Post and review transactions and balances across general ledger accounts.','advisory','published',true,12,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('trial_balance','financial_advisory','ميزان المراجعة','Trial Balance','إعداد ومراجعة ميزان المراجعة والتحقق من توازن الأرصدة.','Prepare and review the trial balance and verify account balances.','advisory','published',true,13,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('accounting_adjustments','financial_advisory','التسويات المحاسبية','Accounting Adjustments','إعداد قيود التسوية والاستحقاقات والمقدمات والمخصصات اللازمة.','Prepare adjusting entries, accruals, prepayments and required provisions.','advisory','published',true,14,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('financial_closing','financial_advisory','الإقفال الشهري والسنوي','Monthly & Annual Closing','تنفيذ ومراجعة إجراءات الإقفال المالي الشهري والسنوي.','Perform and review monthly and annual financial closing procedures.','advisory','published',true,15,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('financial_statements','financial_advisory','إعداد القوائم المالية','Financial Statements Preparation','إعداد حزمة القوائم المالية الرئيسية بصورة مترابطة ومتسقة.','Prepare the core financial statements as an integrated and consistent package.','advisory','published',true,16,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('income_statement','financial_advisory','إعداد قائمة الدخل','Income Statement Preparation','إعداد قائمة الدخل وتحليل الإيرادات والتكاليف والنتيجة التشغيلية.','Prepare the income statement and analyze revenue, costs and operating result.','advisory','published',true,17,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('statement_financial_position','financial_advisory','إعداد قائمة المركز المالي','Statement of Financial Position','إعداد قائمة المركز المالي ومراجعة الأصول والالتزامات وحقوق الملكية.','Prepare the statement of financial position and review assets, liabilities and equity.','advisory','published',true,18,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('cash_flow_statement','financial_advisory','إعداد قائمة التدفقات النقدية','Cash Flow Statement','إعداد قائمة التدفقات النقدية وربطها بالحركة التشغيلية والاستثمارية والتمويلية.','Prepare the cash flow statement across operating, investing and financing activities.','advisory','published',true,19,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('changes_in_equity','financial_advisory','قائمة التغيرات في حقوق الملكية','Statement of Changes in Equity','إعداد حركة رأس المال والاحتياطيات والأرباح المحتجزة وحقوق الملكية.','Prepare movements in capital, reserves, retained earnings and equity.','advisory','published',true,21,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('accounts_receivable','financial_advisory','حسابات العملاء والذمم المدينة','Accounts Receivable','مراجعة أرصدة العملاء والذمم المدينة وحركة التحصيل.','Review customer balances, receivables and collection movements.','advisory','published',true,22,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('accounts_payable','financial_advisory','حسابات الموردين والذمم الدائنة','Accounts Payable','مراجعة أرصدة الموردين والذمم الدائنة والاستحقاقات.','Review supplier balances, payables and due obligations.','advisory','published',true,23,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('bank_reconciliation','financial_advisory','التسويات البنكية','Bank Reconciliation','مطابقة الأرصدة البنكية مع السجلات وتحديد الفروقات والتسويات المطلوبة.','Reconcile bank balances with records and identify required adjustments.','advisory','published',true,24,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('cost_centers','financial_advisory','مراكز التكلفة','Cost Centers','إعداد ومراجعة توزيع التكاليف على مراكز التكلفة والفروع والمشروعات.','Set up and review cost allocation across cost centers, branches and projects.','advisory','published',true,25,null,null,'{"group":"accounting_reporting","source":"service_catalog_expansion_20261022"}'::jsonb),
('expense_revenue_analysis','financial_advisory','تحليل المصروفات والإيرادات','Expense & Revenue Analysis','تحليل هيكل الإيرادات والمصروفات وتحديد مصادر التغير.','Analyze revenue and expense structures and identify drivers of change.','hybrid','published',true,26,null,null,'{"group":"financial_analysis","source":"service_catalog_expansion_20261022"}'::jsonb),
('variance_analysis','financial_advisory','تحليل الانحرافات','Variance Analysis','تحليل الانحرافات بين الفعلي والموازنة أو الفترات المقارنة.','Analyze variances between actuals, budget and comparative periods.','hybrid','published',true,27,null,null,'{"group":"financial_analysis","source":"service_catalog_expansion_20261022"}'::jsonb),
('financial_ratios','financial_advisory','النسب والمؤشرات المالية','Financial Ratios & KPIs','احتساب وتحليل النسب والمؤشرات المالية الرئيسية.','Calculate and analyze key financial ratios and performance indicators.','hybrid','published',true,28,null,null,'{"group":"financial_analysis","source":"service_catalog_expansion_20261022"}'::jsonb),
('profitability_analysis','financial_advisory','تحليل الربحية','Profitability Analysis','تحليل هوامش الربح ومصادر الربحية حسب النشاط أو المشروع.','Analyze margins and profitability drivers by activity or project.','hybrid','published',true,29,null,null,'{"group":"financial_analysis","source":"service_catalog_expansion_20261022"}'::jsonb),
('liquidity_analysis','financial_advisory','تحليل السيولة','Liquidity Analysis','تحليل السيولة والقدرة على الوفاء بالالتزامات قصيرة الأجل.','Analyze liquidity and the ability to meet short-term obligations.','hybrid','published',true,31,null,null,'{"group":"financial_analysis","source":"service_catalog_expansion_20261022"}'::jsonb)
on conflict (code) do update set
  category_code = excluded.category_code,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  short_description_ar = excluded.short_description_ar,
  short_description_en = excluded.short_description_en,
  delivery_type = excluded.delivery_type,
  status = 'published',
  is_active = true,
  sort_order = excluded.sort_order,
  default_route_ar = excluded.default_route_ar,
  default_route_en = excluded.default_route_en,
  metadata = public.service_catalog.metadata || excluded.metadata,
  updated_at = now();
