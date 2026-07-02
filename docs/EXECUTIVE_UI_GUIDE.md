# دليل واجهة المستخدم التنفيذية — BONDS Executive UI Guide

> إرشادات تصميم وتنفيذ لوحات القيادة والشاشات التنفيذية في بوندز: `v3/portfolio`، `v3/project`، و `admin/dashboard.html`.

---

## 1. المبادئ التنفيذية

- **لا محركات حسابية جديدة في الواجهة**: كل الأرقام تأتي من UCP أو Fabric أو Enterprise Intelligence.
- **قرار أولاً، بيانات ثانيًا**: العرض يُركز على الحالة والخطوة التالية، لا على تفاصيل خام.
- **دور محدد**: اعرض الأزرار/الإجراءات حسب `profiles.role` (viewer / advisor / admin / owner).
- **ثنائي اللغة**: كل واجهة تنفيذية لها مرآة إنجليزية.
- ** emoji ممنوع**: استخدم SVG من `components/ecc-icons.js`.

---

## 2. البنية العامة لشاشة التنفيذ

```
┌─────────────────────────────────────┐
│  الهيدر الموحد (#site-header)        │
├─────────────────────────────────────┤
│  شريط الرحلة / Journey Strip          │
├─────────────────────────────────────┤
│  ملخص فوقي (KPI Cards)               │
├─────────────────────────────────────┤
│  تبويبات تنفيذية                      │
│  ┌─────┐ ┌─────┐ ┌─────┐            │
│  │نظرة │ │تمويل│ │مستشار│           │
│  │عامة │ │     │ │     │            │
│  └─────┘ └─────┘ └─────┘            │
├─────────────────────────────────────┤
│  محتوى التبويب النشط                 │
├─────────────────────────────────────┤
│  الشريط الجانبي (إشعارات / بحث)      │
├─────────────────────────────────────┤
│  الفوتر الموحد (#site-footer)        │
└─────────────────────────────────────┘
```

---

## 3. المكونات التنفيذية

### 3.1 بطاقات KPI

```html
<div class="kpi-grid">
  <div class="kpi-card">
    <div class="kpi-card__label">صحة المشروع</div>
    <div class="kpi-card__value kpi-card__value--success">92%</div>
    <div class="kpi-card__trend">+3% من الأسبوع الماضي</div>
  </div>
</div>
```

- لا تزيد عن 4–6 بطاقات في الصف الأول.
- استخدم الألوان الدلالية: `--success`، `--warning`، `--danger`.

### 3.2 شريط الرحلة (Journey Strip)

```html
<div class="journey-strip">
  <div class="journey-step journey-step--active">الفكرة</div>
  <div class="journey-step">التقييم</div>
  <div class="journey-step">التمويل</div>
  <div class="journey-step">التنفيذ</div>
</div>
```

- يعرض المرحلة الحالية للمشروع من Lifecycle Engine.
- يُحدّث عند تغيير المرحلة دون إعادة تحميل الصفحة.

### 3.3 التبويبات التنفيذية

```html
<div class="exec-tabs">
  <button class="exec-tab exec-tab--active" data-tab="overview">نظرة عامة</button>
  <button class="exec-tab" data-tab="financing">التمويل</button>
  <button class="exec-tab" data-tab="advisor">المستشار</button>
</div>
<div class="exec-tab-panel exec-tab-panel--active" id="tab-overview">...</div>
```

- لا تستخدم روابط خارجية للتبويبات؛ يتم التبديل داخل الصفحة.
- احتفظ بحالة التبويب النشط في URL (`?tab=financing`) لإمكانية المشاركة.

### 3.4 الإشعارات الذكية

```html
<div class="notification-panel">
  <div class="notification notification--warning">
    <svg class="notification__icon">...</svg>
    <div class="notification__text">موافقة معلقة على مرحلة التقييم.</div>
    <a href="#" class="notification__action">عرض</a>
  </div>
</div>
```

- اجمع الإشعارات من: موافقات معلقة، مهام، تنبيهات حرجة، فجوات جاهزية.
- لا تعرض أكثر من 5 إشعارات افتراضيًا؛ أضف "عرض الكل".

### 3.5 البحث التنفيذي

```html
<div class="exec-search">
  <input type="search" class="exec-search__input" placeholder="ابحث في المشاريع، المهام، الموافقات..." />
  <div class="exec-search__results"></div>
</div>
```

- يبحث في: المشاريع، المذكرات، مراجعات AI، الجدول الزمني، المهام، الموافقات.
- النتائج مجمّعة حسب المصدر.

---

## 4. دور المستخدم

| الدور | الصلاحيات |
|-------|-----------|
| `viewer` | عرض فقط؛ يُخفى أزرار التعديل والإجراء. |
| `advisor` | عرض + إضافة ملاحظات/توصيات. |
| `admin` | تعديل المشروع، إدارة المستخدمين، الموافقات. |
| `owner` | كل الصلاحيات بما فيها الحذف والتحويل. |

عند تحميل الواجهة، اقرأ `profiles.role` وطبّق فئة `role--<role>` على `<body>` أو الحاوية الرئيسية.

---

## 5. الأيقونات

- استخدم `components/ecc-icons.js`.
- لا تستخدم emoji في أي مكون تنفيذي.
- الأيقونات باللون `currentColor` لتتوارث من النص.

```html
<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M12 2v20M2 12h20"/>
</svg>
```

---

## 6. الأداء

- حمّل CSS/JS الخاص بالواجهة التنفيذية بشكل منفصل ونسقه (`v3/portfolio/portfolio-dashboard.css`، `v3/project/project-command-center.css`).
- استخدم `defer` للسكربتات غير الحرجة.
- حدّث `sw.js CACHE_VERSION` عند تغيير الأصول المشتركة.

---

## 7. إمكانية الوصول

- كل تبويب يحتوي على `role="tab"` و `aria-selected`.
- البطاقات تحتوي على عناوين واضحة (`<h2>`–`<h3>`).
- نسبة التباين AA كحد أدنى.
- التنقل بالكيبورد واضح (`focus-visible`).
