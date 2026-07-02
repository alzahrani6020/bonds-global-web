# مشاكل تجربة المستخدم — UX Problems

> **البرنامج:** BONDS Product Transformation Program (PTP) — Wave 1  
> **الهدف:** توثيق جميع مشاكل UX التي تحول دون تحويل BONDS إلى منتج عالمي متماسك.

---

## 1. ملخص

رغم جودة الهندسة والاختبارات، تجربة المستخدم في BONDS لا تزال تعكس "مجموعة أدوات" بدلاً من "منصة قرار موحدة". المشاكل تتراوح بين تحويل مبكر، ورحلات مكسورة، ونقص الثقة، وعدم اتساق بصري.

---

## 2. مشاكل UX حسب الفئة

### 2.1 تحويل وتسعير

| # | المشكلة | الخطورة | الدليل |
|---|---|---|---|
| 1 | CTA الرئيسية في الصفحة الرئيسية تطلب تسجيل الدخول قبل أي قيمة | P0 | business-value-audit |
| 2 | لا يوجد trial مجاني أو demo | P0 | business-value-audit |
| 3 | صفحة التسعير تخلط بين SaaS وخدمات استشارية | P0 | business-value-audit |
| 4 | الترقية داخل البوابة تظهر كـ `alert` فقط | P0 | business-value-audit |
| 5 | لا يوجد سجل فواتير أو إيصالات | High | business-value-audit |
| 6 | نجاح الدفع يحول إلى صفحة غير ذات صلة | P0 | business-value-audit |
| 7 | لا يوجد تسعير واضح لطلب مراجعة خبير | P0 | customer-journey-audit |

### 2.2 الثقة والمصداقية

| # | المشكلة | الخطورة | الدليل |
|---|---|---|---|
| 1 | شهادات وصور شركاء عامة/مخزنة | P0 | business-value-audit |
| 2 | لا توجد دراسات حالة حقيقية | P0 | business-value-audit |
| 3 | لا توجد سير ذاتية لموظفين/مستشارين | P0 | business-value-audit |
| 4 | التقرير لا يحتوي على ختم/رقم مرجعي/اسم مستشار | High | customer-journey-audit |
| 5 | Google Analytics ID placeholder | High | business-value-audit |
| 6 | لا توجد صفحة "Proof" حقيقية | Medium | business-value-audit |

### 2.3 الرحلة والتنقل

| # | المشكلة | الخطورة | الدليل |
|---|---|---|---|
| 1 | لا توجد رحلة موحدة من الفكرة إلى التقرير | Critical | BONDS_SYSTEM_AUDIT |
| 2 | المستخدم يُعيد إدخال البيانات عند الانتقال بين الأدوات | High | customer-journey-audit |
| 3 | أنظمة مصادقة متعددة تسبب فقدان المشاريع | High | PROJECT_AUDIT |
| 4 | لا يوجد onboarding بعد التسجيل | High | USER_JOURNEY_MAP |
| 5 | بوابة العميل القديمة (`/client/`) منفصلة عن V3 | High | PROJECT_AUDIT |
| 6 | لا توجد خريطة مواقع أو breadcrumb | Medium | platform-audit-report |

### 2.4 النماذج والحقول

| # | المشكلة | الخطورة | الدليل |
|---|---|---|---|
| 1 | حقول التواصل في الحاسبات تعتمد على placeholder فقط بدون label | High | platform-audit-report |
| 2 | اختصارات مالية غير مفسرة (DSCR, NPV, IRR, EBITDA) | High | FIELD_DICTIONARY |
| 3 | حقول بأسماء تقنية بدلاً من لغة رجل الأعمال | High | BONDS_CONSTITUTION |
| 4 | حقول مكررة (`capital` vs `investment`) | High | PROJECT_AUDIT |
| 5 | حقول `profiles` غير مرتبطة بالمشروع (مثل `restaurant_name`) | Medium | PROJECT_AUDIT |
| 6 | OTP غير مجمعة بـ fieldset | Medium | platform-audit-report |

### 2.5 المحتوى والترجمة

| # | المشكلة | الخطورة | الدليل |
|---|---|---|---|
| 1 | 14 صفحة إدارية عربية بدون مرآة إنجليزية | High | i18n-audit-report |
| 2 | صفحات إنجليزية تحتوي على ~24,898 حرف عربي | High | i18n-audit-report |
| 3 | تقارير AI بالعربية في الواجهة الإنجليزية | High | BONDS_SYSTEM_AUDIT |
| 4 | `hreflang` موجود في صفحتين فقط | Medium | i18n-audit-report |
| 5 | تنسيق الأرقام يختلف بين الصفحات | Medium | i18n-audit-report |

### 2.6 البصرية والتصميم

| # | المشكلة | الخطورة | الدليل |
|---|---|---|---|
| 1 | 6,363 inline style attributes | High | BONDS_SYSTEM_AUDIT |
| 2 | 99 !important rules | High | BONDS_SYSTEM_AUDIT |
| 3 | لا يوجد Design System موحد | Critical | BONDS_CONSTITUTION |
| 4 | الشعار والهوية غير متسقة بين الصفحات القديمة والجديدة | High | BONDS_SYSTEM_AUDIT |
| 5 | الصفحات تبدو كمجموعة صفحات وليست منصة مؤسسية | Critical | PTP Wave 3 |

### 2.7 الأداء والاستجابة

| # | المشكلة | الخطورة | الدليل |
|---|---|---|---|
| 1 | 415+ صفحة HTML يدوية تزيد من عبء الصيانة | High | PROJECT_AUDIT |
| 2 | Homepage visual regression على الجوال 63–73% | Medium | platform-audit-report |
| 3 | لا يوجد lazy loading واضح للصور الكبيرة | Medium | BONDS_SYSTEM_AUDIT |
| 4 | inline CSS/JS يكبر حجم الصفحات | Medium | BONDS_SYSTEM_AUDIT |

### 2.8 Admin وConsultant Experience

| # | المشكلة | الخطورة | الدليل |
|---|---|---|---|
| 1 | لا يوجد مركز مهام/إشعارات موحد للمستشار | High | business-value-audit |
| 2 | دراسات الجدوى تستخدم JSON textareas | High | business-value-audit |
| 3 | لا يوجد timeline/Kanban للمشاريع | High | business-value-audit |
| 4 | جداول فارغة بدون CTA | Medium | platform-audit-report |
| 5 | أخطاء عامة بدون retry | Medium | platform-audit-report |

---

## 3. خريطة حرارة للمشاكل

| المحور | عدد المشاكل | الخطورة القصوى |
|---|---|---|
| تحويل وتسعير | 7 | P0 |
| الثقة والمصداقية | 6 | P0 |
| الرحلة والتنقل | 6 | Critical |
| النماذج والحقول | 6 | High |
| المحتوى والترجمة | 5 | High |
| البصرية والتصميم | 5 | Critical |
| الأداء والاستجابة | 4 | High |
| Admin | 5 | High |

---

## 4. التوصيات الموجزة

1. **إعادة تصميم الصفحة الرئيسية** لتبدأ بالنية وعرض demo/trial.
2. **بناء رحلة مشروع موحدة** في بوابة عميل V2.
3. **توحيد المصادقة** وإضافة onboarding.
4. **إعادة بناء تجربة الشراء** مع سجل فواتير وترقية داخل التطبيق.
5. **تحسين الثقة** بدراسات حالة، سير مستشارين، وتقارير موثقة.
6. **توحيد الترجمة** وإنشاء قاموس مركزي.
7. **بناء Design System** في Wave 3.
8. **تحويل inline styles إلى مكونات** قابلة لإعادة الاستخدام.

---

## 5. المراجع

- `docs/customer-journey-audit.md`
- `docs/business-value-audit.md`
- `docs/BONDS_SYSTEM_AUDIT.md`
- `docs/platform-audit-report.md`
- `docs/i18n-audit-report.md`
- `docs/PROJECT_AUDIT.md`
- `docs/USER_JOURNEY_MAP.md`
