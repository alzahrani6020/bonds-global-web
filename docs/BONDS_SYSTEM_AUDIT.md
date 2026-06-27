# BONDS System Audit — تقرير تدقيق شامل لمنصة بوندز

> **الحالة:** Read-Only  
> **التاريخ:** 2026-06-27  
> **المرجع:** المعايير الهندسية في `docs/standards/`  
> **الملاحظة:** هذا التقرير يعتمد على أدوات التدقيق المتاحة (`npm run audit`، `npm run audit:og`، `npm run audit:migrations`، `npm run test:a11y`، `npm run test:mobile`) وعلى تحليل عينة من الملفات وعلى مراجعة آلية بواسطة أدوات البحث. لا يزال هناك حاجة لتدقيق يدوي أعمق في بعض المسارات.

---

## Executive Summary

### الوضع العام
المنصة تمر بمرحلة انتقالية حاسمة. المكونات الجديدة (محرك التقييم BONDS Valuation Intelligence، الذكاء السوقي، تقييم الحالة، الذكاء الاصطناعي، شهادة BDVC) تتبع رؤية المنصة الجديدة بشكل جيد، لكن الإرث القديم (226 صفحة حاسبة، بيانات ثابتة في JS، تكرار الجداول، نقاط نهاية Legacy) يشكل ديوناً تقنية كبيرة.

### النتائج الإيجابية
- جميع الاختبارات تمر (`npm test`: 382/383 ناجح مع خطأ متقطع يُعاد اختباره بنجاح).
- تدقيق الموقع `npm run audit`: **0 issues**.
- Open Graph / Twitter Card audit: **100% complete**.
- تدقيق migrations: **68 migration مرتبة**.
- Accessibility audit: **لا توجد مخالفات critical/serious**.
- Mobile interaction audit: **جميع الاختبارات ناجحة**.

### القضايا الحرجة (Critical)
1. **226 صفحة حاسبة منفصلة** تخالف معيار المعمارية (M1).
2. **نقاط نهاية إدارة غير مصادقة** (`api/admin.js` force reset / reset link) تخالف معيار الأمن (M2).
3. **V3 router مُغلّف في `api/v3/index.js`** بدلاً من التوجيه المباشر إلى `v3/api/index.js`.
4. **بيانات جغرافية وقطاعية ثابتة في JS** بحجم آلاف الأسطر (`country-platforms-data.js`، `shared-platforms.js`، `v3/master-data/...`).
5. **تكرار بيانات المستخدم** بين `auth.users` و `profiles`.

---

## Architecture Audit

### Critical
- **226 صفحة حاسبة منفصلة** في `calculators/` و `en/calculators/`.
  - المواقع: `calculators/*.html` (226 ملف).
  - المعيار: `01_ARCHITECTURE_STANDARD.md` M1.
  - الأثر: كل صفحة تعزل تجربة المستخدم عن الرحلة المركزية وتُكرر المنطق.
  - الإصلاح: تحويل كل أداة إلى Expert Engine يُستدعى داخل رحلة موحدة.

- **V3 router مُغلّف في `api/v3/index.js`.**
  - الموقع: `vercel.json` + `api/v3/index.js`.
  - المعيار: `01_ARCHITECTURE_STANDARD.md` M5 + `08_API_STANDARD.md` M5.
  - الأثر: توجيه إضافي غير ضروري ويُبقي ملفات في `api/v3/`.
  - الإصلاح: توجيه `/api/v3/*` مباشرة إلى `v3/api/index.js`.

### High
- **ترحيلات V3 موجودة خارج `supabase/migrations/`.**
  - الموقع: `v3/supabase/migrations/*` (22 ملف).
  - المعيار: `09_DATABASE_STANDARD.md` M1.
  - الأثر: `npm run audit:migrations` لا يتحقق منها؛ مخاطر تفاوت schema.
  - الإصلاح: نقل/دمج كل ترحيلات V3 في `supabase/migrations/`.

- **صفحات قطاعية مكررة لكل دولة.**
  - الموقع: `sectors/manufacturing-*.html`، `calculators/factory-cost-*.html`.
  - المعيار: `01_ARCHITECTURE_STANDARD.md` M4.
  - الأثر: نفس المنطق مكرر 20+ مرة.
  - الإصلاح: صفحة واحدة ديناميكية تستقبل كود الدولة.

### Medium
- **لا يوجد BONDS Intelligence Core موحّد.**
  - الأثر: المحركات الجديدة تتواصل يدوياً أو عبر localStorage، مما يعيق Decision Graph.
  - الإصلاح: بناء نواة مركزية لنشر الأحداث والحالة.

---

## UX Audit

### Critical
- **المنصة لا تبدأ بالنية.**
  - الأثر: المستخدم يصل إلى صفحات حاسبات قبل تحديد هدفه.
  - المعيار: `02_UI_UX_STANDARD.md` M1.
  - الإصلاح: إنشاء Intent Selector في الصفحة الرئيسية وجميع نقاط الدخول.

### High
- **وجود صفحات بعنوان "حاسبة" أو "Calculator".**
  - الأثر: يعزز مفهوم الأدوات المنفصلة.
  - المعيار: `02_UI_UX_STANDARD.md` M2.
  - الإصلاح: إعادة تسمية وإعادة هيكلة الصفحات كخطوات في رحلة.

### Medium
- **عدم وجود رحلة موحدة بين الحاسبات والتقييم والتمويل.**
  - الأثر: المستخدم يفقد السياق عند الانتقال بين الأقسام.
  - الإصلاح: بناء wizard مركزي يتكيف مع الهدف.

---

## UI Audit

### High
- **6,363 استخدام لـ `style=` في ملفات HTML.**
  - المعيار: `03_DESIGN_STANDARD.md` M4.
  - الأثر: صعوبة الصيانة وتجاوز نظام التصميم.
  - الإصلاح: نقل الأنماط الثابتة إلى CSS classes.

- **99 استخدام لـ `!important` في ملفات CSS.**
  - المعيار: `03_DESIGN_STANDARD.md` M3.
  - الأثر: صعوبة تخصيص الأنماط والأولويات.
  - الإصلاح: إعادة كتابة selectors لإزالة الحاجة إلى `!important`.

### Medium
- **2,516 قيمة لونية ثابتة (`#...`) في HTML/CSS.**
  - المعيار: `03_DESIGN_STANDARD.md` M1.
  - الأثر: ألوان خارج نظام التصميم قد تظهر في أجزاء مختلفة.
  - الإصلاح: استبدال الألوان بمتغيرات CSS.

---

## Design Audit

### High
- **عدم وجود شعار عالمي موحّد.**
  - المعيار: `03_DESIGN_STANDARD.md` (الشعار).
  - الأثر: الهوية البصرية لا تعكس رؤية المنصة الجديدة.
  - الإصلاح: إعادة تصميم الشعار وفق متطلبات الدستور.

### Medium
- **اختلاف أنماط الصفحات القديمة عن الجديدة.**
  - الأثر: تجربة غير متسقة للمستخدم.
  - الإصلاح: تطبيق نظام التصميم على جميع الصفحات تدريجياً.

---

## Database Audit

### Critical
- **تكرار بيانات المستخدم بين `auth.users` و `profiles`.**
  - الموقع: `profiles` (email, phone, country, city, business_type, branch_count, ...).
  - المعيار: `04_DATA_STANDARD.md` M1 + `09_DATABASE_STANDARD.md` M1.
  - الأثر: مصدر حقيقة مزدوج.
  - الإصلاح: قراءة البيانات من `auth.users` و `user_metadata` أو view.

### High
- **جدولان للسيناريوهات.**
  - الموقع: `public.scenarios` و `public.project_scenarios`.
  - المعيار: `04_DATA_STANDARD.md` M1.
  - الأثر: تكرار تخزين السيناريوهات.
  - الإصلاح: دمج الجدولين.

- **ترحيلات V3 خارج المسار الرسمي.**
  - الموقع: `v3/supabase/migrations/*`.
  - المعيار: `09_DATABASE_STANDARD.md` M1.
  - الإصلاح: نقلها إلى `supabase/migrations/`.

### Medium
- **بيانات خارجية تفتقر إلى حق lineage كاملة.**
  - الموقع: `economic_life_database`، `depreciation_factors`.
  - المعيار: `04_DATA_STANDARD.md` M2.
  - الإصلاح: إضافة `source`، `collected_at`، `valid_until`، `raw_value`.

- **أعمدة أجنبية بدون indexes.**
  - الأثر: بطء في الاستعلامات المتكررة.
  - الإصلاح: إضافة indexes على كل FKs.

### Low
- **نقص تعليقات الجداول والأعمدة.**
  - الموقع: ~47 جدول بدون `COMMENT ON TABLE`.
  - المعيار: `09_DATABASE_STANDARD.md` M2.
  - الإصلاح: إضافة تعليقات وصفية.

---

## API Audit

### Critical
- **نقاط نهاية إدارة غير مصادقة.**
  - الموقع: `api/admin.js` (`handleForceReset`، `handleResetLink`).
  - المعيار: `07_SECURITY_STANDARD.md` M2 + `08_API_STANDARD.md`.
  - الأثر: احتمالية الاستيلاء على الحسابات.
  - الإصلاح: مطالبة بـ bearer token أو OTP.

### High
- **استجابات JSON غير موحدة.**
  - الأثر: صعوبة في معالجة الأخطاء من الواجهة.
  - المعيار: `08_API_STANDARD.md` M1.
  - الإصلاح: تبني envelope موحد `{success, data, error, statusCode}`.

- **خطأ في `api/v3/index.js` باستخدام `res.json()` غير موجود.**
  - المعيار: `08_API_STANDARD.md` M2.
  - الإصلاح: استخدام `sendJson(res, status, data)`.

- **CORS wildcard على جميع API بما فيها المصادقة.**
  - المعيار: `07_SECURITY_STANDARD.md` M4.
  - الإصلاح: تقييد CORS للنطاقات المعروفة على endpoints المصادقة.

### Medium
- **مستندات API inventory غير محدّثة.**
  - الموقع: `docs/API_INVENTORY.md`.
  - المعيار: `08_API_STANDARD.md` M6.
  - الإصلاح: إعادة إنشاء المستند من `vercel.json` والمعالجات الفعلية.

- **`/api/analyze-feasibility.js` يعيد أخطاء بـ HTTP 200.**
  - المعيار: `08_API_STANDARD.md` M2.
  - الإصلاح: استخدام رموز حالة صحيحة.

---

## AI Audit

### High
- **القوالب بالعربية فقط.**
  - الموقع: `lib/ai/prompts.js`.
  - الأثر: الواجهة الإنجليزية تنتج تقارير عربية.
  - المعيار: `05_AI_STANDARD.md` (UX + i18n).
  - الإصلاح: بناء قوالب بلغة المستخدم.

### Medium
- **لا يوجد Explainability كامل لكل توصية.**
  - الإصلاح: إجبار النموذج على تبرير كل قرار.

### Positive Findings
- AI لا يغيّر الأرقام المالية.
- المخرجات منظمة بـ JSON.
- توجد quality gates (80/80 للتقارير، 85/80 للشهادات).
- لا توجد أسرار AI مكشوفة في الواجهة الأمامية.

---

## Calculation Audit

### High
- **الحاسبات القديمة تحتوي على منطق حسابي مباشر في HTML/JS.**
  - الأثر: صعوبة الصيانة والاختبار.
  - المعيار: `06_CALCULATION_STANDARD.md` M1.
  - الإصلاح: استخراج المنطق إلى modules مستقلة مع unit tests.

### Medium
- **وجود أرقام سحرية في الحاسبات القديمة.**
  - مثال: معدلات VAT، رسوم المنصات، معدلات النمو.
  - الإصلاح: تحويلها إلى ثوابت موثقة.

### Positive Findings
- `tests/valuation-engine.test.js` و `tests/ai-validation-engine.test.js` و `tests/valuation-certificate.test.js` تغطي المحركات الجديدة.
- `valuation-engine.js` يتبع BVS ويُنتج scores وثقة.

---

## Valuation Audit

### Positive
- تم بناء `ValuationEngine` وفق معايير BONDS Valuation Standards.
- يدعم 35 فئة أصول.
- يتكامل مع Condition Assessment، Risk Intelligence، Market Intelligence، Depreciation.
- يدعم AI Valuation Analyst و BDVC.

### Medium
- **القيم المالية لا تتدفق تلقائياً إلى محركات التمويل والتدفقات النقدية.**
  - الأثر: المستخدم يعيد إدخال نفس البيانات.
  - الإصلاح: ربط نتائج التقييم بـ Financing Engine و Cashflow Engine.

---

## Financing Audit

### High
- **التمويل موجود كحاسبات منفصلة وليس كمحرك مركزي.**
  - الموقع: `calculators/loan.html` وما يشابه.
  - الإصلاح: بناء Financing Engine يستقبل بيانات المشروع/الأصل ويُنتج هيكل تمويل متكامل.

### Medium
- **لا يوجد ارتباط بين جدارة الائتمان والتقييم.**
  - الإصلاح: تغذية Risk Intelligence Engine ببيانات التقييم.

---

## Security Audit

### Critical
- **نقاط نهاية admin reset غير مصادقة** (مفصلة في API Audit).
- **إنشاء حسابات بدون تحقق من البريد.**
  - الموقع: `api/platform.js` و `v3/api/auth.js` (`email_confirm: true`).
  - الإصلاح: `email_confirm: false` + captcha + rate limiting.

### High
- **CORS wildcard على endpoints المصادقة.**
  - الإصلاح: تقييد النطاقات.

### Medium
- **`api/env.js` يكشف معلومات إدارية.**
  - الموقع: `ADMIN_EMAIL`، `STRIPE_PRICE_*`.
  - الإصلاح: إظهار القيم العامة فقط.

- **V3 admin master-data update يقبل body كاملاً.**
  - الإصلاح: whitelist للحقول المسموح بتعديلها.

---

## Performance Audit

### Medium
- **عدد كبير من ملفات HTML (226 حاسبة + 22 قطاع + ...).**
  - الأثر: زيادة وقت البناء والنشر.
  - الإصلاح: دمج الصفحات الديناميكية.

- **ملفات JS ثابتة كبيرة تحمل بيانات جغرافية.**
  - الموقع: `v3/master-data/countries-governorates-cities.js`.
  - الإصلاح: نقل البيانات إلى DB وتحميلها عند الحاجة.

### Positive
- `sw.js` يُدار بإصدار يدوي ويُحدّث مع التغييرات.
- الأصول تستخدم query strings للإصدار.

---

## SEO Audit

### Positive
- جميع الصفحات المدققة تحتوي على Open Graph و Twitter Card كاملة.
- الروابط Canonical موجودة.

### Medium
- **بعض الصفحات غير مترجمة.**
  - الموقع: `blog/*.html`، `sectors/*.html`.
  - الإصلاح: توفير نسخ إنجليزية أو وضع علامة `hreflang`.

---

## Accessibility Audit

### Positive
- `npm run test:a11y`: لا توجد مخالفات critical/serious في الصفحات المختبرة.
- Universal Dropdown يدعم keyboard و reduced-motion.

### Medium
- **بعض الحاسبات القديمة قد لا تمر على a11y** لأنها لم تُختبر.
  - الإصلاح: توسيع تغطية اختبارات a11y لتشمل جميع الرحلات.

---

## Internationalization Audit

### High
- **226 حاسبة عربية لها نظائر إنجليزية.**
  - الأثر: صعوبة الصيانة والتزامن.
  - الإصلاح: دمج النسختين في صفحات ديناميكية تعتمد على `lang`.

### Medium
- **المحتوى العربي في قوالب AI.**
  - الإصلاح: دعم اللغة الإنجليزية في التقارير الذكية.

---

## Technical Debt

1. ** calculators / old HTML pages** — أكبر دين تقني.
2. **Hardcoded geographic & sector data in JS**.
3. **Legacy APIs inconsistent with V3 standards**.
4. **Duplicate tables (profiles, scenarios)**.
5. **Inline styles and !important in CSS**.
6. **Outdated API inventory**.
7. **V3 migrations scattered**.

---

## Duplicate Components

- **منسدلات مخصصة vs UniversalDropdown:** بعض الصفحات لا تزال تستخدم `<select>` الأصلي أو منسدلات قديمة.
- **بطاقات النتائج:** تكرار تصميم البطاقات في `valuation/valuation.css`، `styles/components.css`، وملفات الحاسبات.
- **footer التقارير:** `calculators/shared-export.js` ونُسخ أخرى في صفحات منفصلة.

## Duplicate Pages

- `calculators/factory-cost-*.html` — 22 صفحة لكل دولة.
- `sectors/manufacturing-*.html` — 22 صفحة لكل دولة.
- `en/calculators/*` — مرآة لـ `calculators/*`.

## Dead Code

- **ملفات SQL يدوية:** `supabase/all-migrations-combined.sql`، `apply-all-latest.sql`، `market-intelligence-manual-apply.sql`.
- **ملفات نسخ احتياطية:** `calculators/feasibility-template-backup.html`.
- **ملفات debug/diagnose:** `calculators/auth/debug.html`، `calculators/auth/diagnose.html`.
- **Old auth files:** `bonds-auth.js` / `bonds-auth-2026.js` قد تكون واحدة منهما قديمة.

## Unused Files

- يحتاج إلى تدقيق يدوي أعمق باستخدام أداة تحليل الاستيرادات (imports) أو `coverage`.
- عينات تحتاج مراجعة:
  - `calculators/feasibility-template-backup.html`
  - `calculators/shared-utils.js` (قد يكون بديلاً عن `shared-platforms.js`)
  - `scripts/add-inline-footers.js` (قد يكون قديماً)

## Broken Navigation

- `npm run audit`: **0 broken links**.
- لكن، بعض الحاسبات قد لا تكون مربوطة بالتنقل الرئيسي وتعتمد على الوصول المباشر.

## Missing Integrations

1. **Valuation → Financing:** نتائج التقييم لا تُغذي محرك التمويل.
2. **Valuation → Cashflow:** القيم لا تتدفق إلى التدفقات النقدية.
3. **Market Intelligence → all engines:** لا تزال بعض الحاسبات تستخدم بيانات ثابتة.
4. **Live Data → Valuation/Financing:** التكامل محدود في المحركات الجديدة.
5. **AI Analyst → all engines:** حالياً مرتبط بالتقييم فقط.

## Data Quality

- البيانات الجديدة في `market_data` تحمل `confidence` و `data_quality_score`.
- البيانات القديمة في الحاسبات و `country-platforms-data.js` لا تحمل مصادر أو تواريخ.
- لا يوجد `data_overrides` logger بعد.

## Live Data Coverage

- **العقارات والريو:** KAPSARC.
- **المؤشرات المالية:** World Bank.
- **القطاعات الأخرى:** تغطية محدودة أو غير موجودة.

## User Journey Problems

1. الدخول من خلال قائمة حاسبات بدلاً من Intent Selector.
2. إعادة إدخال البيانات عند الانتقال بين الحاسبات.
3. عدم وضوح كيفية الوصول من التقييم إلى التمويل أو الشهادة.
4. غياب Digital Twin في الواجهة الأمامية.

---

## Quick Wins

1. **تحديث `docs/API_INVENTORY.md`** (سهل، Low risk).
2. **إصلاح `api/v3/index.js` لاستخدام `sendJson`** (سهل).
3. **إضافة `COMMENT ON TABLE` للجداول** (سهل).
4. **إضافة indexes على FKs** (سهل).
5. **إزالة inline styles من الصفحات الجديدة** (متوسط).
6. **تحديث CORS للنطاقات المعروفة** (متوسط).

---

## Critical Issues

1. 226 صفحة حاسبة منفصلة.
2. نقاط نهاية إدارة غير مصادقة.
3. V3 router wrapped في `api/v3/`.
4. بيانات جغرافية/قطاعية ثابتة ضخمة في JS.
5. تكرار بيانات المستخدم (auth.users vs profiles).

## High Priority

1. توحيد استجابات API.
2. دمج جداول السيناريوهات.
3. إعادة هيكلة صفحات القطاعات والمصانع المكررة.
4. تقييد CORS.
5. إضافة تحقق email/captcha للتسجيل.
6. نقل ترحيلات V3 إلى `supabase/migrations/`.
7. تحويل الحاسبات إلى Expert Engines.

## Medium Priority

1. دعم اللغة الإنجليزية في تقارير AI.
2. بناء Financing Engine مركزي.
3. إضافة Smart Data Override logger.
4. تحسين Live Data Coverage.
5. توسيع اختبارات a11y لتغطي جميع الرحلات.

## Low Priority

1. إعادة تصميم الشعار.
2. إضافة تعليقات لجميع الجداول.
3. توحيد المنسدلات القديمة مع UniversalDropdown.
4. إزالة ملفات SQL اليدوية القديمة.

## Future Enhancements

1. بناء BONDS Intelligence Core.
2. بناء Decision Graph Engine.
3. إطلاق Digital Twin للمستخدمين.
4. دعم الوضع الفاتح.
5. إطلاق mobile app (PWA أو native).
6. تكامل مع المزيد من مصادر البيانات الحية.
7. دعم تحليلات متعددة اللغات للذكاء الاصطناعي.

---

*التقرير يحتاج إلى مراجعة يدوية أعمق في بعض المسارات القديمة بعد اعتماد خطة الإصلاح.*
