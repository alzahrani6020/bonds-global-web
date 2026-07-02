# نظام تصميم بوندز — BONDS Design System

> مرجع موحد لمكونات الواجهة وتنسيقاتها في مشروع بوندز. يعتمد النظام على CSS variables وتصميم مظلم افتراضي مع دعم الوضع الفاتح.

---

## 1. المبادئ

- **المظلم افتراضي**: كل الصفحات تبدأ بالوضع الداكن (`--bg: #0a0f1a`).
- **التصميم بالرموز (Tokens)**: لا تستخدم ألوان أو مسافات مكتوبة يدويًا في CSS/JS.
- **لا `!important`**: استخدم التخصصية (specificity) بدلاً منها.
- **ثنائي اللغة**: كل صفحة عربية لها نظيرة إنجليزية، والاتجاه RTL/LTR صحيح.
- **إمكانية الوصول**: نسبة تباين AA كحد أدنى، مدخلات موسومة، وأيقونات SVG بدل emoji.

---

## 2. الملفات الأساسية

| الملف | الغرض |
|-------|-------|
| `styles/tokens.css` | المتغيرات (ألوان، مسافات، حدود، خطوط، ظلال). |
| `styles/base.css` | إعادة ضبط أساسية وتنسيقات `body` و `html`. |
| `styles/components.css` | المكونات المشتركة: أزرار، بطاقات، أقسام، hero. |
| `styles/utilities.css` | مساعدات عامة، حركات، تدقيق focus، قواعد الطباعة. |
| `styles/select-reset.css` | تنسيق احتياطي للقوائم الأصلية. |
| `styles/home.css` | أنماط الصفحة الرئيسية فقط. |
| `styles/page-shared.css` | مكونات الصفحات التسويقية والقطاعية (pricing, services, calculator landing, sectors). |

---

## 3. الرموز (Tokens)

### 3.1 الألوان — الوضع الداكن (افتراضي)

```css
--bg: #0a0f1a;
--bg-secondary: #0d1321;
--bg-card: rgba(16, 24, 45, 0.6);
--bg-card-hover: rgba(20, 30, 55, 0.8);
--bg-dark: #070a12;
--bg-elevated: #141b2d;

--gold: #d4a853;
--gold-bright: #f0c96a;
--gold-dim: #a08030;
--gold-700: #f0c96a;

--text: #e8ecf4;
--text-secondary: #94a3b8;
--text-muted: #64748b;

--border: rgba(197, 160, 40, 0.15);
--border-hover: rgba(197, 160, 40, 0.4);

--success: #22c55e;
--warning: #facc15;
--info: #3b82f6;
--danger: #ef4444;
```

### 3.2 المسافات

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.25rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-10: 2.5rem;
--space-12: 3rem;
--space-16: 4rem;
--space-20: 5rem;
--space-24: 6rem;
```

### 3.3 الحدود والزوايا

```css
--radius: 16px;
--radius-lg: 24px;
--radius-md: 12px;
--radius-sm: 8px;
```

### 3.4 الخطوط

```css
--font: "Vazirmatn", "Cairo", system-ui, sans-serif;
--font-display: "Vazirmatn", "Cairo", system-ui, sans-serif;
--font-en: "Inter", system-ui, sans-serif;
```

### 3.5 أحجام النصوص

```css
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
--text-4xl: 2.25rem;
--text-5xl: 3rem;
--text-6xl: 3.75rem;
```

---

## 4. المكونات المشتركة

### 4.1 الأزرار

```html
<button class="btn btn-primary">زر أساسي</button>
<button class="btn btn-outline">زر ثانوي</button>
<a href="#" class="btn btn-lg">زر كبير</a>
```

### 4.2 البطاقات

```html
<div class="card">
  <h3 class="card__title">عنوان البطاقة</h3>
  <p class="card__text">وصف البطاقة.</p>
</div>
```

### 4.3 رأس القسم

```html
<div class="section-header reveal">
  <span class="section__eyebrow">عين الذهاب</span>
  <h2 class="section__title">عنوان القسم</h2>
  <p class="section__subtitle">وصف فرعي للقسم.</p>
</div>
```

### 4.4 Hero

```html
<section class="hero">
  <div class="hero__bg"></div>
  <div class="container hero__content reveal">
    <span class="hero__eyebrow">علامة</span>
    <h1 class="hero__title">العنوان <span class="text-gradient">المميز</span></h1>
    <p class="hero__desc">الوصف.</p>
    <div class="hero__actions">
      <a href="#" class="btn btn-primary">ابدأ</a>
    </div>
  </div>
</section>
```

### 4.5 بطاقات التسعير

```html
<div class="pricing-grid">
  <div class="pricing-card">
    <span class="pricing-card__badge pricing-card__badge--outline">مجاناً</span>
    <h3 class="pricing-card__title">Free</h3>
    <p class="pricing-card__desc">للمشاريع الصغيرة.</p>
    <div class="pricing-card__price">مجاني</div>
    <ul class="pricing-card__features feature-list">...</ul>
    <a href="#" class="btn btn-outline pricing-card__cta">ابدأ</a>
  </div>
</div>
```

### 4.6 قائمة المميزات

```html
<ul class="feature-list">
  <li class="feature-list__item">
    <svg class="feature-list__icon feature-list__icon--check">...</svg>
    ميزة متاحة
  </li>
  <li class="feature-list__item feature-list__item--muted">
    <svg class="feature-list__icon feature-list__icon--x">...</svg>
    غير متاحة
  </li>
</ul>
```

### 4.7 CTA Banner

```html
<div class="cta-banner">
  <div>
    <h3 class="cta-banner__title">عنوان الحث</h3>
    <p class="cta-banner__text">وصف قصير.</p>
  </div>
  <a href="#" class="cta-banner__btn">ابدأ الآن</a>
</div>
```

---

## 5. قواعد الاستخدام

### 5.1 لا تضف أنماط مضمنة

- لا تستخدم `style="..."` إلا للقيم المولدة ديناميكيًا بواسطة JavaScript.
- انقل كل `<style>` blocks إلى ملفات CSS خارجية.

### 5.2 تجنب الألوان الثابتة

- استخدم `var(--gold)` بدلاً من `#d4a853`.
- استخدم `var(--text-secondary)` بدلاً من `#94a3b8`.

### 5.3 التسميات

- الملفات: `kebab-case.css`.
- فئات CSS: `block__element` أو `block--modifier`.
- المفاتيح في `localStorage`: تبدأ بـ `bonds_`.

### 5.4 الوضع الفاتح

- يُفعّل عبر `<html data-theme="light">`.
- لا تكتب قواعد خاصة بالوضع الفاتح إلا عند الضرورة؛ استخدم `data-theme="light"` في `:root`.

---

## 6. الجودة

قبل اعتماد أي تغيير في النظام:

- `npm test` يجب أن يمر.
- `npm run audit` 0 مشاكل.
- `npm run audit:og` نظيف.
- `npm run test:a11y` لا يوجد مخالفات خطيرة.
- `npm run test:visual` مطابق للصور الأساسية.
- `sw.js CACHE_VERSION` مرفوع عند تغيير الأصول المشتركة.
