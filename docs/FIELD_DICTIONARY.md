# قاموس الحقول — Field Dictionary

> **البرنامج:** BONDS Product Transformation Program (PTP) — Wave 1  
> **الهدف:** توثيق الحقول المستخدمة في النماذج، وتحديد التكرار، واقتراح أسماء موحدة بلغة رجل الأعمال.

---

## 1. منهجية التوحيد

بناءً على `docs/BONDS_CONSTITUTION.md` §2.2 و§6، يجب أن تكون جميع الحقول بلغة يفهمها رجل الأعمال، وليست لغة تقنية. القواعد:

- لا اختصارات بدون شرح (مثل DSCR، NPV، IRR).
- استخدام مصطلحات عربية/إنجليزية موحدة في كل النماذج.
- تجنب الحقول المكررة التي تجمع نفس المعنى.
- كل حقل يحمل `label` واضحاً و`help text` عند الحاجة.

---

## 2. الحقول الشائعة عبر المنصة

| المعنى | الاسم الحالي (متفرق) | الاسم المقترح (AR) | الاسم المقترح (EN) | الملاحظات |
|---|---|---|---|---|
| اسم المشروع | `project_name`, `name` | اسم المشروع | Project Name | يجب توحيده |
| القطاع | `sector`, `industry` | القطاع | Sector | `industry` نادر |
| النشاط الفرعي | `activity`, `sub_sector` | النشاط | Activity | بعض الصفحات تستخدم كليهما |
| رأس المال | `capital`, `investment` | رأس المال الاستثماري | Investment Capital | `investment` غامض |
| الإيرادات السنوية | `revenue`, `annual_revenue` | الإيرادات السنوية | Annual Revenue | توحيد اللاحقة |
| الأرباح السنوية | `annual_profit`, `profit` | صافي الربح السنوي | Annual Net Profit | |
| عدد السنوات | `years`, `projection_years` | أفق التوقعات | Projection Horizon | |
| معدل النمو | `growth_rate` | معدل نمو الإيرادات | Revenue Growth Rate | يحتاج إلى توضيح |
| التكلفة الأولية | `initial_cost`, `setup_cost` | التكلفة الاستثمارية الأولى | Initial Investment Cost | تكرار |
| التكلفة التشغيلية | `operating_cost`, `opex` | التكاليف التشغيلية السنوية | Annual Operating Costs | لا تستخدم opex |
| عدد الموظفين | `employee_count`, `employees` | عدد الموظفين | Number of Employees | |
| المدينة | `city`, `city_name`, `city_code` | المدينة | City | توحيد |
| الدولة | `country`, `country_code` | الدولة | Country | توحيد ISO |
| العملة | `currency` | العملة | Currency | |
| معدل الخصم | `discount_rate` | معدل العائد المطلوب | Required Rate of Return | `discount_rate` تقني |
| DSCR | `dscr` | نسبة تغطية خدمة الدين | Debt Service Coverage Ratio | يجب إظهار الشرح |
| NPV | `npv` | القيمة الحالية الصافية | Net Present Value | |
| IRR | `irr` | معدل العائد الداخلي | Internal Rate of Return | |
| القيمة السوقية | `market_value`, `value` | القيمة السوقية | Market Value | |
| القيمة العادلة | `fair_value` | القيمة العادلة | Fair Value | |

---

## 3. مشاكل الحقول المكتشفة

### 3.1 حقول مكررة

| الحقل 1 | الحقل 2 | الموقع | الإجراء المقترح |
|---|---|---|---|
| `capital` | `investment` | calculators/*, v3/api/projects.js | دمج في `capital` |
| `revenue` | `annual_revenue` | bonds_projects, calculators | توحيد في `annual_revenue` |
| `city` | `city_name` | profiles, bonds_projects | توحيد في `city` |
| `country` | `country_code` | bonds_projects | استخدام `country_code` |
| `sub_sector` | `activity` | bonds_projects, calculators | توحيد في `activity` |

### 3.2 حقول غير مستخدمة

بناءً على `docs/PROJECT_AUDIT.md` و`docs/platform-audit-report.md`:

- حقول `restaurant_name` في `profiles` تُستخدم فقط في حاسبات المطاعم ويجب نقلها إلى بيانات المشروع.
- حقول `website` و`bio` و`needs` في `profiles` غير مرتبطة بواجهة مرئية في معظم الصفحات.
- حقول `branch_count` و`employee_count` موجودة في `profiles` لكنها ليست جزءاً من تدفق المشروع.

### 3.3 حقول ذات أسماء غير مفهومة

| الاسم الحالي | المشكلة | الاسم المقترح |
|---|---|---|
| `dscr` | اختصار غير مألوف | نسبة تغطية خدمة الدين (DSCR) |
| `opex` | اختصار مالي | التكاليف التشغيلية |
| `capex` | اختصار مالي | رأس المال المستثمر |
| `cagr` | اختصار مالي | معدل النمو السنوي المركب |
| `ebitda` | اختصار مالي | الأرباح قبل الفوائد والضرائب والاستهلاك |
| `npv` | اختصار مالي | القيمة الحالية الصافية |
| `irr` | اختصار مالي | معدل العائد الداخلي |
| `roi` | اختصار مالي | العائد على الاستثمار |
| `wacc` | اختصار مالي | متوسط تكلفة رأس المال |

### 3.4 حقول تفتقر إلى Labels

من `docs/platform-audit-report.md`:

- حقول التواصل/ال lead-capture في صفحات الحاسبات تعتمد فقط على `placeholder` بدون `<label>`.
- حقول OTP غير مجمعة بـ `fieldset`.
- العديد من حقول admin تفتقر إلى `aria-label` أو نص مساعد.

---

## 4. حقول رحلة المشروع الموحدة (المقترحة)

بناءً على `docs/BONDS_CONSTITUTION.md` §6.1، يجب أن تجمع النماذج البيانات التالية مرة واحدة:

### 4.1 النية والاكتشاف

| الحقل | النوع | الغرض |
|---|---|---|
| هدف المستخدم | select | تمويل / تقييم / جدوى / شراكة / تخارج |
| نوع الأصل/المشروع | select | عقار / مصنع / شركة / مطعم ... |
| القطاع | select | قائمة موحدة |
| النشاط | select/text | تفصيل القطاع |

### 4.2 بيانات المشروع

| الحقل | النوع | الغرض |
|---|---|---|
| اسم المشروع | text | |
| الدولة | select | ISO 3166 |
| المدينة | select | تابعة للدولة |
| العملة | select | تابعة للدولة |
| رأس المال الاستثماري | number | |
| نسبة التمويل | slider/number | إن وجد |
| أفق التوقعات | number | سنوات |

### 4.3 البيانات المالية

| الحقل | النوع | الغرض |
|---|---|---|
| الإيرادات السنوية | number | |
| التكاليف التشغيلية السنوية | number | |
| صافي الربح السنوي | computed | يُحسب تلقائياً |
| معدل النمو السنوي | percent | |
| معدل العائد المطلوب | percent | |

---

## 5. التوصيات

1. **إنشاء `FIELD_NAMING_STANDARD.md`** واعتماده في كل Wave 2.
2. **إنشاء قاموس مركزي** في `lib/i18n/fields.js` يحتوي على `id`, `ar`, `en`, `help_ar`, `help_en`.
3. **توحيد أسماء الأعمدة في قاعدة البيانات** عبر migrations تدريجية.
4. **إضافة `<label>` و`help text` لكل حقل** في Wave 2.
5. **استبدال الاختصارات** في الواجهة بالأسماء الكاملة مع عرض الاختصار بين قوسين.

---

## 6. المراجع

- `docs/platform-audit-report.md`
- `docs/PROJECT_AUDIT.md`
- `docs/BONDS_SYSTEM_AUDIT.md`
- `docs/BONDS_CONSTITUTION.md` §2.2, §6
