# BONDS Knowledge Graph — الرسم البياني للمعرفة

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة هندسية — لا يحتوي على كود

---

## 1. الهدف

بناء **Knowledge Graph اقتصادي شامل** يربط كل نشاط اقتصادي بجميع العناصر المؤثرة فيه: الاشتراطات، المعدات، الموردون، التكاليف، الإيرادات، الضرائب، المنافسون، الأسعار، التمويل، التقييم، المخاطر، السيناريوهات، أفضل الممارسات، ومؤشرات الأداء.

> Knowledge Graph ليس مجرد جداول منفصلة، بل **شبكة علاقات** يمكن استعلامها واستكشافها.

---

## 2. النطاق

- جميع القطاعات الاقتصادية (العقارات، التصنيع، المطاعم، التجزئة، الخدمات، ...).
- جميع الأنشطة داخل القطاع.
- جميع العوامل التشغيلية والمالية والتنظيمية.
- جميع المحركات التي تستخدم المعرفة.

---

## 3. المبادئ

### K1 — كل كيان مرتبط بكيانات أخرى
لا يوجد كيان معزول. كل قطاع يرتبط بالاشتراطات، المعدات، الموردين، التكاليف، الإيرادات، ...

### K2 — العلاقات موجّهة ومرتبة
مثلاً: `Restaurant → requires → Equipment → supplied_by → Suppliers → has_cost → Costs`.

### K3 — المعرفة قابلة للتحديث
يمكن تحديث أي عقدة أو علاقة دون كسر النظام.

### K4 — المعرفة قابلة للاستعلام
يمكن سؤال النظام: "ما المعدات المطلوبة لمطعم برأس مال مليون ريال؟"

---

## 4. أنواع العقد (Nodes)

| العقدة | الوصف | مثال |
|---|---|---|
| **Sector** | قطاع اقتصادي عام | العقارات، التصنيع، التجزئة |
| **Activity** | نشاط اقتصادي محدد | مطعم، مصنع بلاستيك، عيادة |
| **Requirement** | اشتراطات تنظيمية أو فنية | ترخيص بلدية، اشتراطات دفاع مدني |
| **Equipment** | معدات أو أصول | فرن، ماكينة، سيارة |
| **Supplier** | مورد | مورد معدات، مورد خام |
| **Cost** | تكلفة | تكلفة معدات، تكلفة عمالة |
| **Revenue** | إيراد | متوسط فاتورة، حجم مبيعات |
| **Tax** | ضريبة أو زكاة | VAT 15%، زكاة 2.5% |
| **Competitor** | منافس | عدد المنافسين في المنطقة |
| **Price** | سعر | سعر المتر، سعر الخام |
| **Financing** | تمويل | قرض، شريك، تمويل مختلط |
| **Valuation** | تقييم | قيمة الأصل |
| **Risk** | مخاطر | مخاطر تنظيمية، سوقية |
| **Scenario** | سيناريو | متشائم، متوقع، متفائل |
| **BestPractice** | أفضل الممارسات | معدلات الإشغال المثلى |
| **KPI** | مؤشر أداء | ROI، DSCR، NPV |

---

## 5. أنواع العلاقات (Edges)

| العلاقة | الوصف |
|---|---|
| `belongs_to` | ينتمي إلى |
| `requires` | يتطلب |
| `supplied_by` | مُزوّد من |
| `has_cost` | يحمل تكلفة |
| `generates` | يولد |
| `subject_to` | خاضع لـ |
| `competes_with` | يتنافس مع |
| `priced_at` | مسعّر بـ |
| `financed_by` | مُموّل بـ |
| `valued_by` | مُقيّم بـ |
| `exposed_to` | معرض لـ |
| `evaluated_in` | مُقّيم ضمن |
| `follows` | يتبع |
| `measured_by` | يُقاس بـ |

---

## 6. مثال — مطعم

```text
Restaurant
  ├── requires → License (بلدية، دفاع مدني)
  ├── requires → Equipment (فرن، ثلاجة، POS)
  ├── supplied_by → Suppliers
  ├── has_cost → EquipmentCost
  ├── has_cost → LaborCost
  ├── has_cost → RentCost
  ├── generates → Revenue (AverageTicket × Customers)
  ├── subject_to → VAT (15%)
  ├── subject_to → Zakat (2.5%)
  ├── competes_with → Competitors
  ├── priced_at → MarketPrices
  ├── financed_by → Loan / Partner
  ├── valued_by → ValuationEngine
  ├── exposed_to → MarketRisk
  ├── evaluated_in → Scenarios
  ├── follows → BestPractices
  └── measured_by → KPIs (IRR, NPV, DSCR)
```

---

## 7. Representation

### 7.1 Graph Database (مستقبلي)
- يُنصح باستخدام graph database (مثل Neo4j أو pggraph) للاستعلامات المعقدة.
- في المرحلة الأولى يمكن تمثيل الرسم البياني في PostgreSQL باستخدام جداول:
  - `knowledge_nodes` (id, type, label_ar, label_en, data)
  - `knowledge_edges` (source_id, target_id, relationship_type, weight, metadata)

### 7.2 Query Examples

```sql
-- جميع المعدات المطلوبة لمطعم
SELECT n2.*
FROM knowledge_nodes n1
JOIN knowledge_edges e ON e.source_id = n1.id
JOIN knowledge_nodes n2 ON n2.id = e.target_id
WHERE n1.type = 'Activity' AND n1.label_en = 'Restaurant'
  AND e.relationship_type = 'requires'
  AND n2.type = 'Equipment';
```

---

## 8. استخدام Knowledge Graph

| المحرك | الاستخدام |
|---|---|
| **Valuation Engine** | معرفة العوامل المؤثرة على قيمة الأصل. |
| **Feasibility Engine** | معرفة التكاليف والإيرادات المتوقعة. |
| **Risk Engine** | معرفة المخاطر القطاعية. |
| **Financing Engine** | معرفة خيارات التمويل المناسبة. |
| **AI Analyst** | الحصول على سياق قطاعي للتحليل. |
| **Recommendation Engine** | اكتشاف الفرص والتهديدات المترابطة. |

---

## 9. قواعد التطوير

- لا يُضاف أي نشاط اقتصادي جديد دون ربطه بالعقد الأخرى.
- كل عقدة يجب أن تحمل مصدر المعرفة وتاريخ التحديث.
- العلاقات يجب أن تكون موثقة وقابلة للقياس.
- يُمنع تكرار العقد بنفس الاسم أو المعنى.
