# BONDS Architecture Decision Records — سجلات قرارات الهندسة المعمارية

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة تنفيذية — لا يحتوي على كود

---

## 1. الرؤية

توثيق القرارات المعمارية المهمة التي تؤثر على تصميم BONDS، مع تبرير كل قرار والبدائل والمخاطر والحالة.

---

## 2. تنسيق ADR

كل قرار يتبع هذا التنسيق:

| الحقل | الوصف |
|---|---|
| **ID** | معرف فريد |
| **Title** | عنوان القرار |
| **Context** | لماذا نحتاج هذا القرار |
| **Decision** | ما تم قراره |
| **Consequences** | الآثار الإيجابية والسلبية |
| **Alternatives** | البدائل المرفوضة ولماذا |
| **Status** | Proposed / Accepted / Deprecated / Superseded |
| **Date** | تاريخ القرار |

---

## 3. القرارات

### ADR-001: استخدام Economic Brain كمحرك مركزي

- **Context:** النظام الحالي يحتوي على حاسبات منفصلة ومنطق متكرر.
- **Decision:** يتم بناء `Economic Brain` كمحرك مركزي يوجه المدخلات إلى Expert Engines عبر Intent Parser.
- **Consequences:** + توحيد المنطق، + إمكانية إضافة قطاعات. - تعقيد في التصميم الأولي.
- **Alternatives:** Refactor كل حاسبة منفرداً → رفض لأنه غير مستدام.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-002: Canonical Data Model قبل أي محرك

- **Context:** هناك جداول مكررة بين legacy و V3.
- **Decision:** توحيد نموذج البيانات قبل بناء أي محرك أو API جديد.
- **Consequences:** + بيانات نظيفة، + صيانة أسهل. - يتطلب migration كبير.
- **Alternatives:** البناء على البنية الحالية → رفض لأنه يزيد الديون التقنية.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-003: Expert Engine Pattern لكل محرك اختصاصي

- **Context:** المحركات المختصة (Valuation, Feasibility, Financing) تحتاج لمنهجية موحدة.
- **Decision:** كل Expert Engine يتبع نفس الواجهة: `analyze(input) → ResultBundle` مع Evidence.
- **Consequences:** + تبادلية، + اختبار سهل. - قد يضيف boilerplate.
- **Alternatives:** كل محرك حر → رفض لأنه يصعب الدمج.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-004: Standard Output Schema لكل المحركات

- **Context:** مخرجات المحركات المختلفة غير متناسقة.
- **Decision:** توحيد مخرجات المحركات في Schema ثابت: `confidence`, `evidence`, `warnings`, `next_steps`, `metrics`.
- **Consequences:** + تكامل سهل، + تقارير موحدة. - قد يتطلب تعديل محركات موجودة.
- **Alternatives:** JSON حر لكل محرك → رفض لصعوبة التقارير.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-005: Event Bus بين المحركات

- **Context:** المحركات تحتاج للتواصل بدون tight coupling.
- **Decision:** استخدام Event Bus داخلي (نشر/اشتراك) بين Economic Brain والـ Expert Engines.
- **Consequences:** + فصل واضح، + إمكانية الاشتراك المتعدد. - debugging أصعب.
- **Alternatives:** Direct calls → رفض لأنه يخلق تبعيات دائرية.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-006: Decision Graph للتبعيات بين المتغيرات

- **Context:** التغيير في متغير واحد يؤثر على حسابات متعددة.
- **Decision:** بناء Decision Graph يربط المتغيرات ويعيد الحساب تلقائياً.
- **Consequences:** + تحديث فوري، + شفافية. - تعقيد حسابي.
- **Alternatives:** إعادة حساب يدوية → رفض لعدم الكفاية.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-007: Digital Twin لكل مشروع

- **Context:** المستخدمين يحتاجون لملف دائم لمشاريعهم.
- **Decision:** تخزين snapshot للمشروع في Digital Twin مع تحديث تلقائي.
- **Consequences:** + احتفاظ، + قابلية المقارنة عبر الزمن. - تكلفة تخزين.
- **Alternatives:** LocalStorage فقط → رفض لعدم الثبات.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-008: Knowledge Graph منفصلة عن Live Intelligence

- **Context:** هناك لبس بين المعرفة الثابتة والبيانات الحية.
- **Decision:** Knowledge Graph = معرفة قطاعية منظمة. Live Intelligence = بيانات حية من مصادر خارجية.
- **Consequences:** + وضوح المسؤوليات. - يتطلب تكامل.
- **Alternatives:** دمج الكل في نفس الطبقة → رفض لصعوبة الصيانة.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-009: Live Data Ingestion مع Validation Pipeline

- **Context:** البيانات الخارجية قد تكون غير دقيقة.
- **Decision:** كل مصدر حي يمر بـ Ingestion → Validation → Normalization → Confidence Scoring.
- **Consequences:** + جودة بيانات. - زمن استجابة.
- **Alternatives:** استخدام مباشر → رفض لخطر الجودة.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-010: Confidence Engine A-D

- **Context:** المستخدمين يحتاجون لمعرفة مدى ثقة النتائج.
- **Decision:** اعتماد مقياس A/B/C/D مع قواعد واضحة لكل درجة.
- **Consequences:** + شفافية. - قد يحتاج تدريب المستخدمين.
- **Alternatives:** نسبة مئوية فقط → رفض لأنها غير واضحة.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-011: Evidence Bundle مع كل نتيجة

- **Context:** التقارير والشهادات تحتاج أدلة.
- **Decision:** كل نتيجة من المحركات ترفق Evidence Bundle (مصدر، تاريخ، قيمة، ثقة).
- **Consequences:** + قابلية التدقيق. - حجم البيانات.
- **Alternatives:** روابط فقط → رفض لأنها هشة.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-012: Simulation Engine Server-side

- **Context:** Monte Carlo والمحاكاة ثقيلة على المتصفح.
- **Decision:** تنفيذ Simulation Engine على الخادم (Vercel function / background job).
- **Consequences:** + أداء. - تكلفة حساب.
- **Alternatives:** Client-side → رفض لضعف الأداء.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-013: AI Analyst محدود في قراراته

- **Context:** AI يمكن أن يخطئ في قرارات مالية.
- **Decision:** AI Analyst يقدم تحليل وتوصيات، لكن القرار النهائي للمستخدم.
- **Consequences:** + أمان. - قد يبدو أقل "ذكاءً".
- **Alternatives:** AI autonomous decisions → رفض لأسباب قانونية/أخلاقية.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-014: Bilingual Prompts (ar/en)

- **Context:** المنصة تدعم العربية والإنجليزية.
- **Decision:** جميع قوالب AI ثنائية اللغة مع رقم RTL منسق.
- **Consequences:** + تجربة موحدة. - جهد إضافي.
- **Alternatives:** ترجمة تلقائية بعد التوليد → رفض لجودة أقل.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-015: Plugin Architecture بعد الاستقرار

- **Context:** رغبة في دعم قطاعات جديدة بسرعة.
- **Decision:** بناء Plugin Runtime بعد استقرار Economic Brain و UDL.
- **Consequences:** + توسع. - يتطلب عزل أمان.
- **Alternatives:** fork codebase per sector → رفض لأنه غير مستدام.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-016: Unified Command Centers (Client + Admin)

- **Context:** الصفحات الحالية متفرقة.
- **Decision:** بناء Client Command Center و Admin Command Center كتطبيقات SPA مستقلة.
- **Consequences:** + تجربة موحدة. - تكلفة تطوير.
- **Alternatives:** تحسين الصفحات الحالية → رفض لحدود التوسع.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-017: Reports Engine قوالب مبنية على Evidence

- **Context:** التقارير الحالية ثابتة ومكررة.
- **Decision:** Reports Engine يستخدم قوالب مع Evidence Summary وقابلية تخصيص.
- **Consequences:** + مرونة. - تعقيد القوالب.
- **Alternatives:** PDF static → رفض لقلة التفاعل.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-018: Smart Certificates مرتبطة بالأدلة

- **Context:** الشهادات تحتاج للثقة والتحقق.
- **Decision:** الشهادة = نتيجة + Evidence Bundle + توقيع رقمي (HMAC) + QR.
- **Consequences:** + موثوقية. - تعقيد الإصدار.
- **Alternatives:** PDF ثابت → رفض لسهولة التزوير.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-019: Feature Flags لكل تحول كبير

- **Context:** التحولات الكبيرة تحتاج إطلاقاً تدريجياً.
- **Decision:** استخدام Feature Flags لكل Epic يؤثر على UX.
- **Consequences:** + rollback سريع. - تعقيد الإدارة.
- **Alternatives:** direct launch → رفض لخطورة الانقطاع.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-020: V3 Router بدون wrapper

- **Context:** Vercel Hobby يسمح بـ 12 function فقط.
- **Decision:** `/api/v3/*` يُوجه مباشرة إلى `v3/api/index.js` بدلاً من wrapper.
- **Consequences:** + توفير functions. - يتطلب إعادة كتابة التوجيه.
- **Alternatives:** زيادة الخطة → رفض لأسباب تكلفة.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-021: Rate Limiting مركزي

- **Context:** العديد من الـ APIs لا تحتوي على rate limiting.
- **Decision:** تطبيق Rate Limiter مركزي على مستوى API.
- **Consequences:** + حماية. - قد يؤثر على المستخدمين الشرعيين.
- **Alternatives:** rate limit per endpoint → رفض لصعوبة الصيانة.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-022: Unified Admin Middleware

- **Context:** توجد verifyAdmin و verifyAdminStrict مكررة.
- **Decision:** دمجها في middleware واحد يقبل مستويات صلاحية.
- **Consequences:** + صيانة. - تغيير في كل APIs.
- **Alternatives:** إبقاؤهما → رفض لتكرار المنطق.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-023: Self-Learning بدون تغيير تلقائي

- **Context:** النظام المستقبلي يتعلم من القرارات.
- **Decision:** Self-Learning يقترح تحسينات فقط؛ لا يغير النماذج/الصيغ بدون موافقة.
- **Consequences:** + أمان. - بطء التحسن.
- **Alternatives:** Auto-update → رفض لخطر drift.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-024: i18n Engine بدلاً من Mirrors يدوية

- **Context:** النسخة الإنجليزية تعتمد على ملفات مرآة يدوية.
- **Decision:** بناء i18n Engine لإدارة المحتوى متعدد اللغات.
- **Consequences:** + صيانة. - migration كبير.
- **Alternatives:** continue manual mirrors → رفض لغير المستدام.
- **Status:** Proposed
- **Date:** 2026-06-24

### ADR-025: Calculators redirect إلى Expert Engines

- **Context:** هناك 113 حاسبة مستقلة.
- **Decision:** بعد بناء Expert Engines، تحول الحاسبات إلى روابط redirect مع fallback.
- **Consequences:** + تجربة موحدة. - فقدان بعض المستخدمين المتعودين.
- **Alternatives:** delete calculators immediately → رفض لخسارة traffic.
- **Status:** Proposed
- **Date:** 2026-06-24

---

## 4. سجل القرارات المتعارضة

| القرار | المتعارض مع | الحل |
|---|---|---|
| ADR-006 Decision Graph | أداء real-time | تحديث جزئي مع debounce |
| ADR-012 Server-side Simulation | تكلفة Vercel | استخدام background jobs / edge |
| ADR-014 Bilingual Prompts | حجم القوالب | تخزين في Knowledge Cloud |

---

## 5. ملاحظات

- كل ADR يجب أن يُعاد فحصه قبل تنفيذ القرار.
- القرارات المرفوضة يجب أن تُوثق أيضاً لتجنب إعادة النقاش.
