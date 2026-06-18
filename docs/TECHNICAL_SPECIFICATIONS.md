# Bonds Global — Technical Specifications

> مواصفات فنية تفصيلية لأهم 5 ميزات مطلوبة في المراحل الأولى.

---

## 1. Centralized Rate Limiting Middleware

### Objective
حماية جميع APIs من الاستخدام المفرط والـ DDoS البسيطة.

### Requirements
- تطبيق على `/api/*` و `/api/v3/*`.
- limits مختلفة حسب endpoint:
  - Public data: 100 req/min per IP.
  - Auth endpoints: 10 req/min per IP.
  - AI chat: 20 req/min per IP.
  - Webhooks: exempt but validated by signature.
- دعم Redis أو in-memory fallback.
- رسائل خطأ واضحة مع `Retry-After` header.

### API Impact
```javascript
// Before
module.exports = async function handler(req, res) { ... }

// After
const { withRateLimit } = require('../lib/api/rate-limit');
module.exports = withRateLimit('public', async function handler(req, res) { ... });
```

### Acceptance Criteria
- [ ] يتم رفض الطلبات بعد تجاوز الحد.
- [ ] لا يتأثر الأداء بشكل ملحوظ (< 10ms overhead).
- [ ] يعمل على Vercel serverless.

### Tests
- Unit tests للـ limiter.
- API tests للـ 429 responses.

---

## 2. Unified Admin Auth Middleware

### Objective
توحيد التحقق من صلاحيات المشرفين في API واحد قابل لإعادة الاستخدام.

### Requirements
- قراءة `Authorization: Bearer <token>`.
- التحقق من `supabase.auth.getUser(token)`.
- البحث في `admin_roles`.
- دعم `ADMIN_EMAIL` env var fallback.
- دعم مستويات: `super_admin`, `admin`, `support`, `viewer`.
- رفع خطأ 403 إذا لم يكن لدى المستخدم الصلاحية.

### API Impact
```javascript
const { requireAdmin } = require('../lib/api/admin-auth');

module.exports = requireAdmin(['super_admin', 'admin'], async (req, res) => {
  // handler
});
```

### DB Changes
- لا يوجد (يستخدم `admin_roles` الحالي).

### Acceptance Criteria
- [ ] رفض المستخدمين غير المصرح لهم.
- [ ] السماح لـ owner email fallback.
- [ ] توحيد جميع `/api/admin` و `/api/v3/admin/*`.

### Tests
- API tests لكل role.
- Tests للـ 401/403 responses.

---

## 3. CRM Tables

### Objective
بناء نظام CRM كامل لمسار `Lead → Prospect → Client → Project → Contract → Invoice`.

### Schema

```sql
CREATE TABLE crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text,
  status text DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','disqualified','converted')),
  name text,
  email text,
  phone text,
  country_code text,
  city_code text,
  sector text,
  activity text,
  estimated_budget numeric(14,2),
  interest_tier text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  converted_prospect_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE crm_prospects (...);
CREATE TABLE crm_clients (...);
CREATE TABLE crm_projects (...);
CREATE TABLE crm_contracts (...);
CREATE TABLE crm_invoices (...);
```

**راجع `CRM_DATA_MODEL.md` للتفاصيل الكاملة.**

### API Endpoints
- `GET/POST /api/crm/leads`
- `GET/PUT/DELETE /api/crm/leads/:id`
- `GET/POST /api/crm/prospects`
- `GET/POST /api/crm/clients`
- `GET/POST /api/crm/projects`
- `GET/POST /api/crm/contracts`
- `GET/POST /api/crm/invoices`

### Auth
- Admin / sales roles فقط.

### Acceptance Criteria
- [ ] يمكن إنشاء Lead من `contact_messages`.
- [ ] التحويل التلقائي إلى Prospect/Client عند التسجيل/الدفع.
- [ ] RLS تسمح للـ sales/admin بإدارة السجلات.

### Tests
- Integration tests للـ CRUD.
- RLS tests.

---

## 4. Credit Scoring API (Arab-Bank Compatible)

### Objective
توفير endpoint يحسب درجة ائتمانية متوافقة مع معايير البنوك العربية.

### Input
```json
{
  "entity_type": "individual | startup | sme",
  "country_code": "SA",
  "profile_id": "uuid",
  "project_id": "uuid (optional)",
  "financial_data": { ... },
  "bureau_report": { ... },
  "collateral": [ ... ],
  "guarantors": [ ... ]
}
```

### Output
```json
{
  "score": 78,
  "grade": "A",
  "risk_rating": "low",
  "decision": "approved_with_conditions",
  "breakdown": {
    "financial_capacity": 22/25,
    "credit_history": 18/20,
    "collateral": 14/20,
    "reputation": 12/15,
    "sector_country_risk": 7/10,
    "compliance": 4/5,
    "readiness": 1/5
  },
  "conditions": ["requires_guarantor"]
}
```

### Endpoints
- `POST /api/v3/credit-score/calculate`
- `GET /api/v3/credit-score/:id`
- `GET /api/v3/credit-score/:id/report` (PDF)

### Auth
- Bearer JWT للمستخدم.
- Admin token للوصول إلى تقارير العملاء.

### DB Tables
- `credit_scores`
- `credit_score_components`
- `collateral_items`
- `guarantors`
- `sharia_screening`

### Acceptance Criteria
- [ ] يحسب الدرجة للأفراد والناشئات والـ SMEs.
- [ ] يأخذ الضمانات والكفالات بعين الاعتبار.
- [ ] يُنتج تقرير PDF احترافي.
- [ ] يخزن التاريخ للـ calibration المستقبلي.

### Tests
- Unit tests لكل بُعد.
- API tests لكل entity type.
- Calibration tests على بيانات تجريبية.

---

## 5. V3 Data Cache Layer

### Objective
تقليل تكلفة وتحسين أداء endpoints V3 التي تعتمد على بيانات ثابتة نسبيًا.

### Requirements
- Cache للـ endpoints:
  - `/api/v3/sectors`
  - `/api/v3/models`
  - `/api/v3/cities`
  - `/api/v3/cities/:code/indicators`
- TTL حسب نوع البيانات:
  - Master data: 24 ساعة.
  - Indicators: 1 ساعة.
  - Market data: 6 ساعات.
- Invalidation يدوي عبر admin API.
- دعم Redis أو `http_cache` table في Supabase.

### API Impact
```javascript
const { withCache } = require('../lib/api/cache');

module.exports = withCache('cities', 3600, async (req, res) => { ... });
```

### DB Changes
- استخدام جدول `http_cache` الموجود في V3.

### Acceptance Criteria
- [ ] تقليل زمن الاستجابة بنسبة 50%+ للبيانات المخزنة.
- [ ] تقليل استهلاك Supabase compute.
- [ ] تحديث فوري عند تغيير البيانات.

### Tests
- Performance tests قبل/بعد.
- Cache invalidation tests.

---

## 6. Implementation Order

```text
Week 1-2: Rate Limiting + Admin Auth
Week 3-4: CRM Tables + APIs
Week 5-8: Credit Scoring API
Week 9-10: V3 Cache Layer
Week 11+: Integration + Testing
```

---

## 7. Common Requirements Across All Features

- **CORS**: تقييد Origins.
- **Validation**: Joi/Zod لكل inputs.
- **Logging**: تسجيل الأخطاء بدون أسرار.
- **Tests**: unit + API + integration.
- **Docs**: تحديث API_INVENTORY.md بعد كل تغيير.

---

## 8. Success Criteria

| الميزة | المعيار |
|---|---|
| Rate Limiting | 100% APIs protected، < 10ms overhead |
| Admin Auth | 0 auth bypass in penetration test |
| CRM | Full CRUD، RLS working، auto-conversion |
| Credit Scoring | AR ≥ 0.5، report generated < 2s |
| V3 Cache | 50% latency reduction |
