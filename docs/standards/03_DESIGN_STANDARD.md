# 03 — Design Standard (معيار الهوية البصرية)

## الهدف
بناء هوية بصرية موحدة لـ BONDS تعكس الثقة والذكاء والاحترافية، مع نظام تصميم قابل للتطبيق على جميع الشاشات.

## النطاق
- جميع ملفات CSS (`styles/`, `*/**.css`).
- جميع الصور والشعارات (`assets/`).
- جميع الصفحات والمكونات.

---

## القواعد الإلزامية (Mandatory)

### M1 — استخدام نظام التصميم الموحد
- جميع الألوان يجب أن تأتي من متغيرات CSS في `styles/tokens.css` أو `styles.css`.
- الألوان الأساسية:
  - الذهبي: `--gold: #D4A853`
  - الذهبي الساطع: `--gold-bright: #F0C96A`
  - الخلفية: `--bg: #0A0F1A`
  - بطاقة: `--bg-card: rgba(16,24,45,0.6)`
  - النص: `--text: #E8ECF4`
  - النص الثانوي: `--text-secondary: #94A3B8`

### M2 — الخطوط
- العربية: `Vazirmatn` ثم `Cairo`.
- الإنجليزية: `Inter` أو `system-ui`.

### M3 — Naming Convention
- CSS يستخدم نمط BEM-lite:
  - `.block__element`
  - `.block--modifier`
- لا يُستخدم `!important` إلا للضرورة القصوى.

### M4 — لا inline styles عشوائية
- يُسمح بـ inline style فقط للقيم الديناميكية (مثل `width: ${percent}%`).
- لا يُستخدم inline style لتعيين الألوان أو المسافات.

### M5 — عدم تغيير الشعار الأصلي
- لا تُعدّل `assets/bonds-logo-v2.webp` أو `assets/شعار بوندز.jpg`.
- الشعار الجديد يُضاف كملف منفصل بعد إعادة التصميم.

---

## القواعد الموصى بها (Recommended)

### R1 — الوضع الداكن افتراضياً
- جميع الصفحات تستخدم الوضع الداكن بشكل افتراضي.
- يمكن دعم الوضع الفاتح كخيار مستقبلي.

### R2 — Consistent Spacing
- استخدام متغيرات المسافات في `tokens.css`.

---

## أمثلة

### ✅ صحيح
```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
}
```

### ❌ خاطئ
```html
<div style="background:#123; color:#fff; padding:20px;">...</div>
```

---

## كيفية القياس
1. `grep -R "style=\"" --include="*.html" .`
2. `grep -R "!important" --include="*.css" .`
3. مراجعة كل ملف CSS لاستخدام `var(--...)`.
4. مقارنة `styles/tokens.css` مع الألوان المستخدمة.

## Severity عند المخالفة
- **Critical:** تغيير ملف الشعار الأصلي.
- **High:** ألوان أو خطوط ثابتة خارج نظام التصميم.
- **Medium:** inline styles غير ديناميكية.
- **Low:** عدم استخدام BEM-lite.

## طريقة الإصلاح
- استبدال القيم الثابتة بمتغيرات CSS.
- إزالة inline styles ونقلها إلى CSS classes.
- إعادة تسمية الكلاسات لتتبع BEM-lite.
