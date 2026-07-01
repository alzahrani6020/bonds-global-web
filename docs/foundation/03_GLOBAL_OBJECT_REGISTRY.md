# BONDS Global Object Registry — معرف الكائنات العالمي

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة تأسيس — لا يحتوي على كود

---

## 1. الرؤية

كل كيان في BONDS يحمل معرفاً موحداً (ID) يكون:

- **فريداً** عبر النظام بأكمله.
- **قابلاً للقراءة** (human-readable prefix).
- **مستقراً** (لا يتغير مع إعادة التسمية).
- **قابلاً للتتبع** من المصدر إلى التقرير/الشهادة.

---

## 2. البادئات المعتمدة

| البادئة | الكيان | مثال | الوصف |
|---|---|---|---|
| **USR** | User | `USR-7a8f9b2c-4d3e-11ef` | مستخدم مسجل. |
| **ORG** | Organization | `ORG-9c1d4e5f-6a7b-12bc` | شركة أو مؤسسة. |
| **PRJ** | Project | `PRJ-2026-00000001` | مشروع استثماري. |
| **AST** | Asset | `AST-2026-RE-00000042` | أصل قابل للتقييم. |
| **VAL** | Valuation | `VAL-2026-00000123` | عملية تقييم. |
| **FIN** | Financing | `FIN-2026-00000009` | هيكل تمويل. |
| **FEA** | Feasibility | `FEA-2026-00000015` | دراسة جدوى. |
| **RPT** | Report | `RPT-2026-00000088` | تقرير. |
| **CRT** | Certificate | `BDVC-2026-CC-00000001` | شهادة رقمية. |
| **AI** | AI Report | `AI-2026-00000005` | تقرير AI. |
| **ENG** | Engine Run | `ENG-2026-00000033` | تشغيل محرك. |
| **API** | API Request | `API-2026-00000077` | طلب API. |
| **DB** | Database Record | `DB-2026-00000001` | سجل بيانات عام. |
| **CAL** | Calculation | `CAL-2026-00000019` | حسابة محددة. |
| **SIM** | Scenario | `SIM-2026-00000027` | سيناريو محاكاة. |
| **REC** | Recommendation | `REC-2026-00000012` | توصية. |
| **KNW** | Knowledge Object | `KNW-2026-00000008` | كائن معرفة. |
| **INT** | Intelligence Event | `INT-2026-00000003` | حدث ذكاء. |
| **AUD** | Audit Record | `AUD-2026-00000099` | سجل تدقيق. |
| **DSR** | Data Source | `DSR-2026-00000004` | مصدر بيانات. |
| **OV** | Data Override | `OV-2026-00000006` | تعديل بيانة. |
| **EVD** | Evidence Bundle | `EVD-2026-00000014` | حزمة أدلة. |
| **DEC** | Decision | `DEC-2026-00000007` | قرار. |
| **DGT** | Decision Graph Node | `DGT-2026-00000011` | عقدة في Decision Graph. |
| **DTW** | Digital Twin | `DTW-2026-00000002` | توأم رقمي. |

---

## 3. قواعد الترقيم

### 3.1 UUIDs للكيانات الداخلية

- جميع الجداول تستخدم `uuid` كمفتاح أساسي.
- UUID يُولد تلقائياً عبر `gen_random_uuid()` أو `uuid-ossp`.

### 3.2 الأرقام المرئية (Human-Readable Numbers)

| الكيان | التنسيق | مثال |
|---|---|---|
| Project | `PRJ-YYYY-NNNNNNNN` | `PRJ-2026-00000001` |
| Asset | `AST-YYYY-CC-NNNNNNNN` | `AST-2026-RE-00000001` |
| Valuation | `VAL-YYYY-NNNNNNNN` | `VAL-2026-00000001` |
| Financing | `FIN-YYYY-NNNNNNNN` | `FIN-2026-00000001` |
| Feasibility | `FEA-YYYY-NNNNNNNN` | `FEA-2026-00000001` |
| Report | `RPT-YYYY-NNNNNNNN` | `RPT-2026-00000001` |
| Certificate | `BDVC-YYYY-CC-NNNNNNNN` | `BDVC-2026-SA-00000001` |
| Scenario | `SIM-YYYY-NNNNNNNN` | `SIM-2026-00000001` |
| Recommendation | `REC-YYYY-NNNNNNNN` | `REC-2026-00000001` |

### 3.3 الترميز

- **YYYY**: سنة الإنشاء.
- **CC**: كود الدولة ISO-3166 (مثال: SA، AE، US).
- **NNNNNNNN**: رقم تسلسلي فريد (8 أرقام).

---

## 4. ضمان عدم التكرار

- **Central Sequence Table**: جدول `bonds_sequences` يحتوي على آخر رقم لكل بادئة.
- **Unique Constraints**: كل رقم مرئي يحمل `UNIQUE` في قاعدة البيانات.
- **Idempotency**: عند إعادة المحاولة، يتم التحقق من عدم وجود الرقم قبل الإنشاء.
- **Audit**: يتم تسجيل من أنشأ كل معرف ومتى.

---

## 5. الترقيم في الشهادات

تستخدم الشهادات (Certificates) تنسيقاً خاصاً:

```text
BDVC-YYYY-CC-NNNNNNNN
```

- **BDVC**: BONDS Digital Valuation Certificate.
- **YYYY**: سنة الإصدار.
- **CC**: كود الدولة.
- **NNNNNNNN**: رقم تسلسلي فريد.

---

## 6. أمثلة

```text
USR-7a8f9b2c-4d3e-11ef-1234-567890abcdef
ORG-9c1d4e5f-6a7b-12bc-9876-543210fedcba
PRJ-2026-00000001
AST-2026-RE-00000042
VAL-2026-00000123
BDVC-2026-SA-00000001
```

---

## 7. الحوكمة

- لا يُسمح بإنشاء بادئة جديدة إلا بعد موافقة Lead Architect.
- لا يُسمح بتغيير تنسيق الأرقام المرئية بعد إصدار أول شهادة/تقرير.
- كل كيان جديد يجب أن يُسجل في هذا الـ Registry قبل الاستخدام.
