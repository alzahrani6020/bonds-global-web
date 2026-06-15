# Bonds V3 Enterprise — Economic Intelligence Platform

> منصة ذكاء اقتصادي لدراسة جدوى المشاريع الاستثمارية في السعودية والمنطقة.

## الروابط المباشرة

- **API**: https://bonds-v3.vercel.app/api/health
- **CMS**: https://bonds-v3.vercel.app/admin

## الهيكل

```
bonds-v3/
├── api/
│   ├── index.js          ← API موحّد لجميع endpoints
│   └── admin.js          ← Admin API للـ CMS
├── admin/
│   └── index.html        ← واجهة الإدارة
├── engine/
│   ├── calculator.js              ← محرك الحسابات المالية
│   ├── ai.js                      ← AI Insights Engine
│   ├── llm.js                     ← Optional OpenAI integration
│   ├── loader.js                  ← تحميل البيانات من Supabase
│   └── data-acquisition/          ← Data Acquisition & Fusion Platform
│       ├── BaseAdapter.js
│       ├── FusionCore.js
│       ├── InferenceEngine.js
│       ├── DataPipeline.js
│       ├── adapters/              ← GASTAT, SAMA, Manual, LLM
│       └── engines/               ← City, Real Estate, Labor, Competition, Market, Pricing
├── lib/
│   └── supabase.js       ← عميل Supabase
├── scripts/
│   ├── dev-server.js     ← سيرفر محلي
│   ├── demo-calculate.js ← تجربة بدون قاعدة بيانات
│   ├── generate-extra-models.js
│   ├── generate-market-data.js
│   └── generate-model-variants.js
├── supabase/
│   ├── migrations/20260611000000_v3_master_data_v1.sql
│   ├── seed/20260611000001_v3_sample_data.sql
│   ├── seed/20260611000002_v3_more_models.sql
│   └── seed/20260611000003_v3_market_data.sql
│   └── seed/20260611000004_v3_model_variants.sql
├── docs/
│   └── SAMPLE_QUERIES.md
├── package.json
├── vercel.json
└── .env.example
```

## البيانات

- **10 قطاعات** اقتصادية
- **40+ نشاط** فرعي
- **92 نموذج مشروع** (5 أصلية + 18 إضافية + 69 متغيرة بالحجم)
- **10 مدن** سعودية
- **100+ صف** بيانات سوق
- **15 افتراض** مالي
- **6 عامل** مخاطر

## محرك الحسابات

يحسب:

- الإيرادات والتكاليف لـ 5 سنوات
- Gross / EBITDA / Net Margins
- Payback / ROI Months
- Break-even Revenue
- NPV و IRR
- DSCR
- Risk Score مرجّح

## AI Engine

- توصية قاعدية بالعربية
- نقاط قوة ومخاطر
- خطوات تالية
- **اختياري**: دمج OpenAI لتحليل نصي أعمق (يحتاج `OPENAI_API_KEY`)

## API Endpoints

| Endpoint | Method | الوصف |
|---|---|---|
| `/api/health` | GET | فحص الحالة |
| `/api/sectors` | GET | القطاعات والأنشطة |
| `/api/models` | GET | نماذج المشاريع |
| `/api/calculate` | POST | حساب دراسة جدوى |
| `/api/cities` | GET | قائمة المدن |
| `/api/cities/:code` | GET | تفاصيل مدينة مع المؤشرات |
| `/api/cities/:code/indicators` | GET | مؤشرات المدينة |
| `/api/cities/:code/market` | GET | بيانات السوق للمدينة |
| `/api/admin/*` | Various | إدارة البيانات |

### مثال حساب

```bash
curl -X POST https://bonds-v3.vercel.app/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "projectModelCode": "burger_restaurant_small",
    "cityCode": "RUH",
    "assumptions": { "revenue": 600000, "capex": 450000 }
  }'
```

## التشغيل المحلي

```bash
cd bonds-v3
cp .env.example .env.local
# عدّل المتغيرات
npm install
node scripts/dev-server.js
```

## النشر

```bash
cd bonds-v3
npx vercel --prod
```

## متغيرات البيئة

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_TOKEN=
OPENAI_API_KEY=          # اختياري
OPENAI_MODEL=gpt-4o-mini # اختياري
```

## Data Acquisition & Fusion Platform

منصة جمع البيانات تلقائياً من مصادر رسمية وتقدير الفجوات بذكاء. **النتيجة**: الحاسبة تُعدّل افتراضاتها تلقائياً حسب المدينة المختارة.

### طبقات البيانات
- **Bronze**: البيانات الخام من كل مصدر (`raw_data`, `data_source_runs`).
- **Silver**: المقاييس الموحدة مع درجة الثقة (`normalized_metrics`, `metric_definitions`).
- **Gold**: المؤشرات الجاهزة للحاسبة (`city_indicators`, `city_market_data`).

### المحركات الستة
1. **City Engine** — مؤشرات المدن الاقتصادية والديموغرافية.
2. **Real Estate Engine** — إيجارات وأسعار عقارية.
3. **Labor Engine** — توفر العمالة والرواتب.
4. **Competition Engine** — تحليل المنافسة والتشبع.
5. **Market Engine** — حجم السوق والطلب.
6. **Pricing Engine** — تكاليف البناء والمعدات والتشغيل.

### Adapters
- `GastatAdapter` — الهيئة العامة للإحصاء (محاولة API حقيقية + بيانات احتياطية).
- `SamaAdapter` — البنك المركزي السعودي (محاولة API حقيقية + بيانات احتياطية).
- `UaeStatsAdapter` — المركز الاتحادي للتنافسية والإحصاء (UAE).
- `EgyptCapmasAdapter` — الجهاز المركزي للإحصاء (مصر).
- `QatarPlanningAdapter` — هيئة التخطيط والإحصاء (قطر).
- `JordanStatsAdapter` — دائرة الإحصاءات العامة (الأردن).
- `ManualAdapter` — إدخال يدوي من فريق بوندز.
- `LLMEstimationAdapter` — تقدير ذكي للفجوات.

### Public City Intelligence
صفحة عمومية لعرض مؤشرات المدن:

```
https://bonds-v3.vercel.app/city-intelligence
```

APIs متاحة للجميع:

```
GET  /api/cities
GET  /api/cities/:code
GET  /api/cities/:code/indicators?year=
GET  /api/cities/:code/market?activity=&year=
```

### Data Acquisition APIs
```
GET  /api/data/sources
POST /api/data/sources/:source/fetch
GET  /api/data/metrics
GET  /api/data/indicators?city=&activity=&year=
POST /api/data/auto-fill
POST /data/ml/train              ← تدريب نماذج الانحدار
GET  /data/ml/models             ← قائمة النماذج المحفوظة
```

### Multi-Country Support
- جدول `country_benchmarks` يخزن المعايير الوطنية لكل دولة.
- `engine/city-adjustment.js` يستخدم المعايير الوطنية بدلاً من الثوابت السعودية.
- مدن إضافية: دبي، أبوظبي، الدوحة، القاهرة، الإسكندرية، عمّان.

### ML Regression
- `engine/ml/RegressionEstimator.js` ينفذ انحدار خطي بسيط.
- يتدرب من بيانات `city_indicators` + `city_market_data`.
- يُستخدم لتقدير `market_size` و `competitors_count` عند توفر عينات كافية.

### Feedback Loop

نظام تحسين مستمر للتقديرات:

- `metric_feedback` — يخزن القيم الفعلية مقارنة بالتقديرات
- `FeedbackEngine` — يحسب عوامل التصحيح من الملاحظات
- `InferenceEngine` — يطبق التصحيحات على التقديرات الجديدة
- Admin UI — تبويب لإرسال الملاحظات ومراقبة الدقة

```bash
cd bonds-v3
node scripts/demo-feedback-loop.js
```

### City Adjustment Engine

عند اختيار مدينة في `/api/calculate`:

- `engine/loader.js` يجلب `city_indicators` و `city_market_data`
- `engine/city-adjustment.js` يُعدّل الافتراضات:
  - `rent_ratio` حسب `avg_rent_per_sqm`
  - `salaries_ratio` حسب `avg_salary`
  - `revenue_growth_rate` حسب `growth_rate`
  - `discount_rate` حسب `inflation_rate`
  - `utilities_ratio` حسب `purchasing_power_index`
- درجة المخاطر تُعدّل حسب `business_ease_index` و `unemployment_rate`

### تجربة محلياً
```bash
cd bonds-v3
node scripts/demo-data-acquisition.js
node -e "
const { createClient } = require('@supabase/supabase-js');
const { loadProjectModel, createSupabaseClient } = require('./engine/loader');
const { calculate } = require('./engine/calculator');
(async () => {
  const supabase = createSupabaseClient();
  const data = await loadProjectModel(supabase, 'small_dental_clinic_model', 'RUH');
  console.log(calculate(data).summary);
})();
"
```

## الخطوات المتبقية المقترحة

1. ربط قاعدة Supabase الحقيقية بالنشر.
2. إضافة مصادقة للمستخدمين.
3. حفظ مشاريع المستخدمين (`user_projects`).
4. توليد تقارير PDF.
5. ربط Adapters بمصادر رسمية حقيقية (GASTAT API, SAMA API).
6. تحسين نماذج التقدير بالتعلم من بيانات المستخدمين.
