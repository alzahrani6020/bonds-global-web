# BONDS Platform Governance — حوكمة المنصة

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة تأسيس — لا يحتوي على كود

---

## 1. الرؤية

تحديد من يحق له اتخاذ قرارات التغيير في BONDS، وما هي دورة الموافقات المطلوبة لكل نوع من التغييرات.

---

## 2. الأدوار الحاكمة

| الدور | المسؤوليات |
|---|---|
| **Product Owner** | الموافقة على الميزات، الأولويات، والتغييرات التي تؤثر على رحلة المستخدم. |
| **Lead Architect** | الموافقة على التغييرات المعمارية، المحركات، والتكاملات. |
| **Engineering Lead** | الموافقة على التغييرات التقنية، الاعتماديات، والبنية التحتية. |
| **Security Lead** | الموافقة على APIs، الأدوار، RLS، والتكاملات الخارجية. |
| **Data Lead** | الموافقة على مصادر البيانات، جودة البيانات، والتعديلات على schema. |
| **AI Lead** | الموافقة على النماذج، القوالب، guardrails، والتعلم الذاتي. |
| **Content Lead** | الموافقة على المحتوى القطاعي، المصطلحات، والترجمات. |
| **Compliance Lead** | الموافقة على الشهادات، التقارير، والامتثال. |

---

## 3. دورة الموافقات العامة

```text
Proposal → Review → Approval → Implementation → Verification → Documentation
```

- **Proposal**: صاحب الفكرة يكتب مقترحاً قصيراً يوضح الهدف والتأثير.
- **Review**: المراجعون المعنيون يقيمون التأثير على Constitution و Standards.
- **Approval**: صاحب القرار يوافق أو يرفض.
- **Implementation**: التنفيذ وفق المعايير.
- **Verification**: اختبار وتدقيق.
- **Documentation**: تحديث الوثائق.

---

## 4. قواعد التغيير حسب النوع

### 4.1 إضافة حاسبة / محرك خبير

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Product Owner + Lead Architect |
| **الموافقات** | Product Owner → Lead Architect → Engineering Lead |
| **الشروط** | 1. تخدم قراراً واضحاً. <br>2. لا تُنشئ صفحة منفصلة. <br>3. تستخدم UDL. <br>4. تتواصل مع Economic Brain. |
| **المدة** | 3–5 أيام عمل. |

### 4.2 حذف حاسبة / محرك

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Product Owner + Lead Architect |
| **الموافقات** | Product Owner → Lead Architect → Engineering Lead |
| **الشروط** | 1. لا يوجد مستخدمون يعتمدون عليها. <br>2. يوجد redirect أو بديل. <br>3. تحديث الوثائق. |
| **المدة** | 3–5 أيام عمل. |

### 4.3 تعديل معادلة

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Lead Architect + Data Lead |
| **الموافقات** | Data Lead → Lead Architect → Compliance Lead |
| **الشروط** | 1. توثيق التغيير في Formula Catalog. <br>2. اختبار على حالات معروفة. <br>3. تحديث التقارير إذا لزم. |
| **المدة** | 2–4 أيام عمل. |

### 4.4 إضافة مصدر بيانات

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Data Lead |
| **الموافقات** | Data Lead → Security Lead → Lead Architect |
| **الشروط** | 1. تسجيل في Data Source Registry. <br>2. تحديد Confidence Score. <br>3. مراجعة أمنية للـ API. <br>4. تحديد Fallback. |
| **المدة** | 3–5 أيام عمل. |

### 4.5 تعديل شهادة

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Compliance Lead + Product Owner |
| **الموافقات** | Compliance Lead → Product Owner → Lead Architect |
| **الشروط** | 1. لا يؤثر على الشهادات الصادرة. <br>2. تحديث template وverify logic. <br>3. اختبار QR/verify. |
| **المدة** | 3–5 أيام عمل. |

### 4.6 تعديل تقرير

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Product Owner + Content Lead |
| **الموافقات** | Content Lead → Product Owner → Engineering Lead |
| **الشروط** | 1. لا يُغيّر المعنى القانوني. <br>2. تحديث النسختين ar/en. <br>3. اختبار PDF/Excel/DOCX. |
| **المدة** | 2–4 أيام عمل. |

### 4.7 إضافة قطاع

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Product Owner + Lead Architect |
| **الموافقات** | Product Owner → Lead Architect → Data Lead → Content Lead |
| **الشروط** | 1. تعريف القطاع في Knowledge Graph. <br>2. توفير بيانات قطاعية. <br>3. إضافة Business Rules. <br>4. تحديث UX Dictionary. |
| **المدة** | 5–10 أيام عمل. |

### 4.8 إضافة Plugin

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Lead Architect |
| **الموافقات** | Lead Architect → Engineering Lead → Security Lead |
| **الشروط** | 1. يستخدم Plugin Runtime. <br>2. يتواصل مع UDL فقط. <br>3. Security Review. <br>4. توثيق interfaces. |
| **المدة** | 5–10 أيام عمل. |

### 4.9 إضافة AI Model / Prompt

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | AI Lead |
| **الموافقات** | AI Lead → Lead Architect → Compliance Lead |
| **الشروط** | 1. JSON schema واضح. <br>2. Quality Gates. <br>3. Bilingual عند الحاجة. <br>4. No hallucination guardrails. |
| **المدة** | 3–7 أيام عمل. |

### 4.10 إضافة API

| البند | التفاصيل |
|---|---|
| **من يحق له؟** | Engineering Lead + Security Lead |
| **الموافقات** | Engineering Lead → Security Lead → Lead Architect |
| **الشروط** | 1. يمر عبر `v3/api/index.js`. <br>2. CORS/Auth/Rate limit محدد. <br>3. Validation schema. <br>4. API Inventory updated. |
| **المدة** | 3–5 أيام عمل. |

---

## 5. سجل التغييرات

كل تغيير يجب أن يُسجل في:

- `docs/foundation/FOUNDATION_CONFLICTS.md` إذا كان هناك تعارض.
- `docs/architecture/ARCHITECTURE_CONFLICTS.md` إذا كان تعارضاً معمارياً.
- Audit Trail للتغييرات الحساسة.

---

## 6. القرارات الطارئة

- في حالات الطوارئ (Critical bug/security)، يمكن للـ Engineering Lead تنفيذ fix فوري مع إبلاغ Product Owner وLead Architect خلال 24 ساعة.
- يجب توثيق الإجراء ومراجعته لاحقاً.

---

## 7. ملاحظات

- لا يُسمح بتجاوز هذه الحوكمة.
- أي تغيير يخالف Constitution يُرفض تلقائياً.
- دورة الموافقات يمكن تسريعها لـ Hotfixes فقط.
