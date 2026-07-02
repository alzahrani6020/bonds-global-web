# معيار تسمية الحقول — BONDS Field Naming Standard

> **البرنامج:** BONDS Product Transformation Program (PTP) — Wave 2  
> **التاريخ:** 2026-07-02  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md` §2.2، `docs/FIELD_DICTIONARY.md`

---

## 1. الهدف

تحديد قواعد موحدة لتسمية الحقول في واجهة المستخدم والنماذج والتقارير، بحيث تكون بلغة **رجل الأعمال** وليست بلغة تقنية.

---

## 2. المبادئ

| # | المبدأ | الشرح |
|---|---|---|
| 1 | **لغة رجل الأعمال** | لا تستخدم مصطلحات تقنية مثل `capex` أو `opex` دون ترجمة. |
| 2 | **لا اختصارات بدون شرح** | `DSCR` → "نسبة تغطية خدمة الدين (DSCR)". |
| 3 | **توحيد المعنى** | كل معنى له اسم واحد فقط في كل الواجهات. |
| 4 | **وضوح التسمية** | كل حقل يحمل `label` واضحاً و`help text` عند الحاجة. |
| 5 | **دعم ثنائي اللغة** | كل حقل له اسم عربي وإنجليزي في `lib/i18n/fields.js`. |
| 6 | **التقارب من قاعدة البيانات** | الأعمدة التقنية تبقى كما هي؛ الواجهة تستخدم القاموس المركزي. |

---

## 3. الأسماء الموحدة للحقول الشائعة

| المعنى | الاسم في الواجهة (AR) | الاسم في الواجهة (EN) | العمود في قاعدة البيانات | ملاحظات |
|---|---|---|---|---|
| اسم المشروع | اسم المشروع | Project Name | `bonds_projects.name` | — |
| القطاع | القطاع | Sector | `bonds_projects.sector` | — |
| النشاط الفرعي | النشاط | Activity | `bonds_projects.activity` | دمج `sub_sector` و`activity` في الواجهة |
| الدولة | الدولة | Country | `cities.country_code` | ISO 3166-1 alpha-2 |
| المدينة | المدينة | City | `bonds_projects.city_id` → `cities.name` | — |
| العملة | العملة | Currency | `bonds_projects.currency` | — |
| رأس المال الاستثماري | رأس المال الاستثماري | Investment Capital | `bonds_projects.capital` | — |
| الإيرادات السنوية | الإيرادات السنوية | Annual Revenue | `bonds_projects.revenue` | — |
| صافي الربح السنوي | صافي الربح السنوي | Annual Net Profit | `bonds_projects.annual_profit` | — |
| أفق التوقعات | أفق التوقعات | Projection Horizon | `metadata.projection_years` | — |
| معدل نمو الإيرادات | معدل نمو الإيرادات | Revenue Growth Rate | `metadata.growth_rate` | — |
| معدل العائد المطلوب | معدل العائد المطلوب | Required Rate of Return | `metadata.discount_rate` | — |
| نسبة تغطية خدمة الدين | نسبة تغطية خدمة الدين (DSCR) | Debt Service Coverage Ratio (DSCR) | `bonds_financing.dscr` | — |
| القيمة الحالية الصافية | القيمة الحالية الصافية (NPV) | Net Present Value (NPV) | `bonds_valuations.npv` | — |
| معدل العائد الداخلي | معدل العائد الداخلي (IRR) | Internal Rate of Return (IRR) | `bonds_valuations.irr` | — |
| العائد على الاستثمار | العائد على الاستثمار (ROI) | Return on Investment (ROI) | `bonds_valuations.roi` | — |
| متوسط تكلفة رأس المال | متوسط تكلفة رأس المال (WACC) | Weighted Average Cost of Capital (WACC) | `bonds_financing.wacc` | — |

---

## 4. قواعد الاختصارات المالية

كل اختصار مالي يُعرض في الواجهة بالشكل:

```
الاسم الكامل (الاختصار)
```

مثال:
- `نسبة تغطية خدمة الدين (DSCR)`
- `القيمة الحالية الصافية (NPV)`
- `معدل العائد الداخلي (IRR)`

---

## 5. قواعد النماذج

1. كل حقل يحتوي على `<label>` مرتبط بـ `for`.
2. لا يُعتمد على `placeholder` كبديل للـ label.
3. الحقول الرقمية تستخدم تنسيق محلي (`ar-SA` / `en-US`).
4. الرسائل التوضيحية تستخدم `help text` وليس `title` فقط.
5. أزرار الإرسال تحمل نصاً واضحاً (مثال: "حفظ المشروع" بدلاً من "إرسال").

---

## 6. القاموس المركزي

المصدر الوحيد للحقول هو:

```
lib/i18n/fields.js
```

يجب تحديثه عند إضافة أي حقل جديد، ويجب على جميع الواجهات استخدامه.

---

## 7. المراجع

- `docs/BONDS_CONSTITUTION.md` §2.2
- `docs/FIELD_DICTIONARY.md`
- `lib/i18n/fields.js`
