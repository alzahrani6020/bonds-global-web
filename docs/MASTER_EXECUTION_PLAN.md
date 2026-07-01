# BONDS MASTER EXECUTION PLAN

> **الإصدار:** 1.0-draft  
> **الحالة:** خطة تنفيذ رئيسية — لا تحتوي على كود  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **المراجع الرسمية:**
> - `docs/standards/01_ARCHITECTURE_STANDARD.md` … `10_PERFORMANCE_STANDARD.md`
> - `docs/architecture/01_ECONOMIC_BRAIN.md` … `12_GLOBAL_PLATFORM_ROADMAP.md`
> - `docs/architecture/ARCHITECTURE_CONFLICTS.md`
> - `docs/intelligence/01_LIVE_INTELLIGENCE_PLATFORM.md` … `10_WORLD_CLASS_PLATFORM_CHECKLIST.md`
> - `docs/intelligence/INTELLIGENCE_CONFLICTS.md`
> - `docs/BONDS_SYSTEM_AUDIT.md`
> - `docs/DEPENDENCY_GRAPH.md`
> - `docs/IMPLEMENTATION_ROADMAP.md`

---

## ملخص تنفيذي

هذه الوثيقة هي الخطة التنفيذية الرئيسية للانتقال من مرحلة التصميم إلى مرحلة التنفيذ في مشروع BONDS. تحتوي على:

1. **Architecture Validation Report** — مراجعة شاملة للوثائق والنظام الحالي.
2. **Dependency Graph** — خريطة العلاقات بين جميع المكونات.
3. **Execution Roadmap** — 20 Sprint مستقل، كل Sprint ينتج نظاماً يعمل.
4. **Migration Strategy** — خطة نقل النظام الحالي بدون توقف أو فقدان.
5. **Rollback Strategy** — خطة رجوع سريعة.
6. **Testing Strategy** — استراتيجية اختبار متكاملة.
7. **Quality Gates** — بوابات جودة بين المراحل.
8. **Technical Debt Plan** — خطة معالجة الديون التقنية.
9. **Risk Register** — سجل المخاطر.
10. **Definition of Done** — تعريف دقيق لاكتمال كل مرحلة.

> **ملاحظة إلزامية:** لا يبدأ التنفيذ الفعلي إلا بعد اعتماد هذه الوثيقة.

---

## منهجية المراجعة

تمت مراجعة الوثائق التالية:

- `docs/BONDS_CONSTITUTION.md`
- `docs/standards/*.md`
- `docs/architecture/*.md`
- `docs/intelligence/*.md`
- `docs/BONDS_SYSTEM_AUDIT.md`
- `docs/DEPENDENCY_GRAPH.md`
- `docs/IMPLEMENTATION_ROADMAP.md`

الهدف من المراجعة:

- اكتشاف التعارضات.
- اكتشاف التكرار.
- اكتشاف المحركات غير المترابطة.
- اكتشاف المحركات التي تعتمد على محركات غير موجودة.
- اكتشاف الوثائق غير القابلة للتنفيذ.
- اكتشاف التعارض مع النظام الحالي.

---

# المرحلة الأولى — Architecture Validation Report

## 1.1 التعارضات بين الوثائق

| التعارض | الوثائق المعنية | الوصف | الحل المقترح | الأولوية |
|---|---|---|---|---|
| **C-001 — تداخل Knowledge Graph و Economic Knowledge Cloud** | `architecture/02_KNOWLEDGE_GRAPH.md` + `intelligence/03_ECONOMIC_KNOWLEDGE_CLOUD.md` | كلاهما يتحدث عن المعرفة. | Knowledge Graph = بنية العلاقات؛ Economic Knowledge Cloud = محتوى المعرفة. يجب توضيح الحدود. | Medium |
| **C-002 — تداخل Decision Memory و Self-Learning Platform** | `architecture/07_DECISION_MEMORY.md` + `intelligence/08_SELF_LEARNING_PLATFORM.md` | كلاهما يتعلم من النتائج. | Decision Memory = تخزين القرارات والمقارنات؛ Self-Learning = تحديث النماذج بناءً على الذاكرة. | Medium |
| **C-003 — تداخل Live Data Engine في الدستور و Live Intelligence Platform** | `BONDS_CONSTITUTION.md` + `intelligence/01_LIVE_INTELLIGENCE_PLATFORM.md` | المفهوم واحد لكن التفاصيل متفرقة. | اعتبار Live Intelligence Platform التنفيذ العملي للـ Live Data Engine في الدستور. | Low |
| **C-004 — تعدد أسماء المحرك المركزي** | `BONDS_CONSTITUTION.md` يستخدم BONDS Intelligence Core؛ `architecture/01_ECONOMIC_BRAIN.md` يستخدم Economic Brain. | تسميتان لنفس المفهوم. | توحيد المصطلحات: Economic Brain = الاسم الرسمي للمحرك المركزي. | Medium |

## 1.2 التكرار بين الوثائق

| التكرار | الموقع | الوصف | الإجراء |
|---|---|---|---|
| **R-001 — شرح Confidence Score** | `architecture/03_CONFIDENCE_ENGINE.md` + `intelligence/01_LIVE_INTELLIGENCE_PLATFORM.md` + `standards/04_DATA_STANDARD.md` | شرح مفصوم متكرر. | الاحتفاظ بالتعريف في `standards/04_DATA_STANDARD.md` والإشارة إليه من بقية الوثائق. |
| **R-002 — شرح Evidence Bundle** | `architecture/05_EVIDENCE_LAYER.md` + `standards/04_DATA_STANDARD.md` | المفهوم نفسه. | توحيد المصطلح في Standards والإشارة إليه. |
| **R-003 — جداول الثقة A-D** | `intelligence/01_LIVE_INTELLIGENCE_PLATFORM.md` + `architecture/03_CONFIDENCE_ENGINE.md` | نفس التصنيف. | الاحتفاظ بمصدر واحد. |

## 1.3 المحركات غير المترابطة أو المعزولة

| المحرك | الحالة | السبب | الحل |
|---|---|---|---|
| **226 Calculator Pages** | معزولة | صفحات HTML مستقلة لا تتواصل مع بعضها. | تحويلها تدريجياً إلى Expert Engines. |
| **bonds-v2 Next.js Dashboard** | معزول جزئياً | مشروع منفصل باعتماديات مختلفة. | ربطه بالـ Unified Data Layer و V3 APIs. |
| **v3 Economic Intelligence Engine** | مرتبط جزئياً | يعمل لكنه يستخدم `api/v3/index.js` مغلّف. | تصحيح التوجيه إلى `v3/api/index.js`. |
| **Legacy Scenario Tables** | غير مترابطة | `scenarios` vs `project_scenarios`. | توحيد الجداول أو ربطها بـ Unified Data Layer. |

## 1.4 المحركات التي تعتمد على محركات غير موجودة

| المحرك | يعتمد على | حالة التبعية | المخاطرة |
|---|---|---|---|
| Decision Graph | Economic Brain + جميع المحركات | Economic Brain غير موجود بعد | لا يمكن بناؤه قبل Sprint 3. |
| Digital Twin | Unified Data Layer + Economic Brain + Decision Graph | الطبقتان غير موجودتين | يؤجل إلى Sprint 5. |
| Simulation Engine | Valuation + Feasibility + Cashflow + Risk + Financing | المحركات موجودة لكنها معزولة | يحتاج إلى توحيد البيانات أولاً. |
| Recommendation Engine | جميع المحركات + Confidence Engine + AI Analyst | غير موجودة بعد | يحتاج إلى إكمال Sprint 3–8. |
| Autonomous Intelligence | Live Intelligence + Decision OS + AI Analyst + Decision Memory | غير موجودة بعد | يحتاج إلى إكمال Sprint 7–12. |
| Self-Learning Platform | Decision Memory + AI Analyst | غير موجودة بعد | يحتاج إلى إكمال Sprint 12. |

## 1.5 الوثائق غير القابلة للتنفيذ بحالتها الحالية

| الوثيقة | العنصر غير القابل للتنفيذ | السبب | الحل |
|---|---|---|---|
| `intelligence/01_LIVE_INTELLIGENCE_PLATFORM.md` | جلب بيانات حية من 30+ فئة فورياً | قلة المصادر، تكلفة، قيود Vercel. | تنفيذ تدريجي حسب الأولوية والدولة. |
| `intelligence/04_AUTONOMOUS_INTELLIGENCE.md` | قرارات ذاتية بدون تدخل بشري | يخالف `05_AI_STANDARD.md`. | تنبيهات واقتراحات فقط + موافقة المستخدم. |
| `intelligence/08_SELF_LEARNING_PLATFORM.md` | تحديث نماذج تلقائي بدون مراجعة | يخالف Explainability. | تحديثات موثقة + A/B test + موافقة. |
| `architecture/12_GLOBAL_PLATFORM_ROADMAP.md` | الوصول إلى v10.0 كمعيار عالمي | يتطلب سنوات وموارد ضخمة. | خارطة طريق طويلة الأمد. |
| `intelligence/05_PLUGIN_ARCHITECTURE.md` | Plugin مستقل لكل قطاع | يحتاج إلى بنية Plugin Runtime. | بناء Runtime أولاً ثم إضافة القطاعات. |

## 1.6 التعارض مع النظام الحالي

| التعارض | المرجع | الواقع الحالي | الحل | الأولوية |
|---|---|---|---|---|
| **226 صفحة حاسبة منفصلة** | `ARCHITECTURE_CONFLICTS.md` C1 | `calculators/` + `en/calculators/` | تحويل تدريجي + redirects | Critical |
| **V3 router مغلّف** | `ARCHITECTURE_CONFLICTS.md` C5 | `api/v3/index.js` wrapper | توجيه مباشر إلى `v3/api/index.js` | High |
| **ترحيلات V3 خارج `supabase/migrations/`** | `ARCHITECTURE_CONFLICTS.md` C2 | `v3/supabase/migrations/` | دمجها في `supabase/migrations/` | High |
| **بيانات ثابتة في JS** | `ARCHITECTURE_CONFLICTS.md` C3 | `country-platforms-data.js` | نقل إلى Supabase + cache | High |
| **تكرار بيانات المستخدم** | `ARCHITECTURE_CONFLICTS.md` C4 | `profiles` vs `auth.users` | استخدام view/metadata | High |
| **CORS wildcard** | `ARCHITECTURE_CONFLICTS.md` C6 | `vercel.json` | تقييد CORS على endpoints المصادقة | High |
| **قوالب AI عربية فقط** | `ARCHITECTURE_CONFLICTS.md` C7 | `lib/ai/prompts.js` | قوالب ثنائية اللغة | Medium |
| **مصادر Live Data غير موثقة** | `INTELLIGENCE_CONFLICTS.md` IC1 | لا يوجد تصنيف ثقة | تصنيف A-D | High |
| **Plugin Architecture قد تعزل البيانات** | `INTELLIGENCE_CONFLICTS.md` IC2 | لم تُبنَ بعد | Plugins تستخدم Unified Data Layer فقط | High |
| **Autonomous Intelligence بدون موافقة** | `INTELLIGENCE_CONFLICTS.md` IC3 | غير مُطبق | human-in-the-loop | Critical |
| **Live Intelligence بدون Lineage** | `INTELLIGENCE_CONFLICTS.md` IC6 | غير مُطبق | تطبيق Enterprise Data Fabric | High |
| **اعتماديات مكررة/قديمة** | `DEPENDENCY_GRAPH.md` | `stripe`, `nodemailer`, `jest`, `vercel:latest` | توحيد ورفع الإصدارات | High |
| **نقص اعتماديات** | `DEPENDENCY_GRAPH.md` | `puppeteer` غير مُعلن | إضافة أو حذف السكربتات | Medium |
| **جداول مكررة** | `IMPLEMENTATION_ROADMAP.md` Phase 1 | `ingredients`, `subscriptions`, `scenarios` | دمج/توحيد | High |
| **admin verification مكرر** | `IMPLEMENTATION_ROADMAP.md` Phase 2 | `verifyAdmin` / `verifyAdminStrict` | دمج في middleware واحد | High |
| **payment webhooks مكررة** | `IMPLEMENTATION_ROADMAP.md` Phase 2 | `/api/webhook` + `/api/v3/billing/webhook` | توحيد | Medium |
| **admin reset endpoints غير مصادق** | `BONDS_SYSTEM_AUDIT.md` | endpoints تتيح إعادة تعيين كلمة السر | إضافة authz | Critical |

## 1.7 خلاصة التحقق من المعمارية

- **الوثائق متسقة بشكل عام** مع الدستور.
- **توجد تداخلات** في بعض المفاهيم (Knowledge Graph / Knowledge Cloud، Decision Memory / Self-Learning) تحتاج إلى توضيح الحدود.
- **جميع المحركات المستقبلية تعتمد على Economic Brain و Unified Data Layer**؛ لذلك يجب بناؤهما في أول Sprints.
- **هناك عناصر غير قابلة للتنفيذ فوراً** بسبب قيود Vercel Hobby، قلة المصادر، أو الحاجة إلى بنية تحتية غير موجودة.
- **النظام الحالي يحمل ديوناً تقنية كبيرة** يجب معالجتها قبل أو بالتوازي مع بناء المحركات الجديدة.

**التوصية:** الموافقة على هذه الخطة مع الالتزام بترتيب Sprints المحدد.

---

# المرحلة الثانية — Dependency Graph

## 2.1 المخزون الحالي (Inventory)

| الطبقة | العناصر |
|---|---|
| **Pages** | 226 calculator pages، root static pages، bonds-v2 Next.js pages، v3 pages |
| **Components** | Universal Dropdown، shared-export footer، valuation UI، admin dashboards |
| **APIs** | `/api/*` (root serverless)، `/api/v3/*` (V3 router)، bonds-v2 API routes |
| **Services** | Supabase، Stripe، Moyasar، OpenAI، Nodemailer |
| **Database** | Supabase Postgres: auth، profiles، subscriptions، scenarios، ingredients، asset_valuations، valuation_ai_reports، V3 tables |
| **AI** | OpenAI orchestrator، valuation analyze handler، certificate handler |
| **Reports** | Executive report، valuation report، feasibility reports |
| **Certificates** | BDVC certificate generator + verify endpoint |
| **Calculators** | 226 standalone HTML calculators |
| **Expert Engines** | Valuation، Feasibility، Risk، Cashflow، Financing، Market، AI Analyst، Certificate، Live Data، Knowledge (مخطط) |
| **Knowledge** | `country-platforms-data.js`، `shared-platforms.js`، V3 master data |
| **Decision Graph** | (مخطط) |
| **Digital Twin** | (مخطط) |
| **Market Intelligence** | (مخطط) |
| **Live Data** | (مخطط) |
| **Simulation** | (مخطط) |
| **Recommendations** | (مخطط) |
| **Workflow** | (مخطط) |
| **Decision Memory** | (مخطط) |
| **Confidence Engine** | (مخطط) |
| **Evidence Layer** | (مخطط) |
| **Economic Brain** | (مخطط) |

## 2.2 مصفوفة التبعيات

| العنصر | يعتمد على | يُستخدم من قبل |
|---|---|---|
| **Economic Brain** | Unified Data Layer | جميع المحركات، UI، Reports، Certificates |
| **Unified Data Layer** | Database، Migrations، Data Fabric | Economic Brain، Digital Twin، Evidence Layer |
| **Data Fabric** | Database، APIs، Catalog | Unified Data Layer، Live Intelligence |
| **Live Intelligence** | Data Fabric، External APIs | Market Intelligence، Autonomous Intelligence |
| **Market Intelligence** | Live Intelligence، Knowledge Engine | Valuation Engine، Risk Engine |
| **Knowledge Engine / Knowledge Cloud** | Data Fabric، Expert Review | All Engines، AI Analyst |
| **Knowledge Graph** | Knowledge Engine | Economic Brain، Recommendation Engine |
| **Confidence Engine** | All Engines Outputs | Economic Brain، Recommendation Engine |
| **Evidence Layer** | All Engines Outputs | Reports، Certificates، Audit Trail |
| **Decision Graph** | Economic Brain، All Engines | Digital Twin، Autonomous Intelligence |
| **Digital Twin** | Unified Data Layer، Decision Graph | Reports، Monitoring، Autonomous Intelligence |
| **Valuation Engine** | Market Intelligence، Knowledge Engine | Economic Brain، Reports، Certificates |
| **Feasibility Engine** | Knowledge Engine، Cashflow Engine | Economic Brain، Reports |
| **Cashflow Engine** | Knowledge Engine | Feasibility، Financing، Simulation |
| **Risk Engine** | Market Intelligence، Knowledge Engine | Financing، Simulation، Recommendation |
| **Financing Engine** | Cashflow Engine، Risk Engine | Reports، Recommendation |
| **Simulation Engine** | Valuation، Feasibility، Cashflow، Risk، Financing | Recommendation Engine، UI |
| **Recommendation Engine** | Simulation، Confidence، AI Analyst | UI، Reports |
| **AI Analyst** | Economic Brain، Evidence Layer | Reports، Recommendation، Autonomous Intelligence |
| **Decision Memory** | Reports، Decisions | Self-Learning، Autonomous Intelligence |
| **Self-Learning** | Decision Memory، AI Analyst | Confidence Engine، Recommendation Engine |
| **Autonomous Intelligence** | Live Intelligence، Decision OS، AI Analyst، Decision Memory | Notifications، UI |
| **Decision OS** | Economic Brain، Workflow | All Engines، Autonomous Intelligence |
| **Workflow** | Decision OS، Reports، Certificates | Admin، Client Command Center |
| **Reports Engine** | Evidence Layer، AI Analyst | Client، Admin |
| **Certificate Engine** | Evidence Layer، Valuation | Public Verify |
| **Plugin Runtime** | Economic Brain، Unified Data Layer | Sector Plugins |
| **Sector Plugins** | Plugin Runtime | UI، Reports |

## 2.3 ترتيب التنفيذ الصحيح

```text
Sprint 1  Core Infrastructure
Sprint 2  Unified Data Layer
Sprint 3  Economic Brain
Sprint 4  Decision Graph
Sprint 5  Digital Twin
Sprint 6  Knowledge Graph
Sprint 7  Live Intelligence
Sprint 8  Confidence Engine
Sprint 9  Evidence Layer
Sprint 10 Simulation Engine
Sprint 11 Recommendation Engine
Sprint 12 AI Decision Analyst
Sprint 13 Valuation Refactor
Sprint 14 Feasibility Refactor
Sprint 15 Financing Refactor
Sprint 16 Reports Engine
Sprint 17 Certificate Engine
Sprint 18 Client Command Center
Sprint 19 Admin Command Center
Sprint 20 Global Optimization
```

**مبرر الترتيب:**

- لا يمكن بناء أي محرك قبل **Unified Data Layer**.
- لا يمكن بناء **Economic Brain** قبل **Unified Data Layer**.
- لا يمكن بناء **Decision Graph** أو **Digital Twin** قبل **Economic Brain**.
- لا يمكن بناء **Knowledge Graph** بدون **Knowledge Engine/Cloud**.
- لا يمكن بناء **Simulation/Recommendation/AI Analyst** بدون المحركات الأساسية.
- يتم إعادة بناء **Valuation/Feasibility/Financing** بعد توفر المنصة الجديدة لضمان التكامل.
- يتم بناء **Reports/Certificate Engine** بعد توفر المحركات والأدلة.
- يتم بناء **Command Centers** في النهاية لأنها تعتمد على كل ما سبق.


---

# المرحلة الثالثة — Execution Roadmap

> **قاعدة أساسية:** كل Sprint مستقل وينتج نظاماً يعمل (Working System Increment).  
> **المدة التقديرية:** 2–3 أسابيع لكل Sprint.  
> **إجمالي المدة التقديرية:** 40–60 أسبوعاً (10–15 شهراً) مع فريق واحد؛ يمكن تقليله بتوازي Sprints بعد Sprint 5.

---

## Sprint 1 — Core Infrastructure

| البند | التفاصيل |
|---|---|
| **الهدف** | إصلاح الأساسات التي تهدد استقرار النظام. |
| **النطاق** | قاعدة البيانات، الاعتماديات، التوجيه، الأمان الأساسي. |
| **المخرجات** | بيئة نظيفة ومستقرة جاهزة للبناء فوقها. |
| **المهام الرئيسية** | 1. دمج/ترقيم ترحيلات V3 في `supabase/migrations/`. <br>2. حل تكرار جداول `ingredients`، `subscriptions`، `scenarios`. <br>3. تصحيح توجيه V3 إلى `v3/api/index.js` وإزالة `api/v3/index.js`. <br>4. توحيد إصدارات `stripe`، `nodemailer`، `@supabase/supabase-js`، `jest`. <br>5. إغلاق `admin reset/force-reset` endpoints بمصادقة/تصريح. <br>6. تقييد CORS على endpoints المصادقة. <br>7. مراجعة RLS على الجداول الحساسة. <br>8. حذف/إضافة الاعتماديات الميتة أو الناقصة (`puppeteer`، `@sentry/node`، `html2canvas`، `jspdf`). |
| **المتطلبات السابقة** | اعتماد MASTER_EXECUTION_PLAN. نسخة احتياطية كاملة. بيئة staging. |
| **Definition of Done** | جميع الاختبارات الحرجة تمر. لا توجد endpoints مفتوحة. المigrations مرتبة. `npm test` و `npm audit` نظيفان. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | C2، C4، C5، C6، admin reset، duplicate packages، missing deps |
| **المخاطر** | فقدان/تلف بيانات أثناء دمج الجداول؛ تعطل APIs الحالية. |

---

## Sprint 2 — Unified Data Layer

| البند | التفاصيل |
|---|---|
| **الهدف** | بناء طبقة بيانات موحدة لجميع المحركات. |
| **النطاق** | Schema refactoring، views، Smart Data Override، Data Fabric، Global Data Catalog. |
| **المخرجات** | كل بيانات المستخدم والمشروع والسوق في مصدر واحد. |
| **المهام الرئيسية** | 1. تصميم جداول `projects`، `assets`، `valuations`، `scenarios`، `financing`، `data_sources`. <br>2. إنشاء views لقراءة `auth.users` + `profiles` بدون تكرار. <br>3. تنفيذ Smart Data Override مع تسجيل السبب والفرق. <br>4. بناء Global Data Catalog. <br>5. بناء Enterprise Data Fabric الأساسي. <br>6. نقل البيانات الجغرافية/القطاعية الثابتة إلى جداول/JSON موثق. |
| **المتطلبات السابقة** | إنجاز Sprint 1. |
| **Definition of Done** | جميع المحركات الحالية تستطيع القراءة/الكتابة عبر UDL. الاختبارات تمر. لا يوجد تكرار في البيانات. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | C3، C4، IC6، duplicate scenarios |
| **المخاطر** | تغيير schema يكسر calculators الحالية. |

---

## Sprint 3 — Economic Brain

| البند | التفاصيل |
|---|---|
| **الهدف** | بناء العقل المركزي الذي ينسق جميع المحركات. |
| **النطاق** | Orchestrator، Engine Registry، Event Bus، Intent Parser، Standard Output Schema. |
| **المخرجات** | محرك مركزي قادر على استقبال نية المستخدم وتشغيل المحركات المناسبة. |
| **المهام الرئيسية** | 1. تصميم واجهة Economic Brain. <br>2. إنشاء Engine Registry. <br>3. بناء Event Bus داخلي. <br>4. تنفيذ Intent Parser أولي (valuation، feasibility، financing). <br>5. تعريف Standard Output Schema لكل محرك. <br>6. ربط UDL بالـ Economic Brain. |
| **المتطلبات السابقة** | إنجاز Sprint 2. |
| **Definition of Done** | يمكن للـ Economic Brain تشغيل Valuation/Feasibility/Financing من خلال واجهة موحدة. اختبارات التكامل تمر. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | C1 (بدء تحويل الحاسبات) |
| **المخاطر** | تعقيد منطق Orchestrator يؤدي إلى بطء. |

---

## Sprint 4 — Decision Graph

| البند | التفاصيل |
|---|---|
| **الهدف** | رسم أثر القرارات على النظام. |
| **النطاق** | Dependency graph، impact analysis، propagation engine. |
| **المخرجات** | عند تغيير أي قيمة، يظهر تأثيرها على النتائج. |
| **المهام الرئيسية** | 1. تصميم نموذج Decision Graph. <br>2. ربط المدخلات/المخرجات بالعقد. <br>3. تنفيذ propagation engine. <br>4. عرض أثر التغيير في UI. |
| **المتطلبات السابقة** | إنجاز Sprint 3. |
| **Definition of Done** | تغيير قيمة في مشروع يُعيد حساب جميع النتائج المتأثرة ويُظهرها. |
| **المدة** | 2 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | أداء ضعيف مع graphs كبيرة. |

---

## Sprint 5 — Digital Twin

| البند | التفاصيل |
|---|---|
| **الهدف** | إنشاء ملف رقمي دائم لكل مشروع/أصل. |
| **النطاق** | Snapshot store، state updates، monitoring triggers. |
| **المخرجات** | كل مشروع له Digital Twin يُحدّث تلقائياً. |
| **المهام الرئيسية** | 1. تصميم جداول Digital Twin. <br>2. إنشاء snapshots للمشاريع. <br>3. ربط التحديثات بالـ Decision Graph. <br>4. تنفيذ triggers للتحديث عند تغير السوق. |
| **المتطلبات السابقة** | إنجاز Sprint 4. |
| **Definition of Done** | Digital Twin يُنشأ لكل مشروع جديد ويُحدّث عند تغير البيانات. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | حجم التخزين يتزايد بسرعة. |

---

## Sprint 6 — Knowledge Graph

| البند | التفاصيل |
|---|---|
| **الهدف** | بناء المعرفة القطاعية والتنظيمية المترابطة. |
| **النطاق** | Knowledge Engine، Economic Knowledge Cloud، content curation workflow. |
| **المخرجات** | محرك معرفة يُغذي جميع المحركات بالسياق القطاعي. |
| **المهام الرئيسية** | 1. تصميم Knowledge Graph schema. <br>2. بناء Economic Knowledge Cloud. <br>3. إنشاء خط أنابيب موافقة المحتوى. <br>4. ربط المعرفة بالمحركات. |
| **المتطلبات السابقة** | إنجاز Sprint 2. |
| **Definition of Done** | المحركات تستطيع طلب معرفة قطاعية واستخدامها في التحليل. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | C-001 (توضيح الحدود) |
| **المخاطر** | بطء في إنتاج المحتوى القطاعي. |

---

## Sprint 7 — Live Intelligence

| البند | التفاصيل |
|---|---|
| **الهدف** | جلب البيانات الحية وتوحيدها. |
| **النطاق** | Ingestion، validation، confidence scoring، caching. |
| **المخرجات** | بيانات حية موثقة تُغذي Market Intelligence. |
| **المهام الرئيسية** | 1. بناء ingestion framework. <br>2. ربط مصادر أولوية (KAPSARC، أسعار العملات/الذهب، بيانات حكومية). <br>3. تنفيذ validation + confidence scoring. <br>4. تخزين في UDL مع Lineage. |
| **المتطلبات السابقة** | إنجاز Sprint 2 و 6. |
| **Definition of Done** | 3-5 مصادر حية تعمل بثقة A/B وتُغذي المحركات. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | IC1، IC6 |
| **المخاطر** | انقطاع APIs الخارجية أو تغيير شروط الاستخدام. |

---

## Sprint 8 — Confidence Engine

| البند | التفاصيل |
|---|---|
| **الهدف** | حساب درجة الثقة لكل نتيجة. |
| **النطاق** | Scoring rules، aggregation، thresholds. |
| **المخرجات** | كل مخرج للمحركات يحمل Confidence Score. |
| **المهام الرئيسية** | 1. تعريف عوامل الثقة (جودة البيانات، مصدرها، التاريخ، الاتساق). <br>2. بناء Confidence Engine. <br>3. ربطه بالمحركات. <br>4. عرض Confidence Score في UI. |
| **المتطلبات السابقة** | إنجاز Sprint 3، 6، 7. |
| **Definition of Done** | جميع المحركات تُنتج Confidence Score؛ الاختبارات تمر. |
| **المدة** | 2 أسابيع |
| **الديون المرتبطة** | R-003 |
| **المخاطر** | تعقيد حساب الثقة يُبطئ الاستجابة. |

---

## Sprint 9 — Evidence Layer

| البند | التفاصيل |
|---|---|
| **الهدف** | ربط كل نتيجة بالأدلة. |
| **النطاق** | Evidence Bundle schema، storage، retrieval. |
| **المخرجات** | كل قيمة قابلة للتدقيق والتحقق. |
| **المهام الرئيسية** | 1. تصميم Evidence Bundle. <br>2. ربط المحركات بالأدلة. <br>3. تخزين الحزم مع Reports/Certificates. <br>4. عرض الأدلة في UI. |
| **المتطلبات السابقة** | إنجاز Sprint 3، 6، 7، 8. |
| **Definition of Done** | كل مخرج يحتوي على Evidence Bundle؛ يمكن النقر على أي رقم لرؤية أدلته. |
| **المدة** | 2 أسابيع |
| **الديون المرتبطة** | R-002 |
| **المخاطر** | حجم التخزين والأداء. |

---

## Sprint 10 — Simulation Engine

| البند | التفاصيل |
|---|---|
| **الهدف** | تمكين المحاكاة والسيناريوهات. |
| **النطاق** | Sensitivity، stress test، Monte Carlo، scenario comparison. |
| **المخرجات** | محرك محاكاة متكامل. |
| **المهام الرئيسية** | 1. بناء Scenario Manager. <br>2. تنفيذ Sensitivity Analysis. <br>3. تنفيذ Stress Test. <br>4. تنفيذ Monte Carlo (server-side). <br>5. ربطه بالمحركات. |
| **المتطلبات السابقة** | إنجاز Sprint 3، 8، 9. |
| **Definition of Done** | يمكن تشغيل سيناريوهات متعددة ومقارنتها بصرياً. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | Monte Carlo يستهلك موارد كبيرة على Vercel Hobby. |

---

## Sprint 11 — Recommendation Engine

| البند | التفاصيل |
|---|---|
| **الهدف** | إصدار توصيات استثمارية مفسرة. |
| **النطاق** | Rule-based scoring، AI insights، constraints. |
| **المخرجات** | توصيات واضحة مع Confidence Score. |
| **المهام الرئيسية** | 1. تعريف قواعد التوصية. <br>2. بناء Recommendation Engine. <br>3. دمج AI insights. <br>4. عرض التوصيات في UI. |
| **المتطلبات السابقة** | إنجاز Sprint 3، 8، 10. |
| **Definition of Done** | يمكن إنتاج توصية buy/sell/hold/finance مع أسباب واضحة. |
| **المدة** | 2 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | توصيات مضللة إذا كانت البيانات ضعيفة. |

---

## Sprint 12 — AI Decision Analyst

| البند | التفاصيل |
|---|---|
| **الهدف** | بناء محلل AI ثنائي اللغة لإنتاج تقارير تنفيذية. |
| **النطاق** | Bilingual prompts، JSON schema، guardrails، executive report. |
| **المخرجات** | تقارير AI عربية/إنجليزية مفصلة. |
| **المهام الرئيسية** | 1. بناء قوالب AI ثنائية اللغة. <br>2. تحسين JSON schema للمخرجات. <br>3. دمج Evidence Layer. <br>4. إنتاج Executive Report. <br>5. دمج Quality Gates. |
| **المتطلبات السابقة** | إنجاز Sprint 3، 9، 11. |
| **Definition of Done** | التقرير يُنتج بالعربية والإنجليزية بدون أخطاء حرجة؛ Quality Gates تمر. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | C7 |
| **المخاطر** | AI hallucination أو استهلاك tokens عالٍ. |

---

## Sprint 13 — Valuation Refactor

| البند | التفاصيل |
|---|---|
| **الهدف** | إعادة بناء محرك التقييم ليعمل ضمن المنصة الموحدة. |
| **النطاق** | Valuation Engine، market data integration، BDVC certificate. |
| **المخرجات** | تقييمات موحدة مع Evidence Bundle وConfidence Score. |
| **المهام الرئيسية** | 1. ربط Valuation Engine بـ Economic Brain. <br>2. استخدام Live Data و Knowledge Graph. <br>3. دمج Evidence Layer. <br>4. تحديث certificate workflow. |
| **المتطلبات السابقة** | إنجاز Sprint 3، 7، 8، 9. |
| **Definition of Done** | تقييم كامل يمر عبر Economic Brain ويحمل Evidence + Confidence. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | تغيير المنطقد يؤثر على التقارير الحالية. |

---

## Sprint 14 — Feasibility Refactor

| البند | التفاصيل |
|---|---|
| **الهدف** | إعادة بناء دراسة الجدوى لتعمل ضمن المنصة الموحدة. |
| **النطاق** | Feasibility Engine، cashflow، knowledge integration. |
| **المخرجات** | دراسات جدوى موحدة. |
| **المهام الرئيسية** | 1. ربط Feasibility Engine بـ Economic Brain. <br>2. استخدام Knowledge Graph للافتراضات. <br>3. دمج Cashflow Engine. <br>4. ربط Reports Engine. |
| **المتطلبات السابقة** | إنجاز Sprint 3، 6، 13. |
| **Definition of Done** | دراسة جدوى كاملة تُنتج من المنصة الموحدة. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | C1 (بدء استبدال الحاسبات) |
| **المخاطر** | فقدان بعض المنطق الخاص بالحاسبات القديمة. |

---

## Sprint 15 — Financing Refactor

| البند | التفاصيل |
|---|---|
| **الهدف** | إعادة بناء محرك التمويل ليعمل ضمن المنصة الموحدة. |
| **النطاق** | Financing Engine، risk، creditworthiness، DSCR. |
| **المخرجات** | هيكل تمويل موحد مع تقييم مخاطر. |
| **المهام الرئيسية** | 1. ربط Financing Engine بـ Economic Brain. <br>2. دمج Risk Engine و Cashflow Engine. <br>3. تطبيق Arab Banks Creditworthiness Framework. <br>4. ربط Reports Engine. |
| **المتطلبات السابقة** | إنجاز Sprint 3، 13، 14. |
| **Definition of Done** | يمكن إنتاج هيكل تمويل كامل مع DSCR وريسك بروفايل. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | تعقيد قواعد البنوك العربية. |

---

## Sprint 16 — Reports Engine

| البند | التفاصيل |
|---|---|
| **الهدف** | بناء محرك تقارير موحد. |
| **النطاق** | Templates، PDF/Excel/DOCX، executive، sector-specific. |
| **المخرجات** | تقارير تفاعلية وقابلة للتصدير. |
| **المهام الرئيسية** | 1. تصميم Report Template System. <br>2. دمج Evidence Layer. <br>3. دعم العربية/الإنجليزية. <br>4. تصدير PDF/Excel/DOCX. |
| **المتطلبات السابقة** | إنجاز Sprint 9، 12. |
| **Definition of Done** | يمكن توليد تقرير كامل من أي محرك بصيغ متعددة. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | تعقيد التنسيق بين اللغتين. |

---

## Sprint 17 — Certificate Engine

| البند | التفاصيل |
|---|---|
| **الهدف** | تحسين وتوحيد إصدار الشهادات. |
| **النطاق** | Issuance، verification، evidence binding. |
| **المخرجات** | شهادات رقمية موثقة بأدلة. |
| **المهام الرئيسية** | 1. ربط Certificate Engine بـ Evidence Layer. <br>2. تحسين verify endpoint. <br>3. دمج Quality Gates (confidence ≥ 85). <br>4. دعم شهادات متعددة (جدوى، تمويل، تقييم). |
| **المتطلبات السابقة** | إنجاز Sprint 9، 13. |
| **Definition of Done** | إصدار وتحقق شهادة كاملة بنجاح. |
| **المدة** | 2 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | تزوير أو مشاكل في التحقق. |

---

## Sprint 18 — Client Command Center

| البند | التفاصيل |
|---|---|
| **الهدف** | بناء لوحة تحكم موحدة للعميل. |
| **النطاق** | Dashboard، projects، assets، reports، decisions. |
| **المخرجات** | واجهة عميل متكاملة. |
| **المهام الرئيسية** | 1. تصميم Client Dashboard. <br>2. ربط المشاريع والأصول. <br>3. عرض التقارير والشهادات. <br>4. دمج التوصيات والتنبيهات. |
| **المتطلبات السابقة** | إنجاز Sprint 5، 11، 16، 17. |
| **Definition of Done** | العميل يمكنه إدارة جميع مشاريعه من لوحة واحدة. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | — |
| **المخاطر** | تعقيد UX مع كثرة البيانات. |

---

## Sprint 19 — Admin Command Center

| البند | التفاصيل |
|---|---|
| **الهدف** | بناء لوحة تحكم إدارية موحدة. |
| **النطاق** | Master data، review، users، audit، alerts. |
| **المخرجات** | واجهة إدارة متكاملة. |
| **المهام الرئيسية** | 1. تصميم Admin Dashboard. <br>2. CRUD للـ master data. <br>3. مراجعة التقارير والشهادات. <br>4. عرض Audit Trail. |
| **المتطلبات السابقة** | إنجاز Sprint 6، 9، 18. |
| **Definition of Done** | الإدارة تستطيع إدارة المنصة بالكامل من لوحة واحدة. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | duplicate admin verification |
| **المخاطر** | صلاحيات واسعة تتطلب أماناً عالياً. |

---

## Sprint 20 — Global Optimization

| البند | التفاصيل |
|---|---|
| **الهدف** | تحسين شامل للمنصة ومعالجة ما تبقى من الديون. |
| **النطاق** | Performance، a11y، i18n، SEO، monitoring، calculators migration final. |
| **المخرجات** | منصة محسّنة وجاهزة للنمو العالمي. |
| **المهام الرئيسية** | 1. إنهاء redirect للحاسبات القديمة. <br>2. تحسين الأداء والـ caching. <br>3. اختبار accessibility كامل. <br>4. تحسين SEO/i18n. <br>5. إعداد monitoring و alerting. <br>6. تحديث AGENTS.md والتوثيق. |
| **المتطلبات السابقة** | إنجاز جميع Sprints السابقة. |
| **Definition of Done** | جميع Quality Gates تُحقق. Audit نظيف. المنصة جاهزة للإنتاج. |
| **المدة** | 2–3 أسابيع |
| **الديون المرتبطة** | C1، blog/sector translation، visual tests |
| **المخاطر** | تغييرات واسعة قد تؤثر على الاستقرار. |


---

# المرحلة الرابعة — Migration Strategy

## 4.1 المبدأ الذهبي

- **لا توقف للخدمة.**
- **لا فقدان للبيانات.**
- **لا كسر لوظيفة موجودة.**
- **إمكانية الرجوع في أي لحظة.**

## 4.2 استراتيجية عامة: Parallel Run + Strangler Fig

```text
النظام الحالي ────────────────┐
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Strangler Adapter   │
                    │   (توحيد الواجهة)     │
                    └───────────┬───────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        القديم يعمل    المنصة الجديدة    القديم يُعاد توجيهه
```

## 4.3 خطوات Migration

| الخطوة | الوصف | Sprint |
|---|---|---|
| **1. Backup** | نسخة احتياطية كاملة من Supabase والملفات. | Sprint 0 |
| **2. Staging Mirror** | بناء بيئة staging مطابقة للإنتاج. | Sprint 0 |
| **3. Schema Unification** | تطبيق migrations الجديدة على staging. | Sprint 1 |
| **4. Data Sync** | نسخ البيانات القديمة إلى الجداول الجديدة مع mapping. | Sprint 1–2 |
| **5. Adapter Layer** | إنشاء adapter يُتيح للنظام القديم العمل مع UDL. | Sprint 2 |
| **6. Parallel Run** | تشغيل النظام القديم والجديد بالتوازي لمدة 2–4 أسابيع. | Sprint 3–6 |
| **7. Gradual Redirect** | إعادة توجيه الحاسبات القديمة تدريجياً إلى الرحلة الجديدة. | Sprint 13–20 |
| **8. Decommission** | إيقاف النظام القديم بعد التحقق الكامل. | بعد Sprint 20 |

## 4.4 Fallback Points

- قبل كل Sprint يتم أخذ snapshot.
- كل migration قابلة للـ rollback.
- كل redirect قابل للإلغاء.
- Feature flags تتحكم في تفعيل المحركات الجديدة.

---

# المرحلة الخامسة — Rollback Strategy

## 5.1 متى نرجع؟

- فشل Sprint في تحقيق Definition of Done.
- ظهور أخطاء حرجة في الإنتاج.
- فقدان بيانات أو تلف.
- انخفاض الأداء عن الموازين.
- اختراق أمني.

## 5.2 مستويات Rollback

| المستوى | الوقت | الإجراء |
|---|---|---|
| **Feature Flag** | ثوانٍ | تعطيل الميزة الجديدة. |
| **Deploy Rollback** | دقائق | إعادة نشر آخر إصدار مستقر. |
| **Database Rollback** | دقائق | استعادة آخر snapshot. |
| **Full Environment Rollback** | < 30 دقيقة | استعادة staging/production بالكامل. |

## 5.3 إجراءات Rollback

1. **تفعيل Feature Flag OFF** للميزة المعنية.
2. **إعادة نشر** آخر tag مستقر.
3. **استعادة قاعدة البيانات** من snapshot إذا لزم.
4. **إعلام الفريق** وتسجيل الحدث.
5. **تحليل السبب** وإصلاحه في بيئة staging.

## 5.4 متطلبات Rollback

- snapshots يومية على الأقل.
- كل deployment له tag واضح.
- feature flags مفعلة لكل Sprint.
- runbook جاهز لكل sprint.

---

# المرحلة السادسة — Testing Strategy

## 6.1 أهداف الاختبار

- ضمان عمل كل Sprint بشكل مستقل.
- ضمان عدم كسر الوظائف السابقة.
- ضمان الأمان والأداء والوصولية.
- ضمان دقة الحسابات والتقييمات والتمويل.

## 6.2 أنواع الاختبارات

| النوع | الوصف | الأدوات | التكرار |
|---|---|---|---|
| **Unit Testing** | اختبار الدوال والمكونات الصغيرة. | Jest | كل PR |
| **Integration Testing** | اختبار تفاعل APIs والمحركات. | Jest + Supertest | كل Sprint |
| **Regression Testing** | التأكد من عدم كسر القديم. | Playwright + Jest | قبل كل deploy |
| **Performance Testing** | قياس أوقات الاستجابة. | Lighthouse + k6 | كل Sprint |
| **Security Testing** | فحص الثغرات والأسرار. | npm audit + manual review | كل Sprint |
| **Accessibility Testing** | ضمان الوصولية. | axe-core + Playwright | كل PR |
| **Load Testing** | اختبار تحمل الـ APIs. | k6 | Sprint 20 |
| **Stress Testing** | اختبار السلوك تحت ضغط عالٍ. | k6 | Sprint 20 |
| **AI Validation** | التحقق من مخرجات AI. | Manual + automated schema checks | Sprint 12+ |
| **Calculation Validation** | التحقق من صحة الحسابات. | Jest + known cases | كل Sprint |
| **Valuation Validation** | مقارنة التقييمات مع حالات معروفة. | Manual + automated | Sprint 13 |
| **Financial Validation** | التحقق من DSCR، IRR، NPV. | Jest + Excel checks | Sprint 15 |
| **Data Validation** | التحقق من جودة البيانات. | Data quality rules | Sprint 2+ |
| **UX Validation** | اختبار رحلة المستخدم. | Playwright + manual | Sprint 18+ |
| **Acceptance Testing** | موافقة صاحب المنتج على المخرجات. | Demo + checklist | نهاية كل Sprint |

## 6.3 CI/CD

- كل PR يجب أن يمر على:
  - `npm test`
  - `npm run audit`
  - `npm run test:a11y`
  - `npm run test:mobile`
- كل Sprint ينتهي بتشغيل كامل الاختبارات على staging.

---

# المرحلة السابعة — Quality Gates

## 7.1 Gate قبل كل Sprint

- إنجاز Sprint السابق بنجاح.
- لا أخطاء حرجة مفتوحة.
- Audit Trail محدّث.
- Docs محدّثة.

## 7.2 Gate بعد كل Sprint

| المعيار | القيمة المطلوبة |
|---|---|
| نجاح الاختبارات الحرجة | 100% |
| عدم وجود أخطاء حرجة | 0 critical bugs |
| عدم كسر وظيفة | 0 broken features |
| تغطية الاختبار | ≥ 80% للمنطق الجديد |
| أداء API | p95 < 2s |
| Lighthouse Performance | ≥ 70 |
| Security Audit | 0 high/critical vulnerabilities |
| Accessibility | 0 axe critical violations |

## 7.3 Gate بين المراحل

| المرحلة | الشرط |
|---|---|
| Core → Data | Database stable + all critical security closed. |
| Data → Brain | UDL functional + data quality gates pass. |
| Brain → Engines | Economic Brain orchestrates 3+ engines. |
| Engines → UI | Reports/Certificates generate correctly. |
| UI → Optimization | Client + Admin centers functional. |

---

# المرحلة الثامنة — Technical Debt Plan

## 8.1 Critical Debt

| الدين | السبب | Sprint |
|---|---|---|
| **226 calculators standalone** | يخالف Constitution | Sprint 13–20 |
| **Unauthenticated admin reset endpoints** | ثغرة أمنية | Sprint 1 |
| **V3 router wrapper** | يخالف Architecture Standard | Sprint 1 |
| **Database table conflicts** | ingredients/subscriptions/scenarios duplicates | Sprint 1–2 |
| **CORS wildcard on auth APIs** | ثغرة أمنية | Sprint 1 |

## 8.2 High Debt

| الدين | السبب | Sprint |
|---|---|---|
| **Hardcoded geographic/sector data in JS** | يخالف Data Standard | Sprint 2 |
| **Duplicate user data profiles/auth.users** | Single Source of Truth violation | Sprint 2 |
| **V3 migrations outside supabase/migrations/** | Migration standard violation | Sprint 1 |
| **AI prompts Arabic-only** | i18n conflict | Sprint 12 |
| **Duplicate admin verification logic** | صيانة صعبة | Sprint 1–2 |
| **Outdated packages** | أمان واستقرار | Sprint 1 |
| **Missing FK indexes** | أداء | Sprint 1–2 |
| **Live data without confidence/lineage** | Data quality | Sprint 7 |

## 8.3 Medium Debt

| الدين | السبب | Sprint |
|---|---|---|
| **Deprecated `@supabase/auth-helpers-nextjs`** | Technical obsolescence | Sprint 1 |
| **Duplicate payment webhooks** | صيانة | Sprint 1 |
| **Inconsistent API response shapes** | API Standard | Sprint 3 |
| **Missing override audit log** | Data Standard | Sprint 2 |
| **Missing Sentry instrumentation** | Monitoring | Sprint 1 |

## 8.4 Low Debt

| الدين | السبب | Sprint |
|---|---|---|
| **Blog/sector pages not translated** | i18n | Sprint 20 |
| **Visual test coverage limited** | Quality | Sprint 20 |
| **PWA assets outdated** | Maintenance | Sprint 20 |
| **Tailwind v3 instead of v4** | Tooling | Sprint 20 |

---

# المرحلة التاسعة — Risk Register

| الرمز | الخطر | السبب | الاحتمالية | الأثر | خطة الوقاية | خطة الاستجابة |
|---|---|---|---|---|---|---|
| **R-001** | فقدان بيانات أثناء Migration | دمج جداول وإعادة هيكلة | منخفض | كارثي | نسخ احتياطية + staging + incremental migration | استعادة snapshot فورية |
| **R-002** | انقطاع APIs خارجية | Live Data dependencies | متوسط | عالي | Fallback sources + caching | استخدام آخر قيمة صالحة |
| **R-003** | تجاوز حدود Vercel Hobby | 12 functions limit | متوسط | عالي | توجيع عبر `v3/api/index.js` + external queue | ترقية خطة Vercel |
| **R-004** | AI hallucination | OpenAI غير محكوم | متوسط | عالي | JSON schema + quality gates + guardrails | مراجعة يدوية + رفض المخرجات |
| **R-005** | أداء ضعيف للـ Monte Carlo | حسابات ثقيلة | متوسط | متوسط | server-side + limits + queue | degrade gracefully |
| **R-006** | تعارضات بين workspaces | root + bonds-v2 + v3 | عالي | متوسط | توحيد الاعتماديات + UDL | عزل المشروع المتسبب |
| **R-007** | مقاومة المستخدمين للتغيير | انتقال من حاسبات | متوسط | متوسط | redirects + onboarding | الحفاظ على روابط قديمة |
| **R-008** | تأخر فريق المحتوى | Knowledge Cloud | متوسط | عالي | جدولة محتوى + AI extraction | تقليل نطاق القطاعات |
| **R-009** | تغيير قوانين/اشتراطات | Live Intelligence | منخفض | عالي | مراقبة + alerts | تحديث Knowledge Cloud فوراً |
| **R-010** | Scope creep | طموح المنصة | عالي | متوسط | حوكمة Constitution + Sprints | رفض الميزات خارج الخطة |

---

# المرحلة العاشرة — Definition Of Done

## 10.1 Definition of Done لكل Sprint

يكتمل Sprint عند تحقيق **جميع** الشروط التالية:

- [ ] جميع المهام المحددة منجزة.
- [ ] الكود مدمج في الفرع الرئيسي (main).
- [ ] جميع الاختبارات الحرجة ناجحة (100%).
- [ ] لا توجد أخطاء حرجة (Critical Bugs = 0).
- [ ] لا توجد ثغرات أمنية حرجة/عالية غير معالجة.
- [ ] تم تحديث الوثائق الفنية والمستخدم.
- [ ] تمت مراجعة الكود (Code Review).
- [ ] تمت مراجعة الأمان (Security Review) للـ APIs الجديدة.
- [ ] تم اختبار الأداء وتحقيق الموازين.
- [ ] تم اختبار الوصولية (axe-core) بدون انتهاكات حرجة.
- [ ] تم اختبار الجوال (Responsive + touch).
- [ ] تم عرض Demo واعتماده.
- [ ] تم تحديث Audit Trail / Conflict logs إذا لزم.
- [ ] تم اختبار Rollback procedure.

## 10.2 Definition of Done لكل مرحلة

| المرحلة | متى تُعتبر مكتملة |
|---|---|
| **Phase 1 Validation** | التقرير معتمد؛ جميع التعارضات موثقة. |
| **Phase 2 Dependency Graph** | الرسمة معتمدة؛ ترتيب التنفيذ واضح. |
| **Phase 3 Roadmap** | جميع Sprints معرفة بـ DoD. |
| **Phase 4 Migration** | خطة Migration معتمدة وrunbook جاهز. |
| **Phase 5 Rollback** | runbook جاهز؛ snapshots مجربة. |
| **Phase 6 Testing** | استراتيجية الاختبار معتمدة وCI/CD مُحدّث. |
| **Phase 7 Quality Gates** | Gates معتمدة وقابلة للقياس. |
| **Phase 8 Technical Debt** | الديون مرتبة ومربوطة بـ Sprints. |
| **Phase 9 Risk Register** | المخاطر موثقة مع خطط. |
| **Phase 10 DoD** | المعايير معتمدة من صاحب المنتج. |

## 10.3 Definition of Done للمشروع ككل

- جميع Sprints منجزة.
- جميع Quality Gates مُحققة.
- جميع الديون الحرجة والعالية مُعالجة.
- جميع الحاسبات القديمة مُعاد توجيهها.
- المنصة تعمل في الإنتاج بدون أخطاء حرجة.
- التوثيق كامل ومحدّث.
- فريق الدعم مدرب على Rollback.

---

# الملاحق

## Appendix A — المراجع

- `docs/BONDS_CONSTITUTION.md`
- `docs/standards/01_ARCHITECTURE_STANDARD.md` … `10_PERFORMANCE_STANDARD.md`
- `docs/architecture/01_ECONOMIC_BRAIN.md` … `12_GLOBAL_PLATFORM_ROADMAP.md`
- `docs/architecture/ARCHITECTURE_CONFLICTS.md`
- `docs/intelligence/01_LIVE_INTELLIGENCE_PLATFORM.md` … `10_WORLD_CLASS_PLATFORM_CHECKLIST.md`
- `docs/intelligence/INTELLIGENCE_CONFLICTS.md`
- `docs/BONDS_SYSTEM_AUDIT.md`
- `docs/DEPENDENCY_GRAPH.md`
- `docs/IMPLEMENTATION_ROADMAP.md`

## Appendix B — المعجم

| المصطلح | المعنى |
|---|---|
| **Economic Brain** | المحرك المركزي المنسق. |
| **Unified Data Layer** | طبقة البيانات الموحدة. |
| **Decision Graph** | رسم أثر القرارات. |
| **Digital Twin** | التوأم الرقمي للمشروع/الأصل. |
| **Evidence Bundle** | حزمة الأدلة المصاحبة لكل نتيجة. |
| **Confidence Score** | درجة الثقة في النتيجة. |
| **Expert Engine** | محرك متخصص يحلل جانباً معيناً. |
| **Sprint** | فترة تنفيذ مستقلة تنتج نظاماً يعمل. |

## Appendix C — التوقيعات

| الدور | الاسم | التاريخ | الموافقة |
|---|---|---|---|
| Product Owner |  |  |  |
| Lead Architect |  |  |  |
| Engineering Lead |  |  |  |
| Security Lead |  |  |  |

> **لا يبدأ التنفيذ الفعلي إلا بعد توقيع هذه الوثيقة.**
