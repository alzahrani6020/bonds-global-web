begin;

-- Scientific research is a distinct studies workspace service from market research.
-- Market research answers demand and competition. This service captures methodology,
-- hypothesis and evidence sources, then executes through the governed orchestrator.

insert into public.service_catalog(
  code,category_code,group_code,name_ar,name_en,
  short_description_ar,short_description_en,
  delivery_type,status,is_active,sort_order,
  default_route_ar,default_route_en,metadata,updated_at
)
values (
  'scientific_research',
  'business_market',
  'business_market',
  'البحث العلمي',
  'Scientific Research',
  'تصميم وتنفيذ بحث علمي بمنهجية وفرضية ومصادر أدلة، مستقل عن دراسة السوق التجارية.',
  'Design and run scientific research with methodology, hypothesis and evidence sources, separate from commercial market studies.',
  'hybrid',
  'published',
  true,
  125,
  '/my-bonds/workspace/?service=scientific_research',
  '/en/my-bonds/workspace/?service=scientific_research',
  '{"source":"studies_workspace","workspace":"studies-valuation","distinct_from":"market_research"}'::jsonb,
  now()
)
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
  default_route_ar=excluded.default_route_ar,
  default_route_en=excluded.default_route_en,
  metadata=public.service_catalog.metadata || excluded.metadata,
  updated_at=now();

insert into public.service_execution_profiles(
  service_id,execution_status,execution_mode,primary_action,
  orchestrator_intent,tool_id,ai_mode,research_mode,token_mode,
  assistant_enabled,version,is_active,metadata,updated_at
)
select
  s.id,
  'fully_orchestrated',
  'capability_plan',
  'orchestrator_run',
  'scientific_research',
  null,
  'assist',
  'automatic',
  'as_required',
  true,
  coalesce(p.version,0)+1,
  true,
  '{"source":"studies_workspace","intent":"scientific_research"}'::jsonb,
  now()
from public.service_catalog s
left join public.service_execution_profiles p on p.service_id=s.id
where s.code='scientific_research'
on conflict(service_id) do update set
  execution_status=excluded.execution_status,
  execution_mode=excluded.execution_mode,
  primary_action=excluded.primary_action,
  orchestrator_intent=excluded.orchestrator_intent,
  tool_id=null,
  ai_mode='assist',
  research_mode='automatic',
  token_mode='as_required',
  assistant_enabled=true,
  version=excluded.version,
  is_active=true,
  metadata=public.service_execution_profiles.metadata || excluded.metadata,
  updated_at=now();

insert into public.service_capability_map(service_id,capability_code,engine_route,run_order,is_required)
select s.id,v.capability,v.route,v.run_order,v.required
from public.service_catalog s
join (values
  ('market_intelligence','/api/v3/investment-intelligence',10,false),
  ('research_intelligence_verify','/api/v3/intelligence',20,false)
) as v(capability,route,run_order,required) on true
where s.code='scientific_research'
on conflict(service_id,capability_code) do update set
  engine_route=excluded.engine_route,
  run_order=excluded.run_order,
  is_required=excluded.is_required;

insert into public.service_goal_map(service_id,goal_code,priority)
select s.id,v.goal_code,v.priority
from public.service_catalog s
join (values
  ('new_market',10),
  ('expansion',20),
  ('feasibility',30)
) as v(goal_code,priority) on true
where s.code='scientific_research'
on conflict(service_id,goal_code) do update set priority=excluded.priority;

insert into public.service_procedures(service_id,title_ar,title_en,description_ar,description_en,procedure_type,sort_order)
select s.id,v.title_ar,v.title_en,v.description_ar,v.description_en,v.kind,v.ord
from public.service_catalog s
join (values
  ('تحديد مشكلة البحث والفرضية','Define the research problem and hypothesis','صياغة السؤال العلمي وحدود الدراسة.','Frame the scientific question and study boundary.','manual',10),
  ('اختيار المنهجية والعينة','Select methodology and sample','تحديد المنهج الكمي أو النوعي ومصادر الأدلة.','Choose quantitative or qualitative method and evidence sources.','manual',20),
  ('جمع الأدلة وتحليلها','Collect and analyze evidence','مراجعة الأدبيات والبيانات الرسمية والنتائج.','Review literature, official data and findings.','automated',30),
  ('صياغة النتائج والتوصيات','Draft findings and recommendations','تسليم موجز بحثي قابل للاستخدام في القرار.','Deliver a research brief usable in the decision.','workflow',40)
) as v(title_ar,title_en,description_ar,description_en,kind,ord) on true
where s.code='scientific_research'
and not exists (
  select 1 from public.service_procedures p
  where p.service_id=s.id and p.title_ar=v.title_ar
);

insert into public.service_requirements(service_id,requirement_type,label_ar,label_en,is_required,sort_order)
select s.id,v.kind,v.label_ar,v.label_en,v.req,v.ord
from public.service_catalog s
join (values
  ('data','مشكلة بحث واضحة','A clear research problem',true,10),
  ('data','المنهجية المقترحة','Proposed methodology',true,20),
  ('document','مصادر أو دراسات سابقة إن وجدت','Prior sources or studies if available',false,30)
) as v(kind,label_ar,label_en,req,ord) on true
where s.code='scientific_research'
and not exists (
  select 1 from public.service_requirements r
  where r.service_id=s.id and r.label_ar=v.label_ar
);

insert into public.service_deliverables(service_id,code,name_ar,name_en,deliverable_type,sort_order)
select s.id,v.code,v.name_ar,v.name_en,'report',v.ord
from public.service_catalog s
join (values
  ('research_brief','موجز البحث العلمي','Scientific research brief',10),
  ('methodology_note','مذكرة المنهجية والأدلة','Methodology and evidence note',20),
  ('findings','النتائج والتوصيات','Findings and recommendations',30)
) as v(code,name_ar,name_en,ord) on true
where s.code='scientific_research'
on conflict(service_id,code) do update set
  name_ar=excluded.name_ar,
  name_en=excluded.name_en,
  sort_order=excluded.sort_order;

insert into public.service_dependencies(service_id,depends_on_service_id,dependency_type)
select src.id,dst.id,v.kind
from (values
  ('scientific_research','market_research','recommended'),
  ('scientific_research','feasibility_studies','next')
) as v(src_code,dst_code,kind)
join public.service_catalog src on src.code=v.src_code
join public.service_catalog dst on dst.code=v.dst_code
on conflict(service_id,depends_on_service_id,dependency_type) do nothing;

commit;
