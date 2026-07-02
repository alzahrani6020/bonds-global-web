# معيار المواقع — BONDS Location Standard

> **البرنامج:** BONDS Product Transformation Program (PTP) — Wave 2  
> **التاريخ:** 2026-07-02  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`، `docs/LOCATION_AUDIT.md`

---

## 1. الهدف

توحيد قوائم الدول والمدن والمحافظات في جميع واجهات BONDS، وضمان عدم وجود تكرار أو اختلاف بين الصفحات.

---

## 2. المصدر الوحيد للحقيقة

المصدر المركزي الوحيد للبيانات الجغرافية هو:

```
v3/master-data/countries-governorates-cities.js
```

يغطي 22 دولة عربية (جامعة الدول العربية) مع المحافظات والمدن.

---

## 3. تنسيق الأكواد

### 3.1 الدول

- المعيار: **ISO 3166-1 alpha-2**.
- أمثلة: `SA`, `AE`, `EG`, `US`.
- يُعرض للمستخدم: `السعودية` / `Saudi Arabia`.

### 3.2 المحافظات

- التنسيق: `COUNTRY-GOV_INDEX`.
- مثال: `SA-01` للمنطقة الرياض.

### 3.3 المدن

- التنسيق: `COUNTRY-GOV_INDEX-CITY_INDEX`.
- مثال: `SA-01-001` للرياض.
- لا يُسمح بتكرار المدينة نفسها تحت نفس المحافظة.

---

## 4. توحيد الواجهة

### 4.1 المكتبة المسموح بها

استخدم `calculators/shared-geo.js` (توفر `window.BondsGeo`) لجميع قوائم الدول/المدن.

### 4.2 أمثلة الاستخدام

```html
<select data-bonds-geo-bind="country" id="country"></select>
<select id="governorate"></select>
<select id="city"></select>

<script>
  BondsGeo.bindCascading({
    countryId: 'country',
    governorateId: 'governorate',
    cityId: 'city'
  });
</script>
```

### 4.3 ما يُمنع

- لا تكتب `<select>` يدوياً للدول/المدن في HTML.
- لا تستخدم `calculators/country-platforms-data.js` كمصدر للمواقع.
- لا تكرر بيانات المدن في ملفات CSS/JS منفصلة.

---

## 5. سياسة التكرار

إذا ظهرت مدينة تحت أكثر من تسمية (مثل `الأحساء` و`الاحساء`)، يُعتمد التسمية الأكثر استخداماً رسمياً، ويُحذف التكرار.

مثال تم تطبيقه:
- في السعودية، المحافظة `SA-05` كانت تحتوي على `الأحساء` و`الاحساء`؛ تم توحيدها في `الأحساء`.

---

## 6. Quality Gates

- [ ] قائمة دول واحدة في كل الصفحات.
- [ ] قائمة مدن واحدة لكل دولة.
- [ ] لا يوجد مدينة ناقصة في الدول المدعومة.
- [ ] لا يوجد تكرار في المدن.
- [ ] جميع الصفحات المترجمة تحتوي على `hreflang`.

---

## 7. المراجع

- `docs/LOCATION_AUDIT.md`
- `v3/master-data/countries-governorates-cities.js`
- `calculators/shared-geo.js`
