# المكونات غير المستخدمة — Unused Components

> **البرنامج:** BONDS Product Transformation Program (PTP) — Wave 1  
> **الهدف:** تحديد الصفحات والمكونات والAPIs والمحركات غير المستخدمة أو المكررة أو القديمة.

---

## 1. ملخص

المنصة تحتوي على عدد كبير من الصفحات والمكونات بسبب التطور التدريجي. يوجد نسخ قديمة من نفس المفهوم، ومحركات مخططة لم تُبنَ بعد، ومكونات لا تُستخدم.

---

## 2. الصفحات غير المستخدمة أو المكررة

### 2.1 نسخ متعددة من نفس المفهوم

| المفهوم | النسخ القديمة | النسخ الحالية | التوصية |
|---|---|---|---|
| الحاسبة الرئيسية | `calculator.html`, `calculator-v2.html`, `calculator-wizard.html` | V3 / حاسبات القطاع | تحويل القديم إلى redirects |
| المصادقة | `auth.html`, `auth-v2.html` | `/calculators/auth/` + V3 auth | توحيد |
| دراسة الجدوى | `feasibility-template-backup.html` | `feasibility-template.html` | حذف backup |
| هندسة القائمة | `menu-engineering-simple.html` | `menu-engineering.html` | دمج/حذف |
| المطعم | `calculators/restaurant.html` | مركز الاستثمار | مراجعة |

### 2.2 صفحات ظلية أو تجريبية

| الصفحة | السبب | التوصية |
|---|---|---|
| `test.html` | صفحة اختبار | حذف أو نقل إلى `/_debug/` |
| `v.html` | URL قصير غير واضح | مراجعة |
| `calculators/auth/debug.html` | debug | تقييم الحاجة |
| `calculators/auth/diagnose.html` | diagnose | تقييم الحاجة |
| `modon_home.html`, `modon_eservices.html` | نسخ من موقع MODON | مراجعة قانونية/تقنية |
| `v3/node_modules/tslib/*.html` | أثر node_modules | حذف |

### 2.3 صفحات إدارية بدون مرآة إنجليزية

14 صفحة في `admin/` لا يوجد لها نظير في `en/admin/`:

- `admin/ai-business-advisor/index.html`
- `admin/ai-reviews.html`
- `admin/bank-transfers.html`
- `admin/city-intelligence/index.html`
- `admin/data-quality-center/index.html`
- `admin/distressed-recovery/index.html`
- `admin/exceptions.html`
- `admin/executive-dashboard/index.html`
- `admin/financial-advisory/index.html`
- `admin/force-reset.html`
- `admin/funding-sources.html`
- `admin/global-search/index.html`
- `admin/reset.html`
- `admin/settings.html`

---

## 3. APIs غير المستخدمة أو المكررة

| API | الحالة | التوصية |
|---|---|---|
| `/api/v3/billing/webhook` | مكرر مع `/api/webhook` | توحيد |
| `/api/pro` | قد يكون legacy | مراجعة |
| `/api/v3/auth/register` | ينشئ مستخدمين مؤكدين بدون تحقق | تقييم |
| `/api/v3/billing/checkout` | لا يتطلب auth | تقييم |
| `/api/v3/data/runs/:id`, `/api/v3/data/ml/models` | admin-facing بدون auth | تقييم |

---

## 4. المحركات والمكونات

### 4.1 مكونات JS/CSS

| المكون | المسار | الحالة |
|---|---|---|
| Universal Dropdown | `components/universal-dropdown.js` | ✅ مستخدم |
| Dropdown init | `components/universal-dropdown-init.js` | ✅ مستخدم |
| Dropdown CSS | `components/universal-dropdown.css` | ✅ مستخدم |

ملاحظة: يوجد 2 مكون فقط رسمياً؛ بقية المكونات مكتوبة inline في كل صفحة.

### 4.2 محركات مخططة غير مبنية

من `docs/MASTER_EXECUTION_PLAN.md`:

| المحرك | الحالة |
|---|---|
| Economic Brain | مخطط |
| Decision Graph | مخطط |
| Digital Twin | جزئي |
| Simulation Engine | مخطط |
| Recommendation Engine | جزئي |
| Autonomous Intelligence | مخطط |
| Self-Learning | مخطط |
| Decision OS | مخطط |

هذه ليست "غير مستخدمة" بل "غير موجودة بعد" ويجب أخذها في الحسبان في Wave 2/3.

### 4.3 ملفات بيانات ثابتة

| الملف | المشكلة | التوصية |
|---|---|---|
| `calculators/country-platforms-data.js` | يكرك `v3/master-data` | دمج/إزالة |
| `calculators/shared-platforms.js` | يُولّد من السابق | الاحتفاظ كـ cache فقط |
| `country-platforms-data.js` | بيانات دول/منصات | نقل إلى Supabase + cache |

---

## 5. CSS/JS Inline

من `docs/BONDS_SYSTEM_AUDIT.md`:

- **6,363** inline `style=` attributes.
- **99** `!important` rules.
- هذا يعني أن معظم "المكونات" ليست مكونات حقيقية، بل نسخ مطابقة من الأنماط في كل صفحة.

---

## 6. التوصيات

1. **إزالة/تحويل الصفحات القديمة**: `calculator.html`, `calculator-v2.html`, `calculator-wizard.html`, `auth.html`, `auth-v2.html`.
2. **حذف صفحات التجريب**: `test.html`, `v.html`, debug/diagnose إن لم تكن ضرورية.
3. **حذف `v3/node_modules/*.html`**.
4. **مراجعة `modon_*.html`** من الناحية القانونية.
5. **توحيد APIs المكررة** (webhooks, auth, billing).
6. **إنشاء مكونات UI حقيقية** بدلاً من inline styles.
7. **إنشاء `COMPONENT_INVENTORY.md`** في Wave 2.

---

## 7. المراجع

- `docs/PROJECT_AUDIT.md`
- `docs/BONDS_SYSTEM_AUDIT.md`
- `docs/API_INVENTORY.md`
- `docs/ROUTES_MAP.md`
- `docs/MASTER_EXECUTION_PLAN.md`
