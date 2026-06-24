# تقرير تدقيق الترجمة والتعريب — i18n Audit Report

**المشروع:** Bonds Global  
**تاريخ التقرير:** 2026-06-21  
**الملفات المُدقَّقة:** 202 ملف HTML ثابت

---

## ملخص تنفيذي

تم فحص البنية ثنائية اللغة للموقع (العربية `/` RTL، والإنجليزية `/en/` LTR). التقرير الحالي يعكس الحالة الراهنة للملفات بعد إعادة الفحص التلقائي.

| المؤشر | القيمة |
|--------|--------|
| إجمالي ملفات HTML المُدقَّقة | 202 |
| صفحات عربية | 94 |
| صفحات إنجليزية | 108 |
| مرايا إنجليزية مفقودة | 14 |
| مرايا عربية مفقودة | 0 |
| مشاكل lang/dir | 0 |
| صفحات إنجليزية تحتوي على نصوص عربية | 23 |
| إجمالي حروف عربية في الصفحات الإنجليزية | ~٢٤٬٨٩٨ |
| مشاكل locales مُعمَّدة | 54 |
| مشاكل عملة | 1 |
| صفحات بها روابط hreflang | 2 |

---

## 1. الترجمات المفقودة

### 1.1 صفحات عربية بلا مرايا إنجليزية

| الملف العربي | المرآة المتوقعة |
|--------------|-----------------|
| `admin/ai-business-advisor/index.html` | `en/admin/ai-business-advisor/index.html` |
| `admin/ai-reviews.html` | `en/admin/ai-reviews.html` |
| `admin/bank-transfers.html` | `en/admin/bank-transfers.html` |
| `admin/city-intelligence/index.html` | `en/admin/city-intelligence/index.html` |
| `admin/data-quality-center/index.html` | `en/admin/data-quality-center/index.html` |
| `admin/distressed-recovery/index.html` | `en/admin/distressed-recovery/index.html` |
| `admin/exceptions.html` | `en/admin/exceptions.html` |
| `admin/executive-dashboard/index.html` | `en/admin/executive-dashboard/index.html` |
| `admin/financial-advisory/index.html` | `en/admin/financial-advisory/index.html` |
| `admin/force-reset.html` | `en/admin/force-reset.html` |
| `admin/funding-sources.html` | `en/admin/funding-sources.html` |
| `admin/global-search/index.html` | `en/admin/global-search/index.html` |
| `admin/reset.html` | `en/admin/reset.html` |
| `admin/settings.html` | `en/admin/settings.html` |

### 1.2 صفحات إنجليزية بلا مرايا عربية

لا توجد مرايا عربية مفقودة. ✅

---

## 2. النصوص المختلطة (عربي في صفحات إنجليزية)

تم العثور على **23 ملفًا إنجليزيًا** يحتوي على حروف عربية، بإجمالي **~٢٤٬٨٩٨ حرف عربي**.

### 🔴 أولوية عالية (≥500 حرف عربي)

| الملف | عدد الحروف العربية |
|-------|-------------------:|
| `en/sectors/manufacturing-om.html` | 3846 |
| `en/sectors/manufacturing-ma.html` | 3784 |
| `en/sectors/manufacturing-bh.html` | 3683 |
| `en/sectors/manufacturing-kw.html` | 3621 |
| `en/sectors/manufacturing-qa.html` | 3604 |
| `en/sectors/manufacturing-tn.html` | 3582 |

### 🟡 أولوية متوسطة (50–499 حرف عربي)

| الملف | عدد الحروف العربية |
|-------|-------------------:|
| `en/calculators/feasibility-template-real-estate.html` | 335 |
| `en/calculators/factory-cost-ae.html` | 179 |
| `en/calculators/factory-cost-ly.html` | 172 |
| `en/calculators/factory-cost-sd.html` | 170 |
| `en/calculators/factory-cost-dz.html` | 166 |
| `en/calculators/factory-cost-iq.html` | 164 |
| `en/calculators/factory-cost-ye.html` | 161 |
| `en/calculators/factory-cost-sy.html` | 158 |
| `en/calculators/factory-cost-qa.html` | 156 |
| `en/calculators/factory-cost-jo.html` | 153 |
| `en/calculators/factory-cost-ma.html` | 151 |
| `en/calculators/factory-cost-om.html` | 146 |
| `en/calculators/factory-cost-lb.html` | 143 |
| `en/calculators/factory-cost-tn.html` | 142 |
| `en/calculators/factory-cost-kw.html` | 135 |
| `en/calculators/factory-cost-bh.html` | 127 |
| `en/calculators/factory-cost-eg.html` | 120 |

---

## 3. مشاكل RTL / LTR

لا توجد مشاكل في سمات `lang`/`dir`. ✅

### روابط hreflang

عدد الصفحات التي تحتوي على روابط hreflang: **2**

| الملف |
|-------|
| `blog/index.html` |
| `blog/en/index.html` |

---

## 4. النصوص والتواريخ والعملات المُعمَّدة

### 4.1 Locales مُعمَّدة بشكل ثابت

| الملف | السطر | المشكلة |
|-------|-------|---------|
| `admin/subscriptions.html` | 253 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator-v2.html` | 534 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator-v2.html` | 537 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator-v2.html` | 1099 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator-v2.html` | 1100 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator-v2.html` | 1101 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator-v2.html` | 1102 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator-v2.html` | 1087 | hardcoded locale "en-GB" in Arabic file (expected ar-*) |
| `calculator.html` | 461 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator.html` | 464 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator.html` | 1062 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator.html` | 1063 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator.html` | 1064 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator.html` | 1065 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculator.html` | 1050 | hardcoded locale "en-GB" in Arabic file (expected ar-*) |
| `calculators/cash-flow.html` | 264 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/dish-margin.html` | 931 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/dish-margin.html` | 986 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/dish-margin.html` | 997 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/loan.html` | 326 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/loan.html` | 714 | hardcoded locale "en-GB" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 375 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 378 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 381 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 580 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 581 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 582 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 583 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 584 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 585 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 586 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 588 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 594 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 595 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 596 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 597 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 598 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 599 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 600 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 603 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 604 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 605 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 606 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 607 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 608 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 609 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 610 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 611 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 612 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/pricing.html` | 614 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/restaurant.html` | 1134 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/restaurant.html` | 1172 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `calculators/restaurant.html` | 1183 | hardcoded locale "en-US" in Arabic file (expected ar-*) |
| `en/calculators/loan.html` | 894 | hardcoded locale "ar-SA" in English file (expected en-*) |

### 4.2 مشاكل رموز العملة

| الملف | السطر | المشكلة |
|-------|-------|---------|
| `admin/funding-sources.html` | 97 | SAR symbol used in Arabic file (1 occurrences) |

---

## 5. التوصيات

1. معالجة الصفحات الإنجليزية عالية الأولوية ذات النصوص العربية المختلطة.
2. إضافة روابط `hreflang` للصفحات الرئيسية والحاسبات لتحسين SEO ثنائي اللغة.
3. استخدام دالة مساعد موحدة لتنسيق الأرقام والتواريخ والعملات حسب لغة الصفحة.
4. إنشاء المرايا المفقودة للصفحات ذات الأولوية العالية.

### اقتراح دالة مساعد مشتركة

```javascript
function formatLocale(value, type = "number", options = {}) {
  const lang = document.documentElement.lang || "ar";
  const locale = lang.startsWith("en") ? "en-US" : "ar-SA";
  if (type === "date") return new Date(value).toLocaleDateString(locale, options);
  if (type === "currency") {
    return value.toLocaleString(locale, { style: "currency", currency: options.currency || "SAR", ...options });
  }
  return value.toLocaleString(locale, options);
}
```

---

## 6. الملاحق

### أ. عدد الملفات حسب القسم

| القسم | ملفات عربية | ملفات إنجليزية | الإجمالي |
|-------|-------------:|----------------:|----------:|
| en | 0 | 102 | 102 |
| calculators | 49 | 0 | 49 |
| admin | 20 | 0 | 20 |
| blog | 6 | 6 | 12 |
| client | 5 | 0 | 5 |
| about.html | 1 | 0 | 1 |
| advisor | 1 | 0 | 1 |
| advisors.html | 1 | 0 | 1 |
| auth-v2.html | 1 | 0 | 1 |
| auth.html | 1 | 0 | 1 |
| calculator-v2.html | 1 | 0 | 1 |
| calculator.html | 1 | 0 | 1 |
| contact.html | 1 | 0 | 1 |
| faq.html | 1 | 0 | 1 |
| for-banks.html | 1 | 0 | 1 |
| funding-readiness.html | 1 | 0 | 1 |
| funding-sources.html | 1 | 0 | 1 |
| index.html | 1 | 0 | 1 |
| methodology.html | 1 | 0 | 1 |

### ب. إعادة تشغيل التدقيق

```bash
node scripts/i18n-audit.js
```
