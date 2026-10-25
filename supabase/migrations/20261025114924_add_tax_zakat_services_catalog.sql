-- Add Saudi Arabia zakat and tax services to the governed service catalog.
-- Production migration version: 20261025114924.
-- All services are request-only and require professional review.

insert into public.service_categories
(code,name_ar,name_en,description,sort_order,is_active,metadata)
values
('tax_zakat','الخدمات الزكوية والضريبية','Zakat & Tax Services',
 'Saudi Arabia zakat and tax advisory, compliance and dispute-support services.',50,true,
 '{"surface":"service_discovery","jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true}'::jsonb)
on conflict(code) do update set
 name_ar=excluded.name_ar,
 name_en=excluded.name_en,
 description=excluded.description,
 sort_order=excluded.sort_order,
 is_active=true,
 metadata=public.service_categories.metadata || excluded.metadata,
 updated_at=now();

insert into public.service_groups
(code,category_code,name_ar,name_en,description_ar,description_en,sort_order,is_active,metadata)
values
('zakat_services','tax_zakat','الزكاة','Zakat','الإقرارات والوعاء والربوط والشهادات الزكوية.','Zakat returns, base review, assessments and certificates.',10,true,'{"jurisdiction":"SA"}'),
('vat_services','tax_zakat','ضريبة القيمة المضافة','Value Added Tax','التسجيل والإقرارات والاسترداد ومراجعة الالتزام.','VAT registration, returns, refunds and compliance review.',20,true,'{"jurisdiction":"SA"}'),
('direct_tax_withholding','tax_zakat','ضريبة الدخل والاستقطاع','Income & Withholding Tax','ضريبة الاستقطاع وضريبة الدخل للمنشآت الأجنبية.','Withholding tax and income tax for foreign establishments.',30,true,'{"jurisdiction":"SA"}'),
('transaction_excise_tax','tax_zakat','ضرائب التصرفات والانتقائية','Transaction & Excise Taxes','ضريبة التصرفات العقارية والضريبة الانتقائية.','Real estate transaction tax and excise tax.',40,true,'{"jurisdiction":"SA"}'),
('e_invoicing_tax','tax_zakat','الفوترة الإلكترونية','E-Invoicing','فحص الجاهزية والالتزام بالفوترة الإلكترونية.','E-invoicing readiness and compliance review.',50,true,'{"jurisdiction":"SA"}'),
('tax_audit_disputes','tax_zakat','الفحص والاعتراضات والمنازعات','Audit, Objections & Disputes','الاستعداد للفحص والاعتراضات والمنازعات ومراجعة الغرامات.','Audit readiness, objections, disputes and penalty review.',60,true,'{"jurisdiction":"SA"}'),
('tax_compliance_health','tax_zakat','الامتثال والمراجعة الشاملة','Compliance & Health Check','مراجعة شاملة للالتزام والمخاطر الزكوية والضريبية.','Comprehensive zakat and tax compliance and risk health check.',70,true,'{"jurisdiction":"SA"}')
on conflict(code) do update set
 category_code=excluded.category_code,
 name_ar=excluded.name_ar,
 name_en=excluded.name_en,
 description_ar=excluded.description_ar,
 description_en=excluded.description_en,
 sort_order=excluded.sort_order,
 is_active=true,
 metadata=public.service_groups.metadata || excluded.metadata,
 updated_at=now();

insert into public.service_catalog
(code,category_code,group_code,name_ar,name_en,short_description_ar,short_description_en,delivery_type,status,is_active,sort_order,default_route_ar,default_route_en,metadata)
values
('zakat_return_preparation','tax_zakat','zakat_services','إعداد ومراجعة الإقرار الزكوي','Zakat Return Preparation & Review','إعداد ومراجعة الإقرار الزكوي وربطه بالبيانات المالية قبل التقديم.','Prepare and review the zakat return against underlying financial data before filing.','advisory','published',true,501,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('zakat_base_review','tax_zakat','zakat_services','مراجعة الوعاء الزكوي','Zakat Base Review','احتساب ومراجعة عناصر الوعاء الزكوي والتعديلات المؤثرة عليه.','Calculate and review zakat-base components and relevant adjustments.','advisory','published',true,502,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('zakat_assessment_objection','tax_zakat','zakat_services','مراجعة الربط والاعتراض الزكوي','Zakat Assessment & Objection Review','تحليل الربط الزكوي وتجهيز ملف الاعتراض والمستندات المؤيدة.','Analyze zakat assessments and prepare objection support files and evidence.','advisory','published',true,503,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('zakat_certificate_support','tax_zakat','zakat_services','دعم الشهادات الزكوية','Zakat Certificate Support','مراجعة متطلبات إصدار أو تجديد الشهادة الزكوية ومعالجة النواقص.','Review requirements for issuing or renewing zakat certificates and resolve gaps.','advisory','published',true,504,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('vat_registration','tax_zakat','vat_services','التسجيل وتعديل التسجيل في ضريبة القيمة المضافة','VAT Registration & Amendments','دعم التسجيل أو تعديل بيانات التسجيل أو دراسة إلغاء التسجيل عند انطباق الشروط.','Support VAT registration, registration amendments and deregistration assessment where applicable.','advisory','published',true,511,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('vat_return_preparation','tax_zakat','vat_services','إعداد ومراجعة إقرار ضريبة القيمة المضافة','VAT Return Preparation & Review','إعداد ومراجعة إقرار القيمة المضافة ومطابقة المدخلات والمخرجات والتسويات.','Prepare and review VAT returns, input/output tax and adjustments.','advisory','published',true,512,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('vat_refund_review','tax_zakat','vat_services','مراجعة طلب استرداد ضريبة القيمة المضافة','VAT Refund Review','مراجعة أهلية ومكونات طلب الاسترداد وتجهيز المستندات الداعمة.','Review refund eligibility and components and prepare supporting documentation.','advisory','published',true,513,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('vat_compliance_review','tax_zakat','vat_services','مراجعة الالتزام بضريبة القيمة المضافة','VAT Compliance Review','فحص المعالجة الضريبية والفواتير والتسويات واكتشاف الفروقات قبل الفحص.','Review VAT treatment, invoices and adjustments to identify gaps before audit.','advisory','published',true,514,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('withholding_tax_return','tax_zakat','direct_tax_withholding','ضريبة الاستقطاع','Withholding Tax','تحديد المعاملات الخاضعة واحتساب ومراجعة إقرارات ضريبة الاستقطاع.','Identify taxable payments and calculate and review withholding-tax returns.','advisory','published',true,521,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('foreign_entity_income_tax','tax_zakat','direct_tax_withholding','ضريبة الدخل للمنشآت الأجنبية','Foreign Establishment Income Tax','إعداد ومراجعة الالتزامات والإقرارات الضريبية للمنشآت الأجنبية وفق الحالة.','Prepare and review income-tax obligations and returns for foreign establishments as applicable.','advisory','published',true,522,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('real_estate_transaction_tax','tax_zakat','transaction_excise_tax','ضريبة التصرفات العقارية','Real Estate Transaction Tax','دراسة خضوع التصرف واحتساب الضريبة ومراجعة حالات الاستثناء قبل الإجراء.','Assess transaction scope, calculate RETT and review applicable exemptions before execution.','advisory','published',true,531,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('excise_tax_compliance','tax_zakat','transaction_excise_tax','الضريبة الانتقائية','Excise Tax Compliance','مراجعة التسجيل والإقرارات والالتزام والتسويات المتعلقة بالضريبة الانتقائية.','Review excise registration, returns, compliance and adjustments.','advisory','published',true,532,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('e_invoicing_compliance','tax_zakat','e_invoicing_tax','مراجعة الالتزام بالفوترة الإلكترونية','E-Invoicing Compliance Review','فحص الفواتير والإشعارات ومتطلبات الجاهزية والربط والالتزام بالفوترة الإلكترونية.','Review invoices, notes, readiness, integration and e-invoicing compliance requirements.','advisory','published',true,541,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('tax_audit_readiness','tax_zakat','tax_audit_disputes','الاستعداد للفحص الزكوي والضريبي','Zakat & Tax Audit Readiness','مراجعة الملفات والإقرارات والمطابقات وتجهيز المنشأة قبل الفحص.','Review records, returns and reconciliations and prepare the entity for audit.','advisory','published',true,551,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('tax_objection_dispute_support','tax_zakat','tax_audit_disputes','الاعتراضات والمنازعات الزكوية والضريبية','Zakat & Tax Objection and Dispute Support','تحليل القرارات وتجهيز مذكرة الاعتراض والأسانيد وملف التسوية أو المنازعة.','Analyze decisions and prepare objection, settlement or dispute-support files.','advisory','published',true,552,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('tax_penalty_review','tax_zakat','tax_audit_disputes','مراجعة المخالفات والغرامات الزكوية والضريبية','Zakat & Tax Penalty Review','تحليل المخالفات والغرامات وأسبابها وخيارات المعالجة أو الاعتراض المتاحة.','Analyze penalties, root causes and available remediation or objection paths.','advisory','published',true,553,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}'),
('tax_health_check','tax_zakat','tax_compliance_health','المراجع الزكوي والضريبي الشامل','Zakat & Tax Health Check','مراجعة شاملة للإقرارات والسجلات والمطابقات والمخاطر والنواقص قبل التقديم أو الفحص.','Comprehensive review of returns, records, reconciliations, risks and gaps before filing or audit.','advisory','published',true,561,null,null,'{"jurisdiction":"SA","regulator":"ZATCA","professional_review_required":true,"automation_policy":"request_only"}')
on conflict(code) do update set
 category_code=excluded.category_code,
 group_code=excluded.group_code,
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

insert into public.service_execution_profiles
(service_id,execution_status,execution_mode,primary_action,orchestrator_intent,tool_id,ai_mode,research_mode,token_mode,assistant_enabled,version,is_active,metadata)
select id,'request_only','request_only',null,null,null,'none','none','none',true,1,true,
       '{"professional_review_required":true,"jurisdiction":"SA","automation_policy":"request_only"}'::jsonb
from public.service_catalog
where category_code='tax_zakat'
on conflict(service_id) do update set
 execution_status='request_only',
 execution_mode='request_only',
 primary_action=null,
 orchestrator_intent=null,
 tool_id=null,
 ai_mode='none',
 research_mode='none',
 token_mode='none',
 assistant_enabled=true,
 is_active=true,
 metadata=public.service_execution_profiles.metadata || excluded.metadata,
 updated_at=now();

insert into public.service_country_map
(service_id,country_code,availability_status,availability_reason_ar,availability_reason_en,priority,metadata)
select
 s.id,
 c.country_code,
 case when c.country_code='SA' then 'available' else 'unavailable' end,
 case when c.country_code='SA' then null else 'الخدمة الحالية مرتبطة بالأنظمة الزكوية والضريبية في المملكة العربية السعودية.' end,
 case when c.country_code='SA' then null else 'This service currently applies to Saudi Arabia zakat and tax rules.' end,
 10,
 '{"jurisdiction":"SA","regulator":"ZATCA"}'::jsonb
from public.service_catalog s
cross join public.country_profiles c
where s.category_code='tax_zakat'
on conflict(service_id,country_code) do update set
 availability_status=excluded.availability_status,
 availability_reason_ar=excluded.availability_reason_ar,
 availability_reason_en=excluded.availability_reason_en,
 priority=excluded.priority,
 metadata=public.service_country_map.metadata || excluded.metadata,
 updated_at=now();
