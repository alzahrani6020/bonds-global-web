# BONDS Integration Map — خريطة التكامل

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة هندسية — لا يحتوي على كود

---

## 1. الهدف

توضيح كيف تتكامل جميع محركات BONDS مع بعضها، واتجاه انتقال البيانات بينها، بحيث لا يوجد محرك معزول.

---

## 2. المحركات والطبقات

| المحرك/الطبقة | الدور |
|---|---|
| **Economic Brain** | العقل المركزي والمنسق. |
| **Valuation Engine** | تقييم الأصول. |
| **Feasibility Engine** | دراسة الجدوى. |
| **Risk Engine** | تقييم المخاطر. |
| **Cashflow Engine** | التدفقات النقدية. |
| **Financing Engine** | هيكلة التمويل. |
| **Market Engine** | بيانات السوق والمقارنات. |
| **Knowledge Engine** | المعرفة القطاعية. |
| **Live Data Engine** | جلب البيانات الحية. |
| **AI Analyst** | التحليل اللغوي والتوصيات. |
| **Confidence Engine** | حساب الثقة. |
| **Evidence Layer** | ربط النتائج بالأدلة. |
| **Decision Graph** | رسم أثر القرارات. |
| **Digital Twin** | التوأم الرقمي. |
| **Certificate Engine** | إصدار الشهادات. |
| **Reports** | توليد التقارير. |
| **Scenarios** | إدارة السيناريوهات. |
| **Decision Memory** | ذاكرة القرارات. |
| **Recommendation Engine** | التوصيات. |

---

## 3. خريطة التكامل

```text
                         ┌──────────────────┐
                         │   User Intent    │
                         └────────┬─────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │      BONDS Economic Brain     │
                  │   (Orchestrator + Decision)   │
                  └───────────────┬───────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Knowledge   │◄─────►│   Live Data     │◄─────►│   Confidence    │
│    Engine     │       │    Engine       │       │    Engine       │
└───────┬───────┘       └────────┬────────┘       └─────────────────┘
        │                        │
        ▼                        ▼
┌───────────────┐       ┌─────────────────┐
│   Market      │◄─────►│   Valuation     │
│    Engine     │       │    Engine       │
└───────┬───────┘       └────────┬────────┘
        │                        │
        ▼                        ▼
┌───────────────┐       ┌─────────────────┐
│   Risk        │◄─────►│   Feasibility   │
│    Engine     │       │    Engine       │
└───────┬───────┘       └────────┬────────┘
        │                        │
        ▼                        ▼
┌───────────────┐       ┌─────────────────┐
│  Financing    │◄─────►│   Cashflow      │
│    Engine     │       │    Engine       │
└───────┬───────┘       └─────────────────┘
        │
        ▼
┌───────────────────────────────────────────────┐
│  Simulation + Scenarios + AI Analyst          │
│        ↕ Evidence Layer ↕ Decision Graph     │
│        ↕ Digital Twin ↕ Decision Memory      │
│        ↕ Recommendation Engine               │
└─────────────────────┬─────────────────────────┘
                      │
                      ▼
         ┌─────────────────────┐
         │ Reports + Certificate│
         │      Engine          │
         └─────────────────────┘
```

---

## 4. اتجاه انتقال البيانات

| من | إلى | البيانات |
|---|---|---|
| Live Data Engine | Market Engine | أسعار، مؤشرات، بيانات حكومية. |
| Market Engine | Valuation Engine | comparables، supply/demand. |
| Knowledge Engine | Feasibility Engine | تكاليف وإيرادات قطاعية. |
| Valuation Engine | Risk Engine | قيمة الأصل لتقدير المخاطر. |
| Risk Engine | Financing Engine | risk premium، value haircut. |
| Cashflow Engine | Financing Engine | DSCR، cash coverage. |
| All Engines | Confidence Engine | درجات الثقة والجودة. |
| All Engines | Evidence Layer | sources، formulas. |
| Economic Brain | AI Analyst | summary payload. |
| AI Analyst | Recommendation Engine | تحليل نوعي. |
| Economic Brain | Decision Graph | dependencies. |
| Economic Brain | Digital Twin | state update. |
| Economic Brain | Certificate Engine | certificate request. |
| Economic Brain | Reports | report data. |

---

## 5. قواعد التكامل

- كل محرك يُعلن المدخلات التي يحتاجها.
- كل محرك يُعلن المخرجات التي يُنتجها.
- لا يُسمح لأي محرك بالوصول المباشر إلى بيانات محرك آخر.
- جميع الاتصالات تمر عبر Economic Brain أو Unified Data Layer.
