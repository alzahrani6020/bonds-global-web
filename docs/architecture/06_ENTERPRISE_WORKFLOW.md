# BONDS Enterprise Workflow — سير العمل المؤسسي

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة هندسية — لا يحتوي على كود

---

## 1. الهدف

تنظيم دورة حياة القرار الاستثماري داخل المنصة، من المسودة إلى الأرشفة، مع تحديد الصلاحيات والمسؤوليات في كل مرحلة.

---

## 2. النطاق

- جميع المشاريع والأصول والتقييمات.
- جميع التقارير والشهادات.
- جميع المستخدمين (Client, Advisor, Reviewer, Admin).

---

## 3. مراحل Workflow

```text
Draft
  │
  ▼
Submitted
  │
  ▼
Financial Review
  │
  ▼
Technical Review
  │
  ▼
Legal Review
  │
  ▼
Compliance Review
  │
  ▼
Executive Approval
  │
  ▼
Certified
  │
  ▼
Archived
```

---

## 4. وصف المراحل

| المرحلة | الوصف | الصلاحيات |
|---|---|---|
| **Draft** | المستخدم يُعدّل البيانات والسيناريوهات. | Owner, Advisor |
| **Submitted** | تم إرسال الطلب للمراجعة. | Owner |
| **Financial Review** | مراجعة الأرقام والجدوى. | Financial Reviewer |
| **Technical Review** | مراجعة البيانات الفنية والتقييم. | Technical Reviewer |
| **Legal Review** | مراجعة الاشتراطات والمخاطر القانونية. | Legal Reviewer |
| **Compliance Review** | التحقق من الامتثال. | Compliance Officer |
| **Executive Approval** | الموافقة النهائية. | Admin / Executive |
| **Certified** | إصدار الشهادة أو التقرير النهائي. | System / Admin |
| **Archived** | الحفظ للرجوع إليه. | System |

---

## 5. الانتقالات بين المراحل

| من | إلى | المسموح | الشرط |
|---|---|---|---|
| Draft | Submitted | Owner | اكتمال البيانات الأساسية. |
| Submitted | Financial Review | System | Confidence >= 70. |
| Financial Review | Technical Review | Financial Reviewer | لا توجد أخطاء مالية. |
| Technical Review | Legal Review | Technical Reviewer | التقييم مقبول. |
| Legal Review | Compliance Review | Legal Reviewer | لا توجد مخاطر قانونية حرجة. |
| Compliance Review | Executive Approval | Compliance Officer | الامتثال متحقق. |
| Executive Approval | Certified | Admin | الموافقة النهائية. |
| Certified | Archived | System | بعد انتهاء صلاحية الشهادة. |

---

## 6. صلاحيات المستخدمين

| الدور | الصلاحيات |
|---|---|
| **Client / Owner** | إنشاء المشروع، تعديل Draft، إرسال للمراجعة. |
| **Advisor** | مساعدة Owner، تعديل Draft، التعليق. |
| **Financial Reviewer** | مراجعة الأرقام، طلب توضيحات. |
| **Technical Reviewer** | مراجعة التقييم والبيانات الفنية. |
| **Legal Reviewer** | مراجعة الاشتراطات والمخاطر القانونية. |
| **Compliance Officer** | التحقق من الامتثال. |
| **Executive / Admin** | الموافقة النهائية، إصدار الشهادات. |

---

## 7. Audit Trail في Workflow

- كل انتقال يُسجل: من، إلى، وقت، سبب، ملاحظات.
- لا يُسمح بالتراجع دون تبرير.

---

## 8. قواعد التطوير

- كل Project/Asset/Valuation/Report/Certificate يحمل حالة workflow.
- لا يمكن إصدار شهادة إلا من حالة Certified.
- يجب أن يكون Workflow قابلاً للتخصيص حسب نوع المشروع.
