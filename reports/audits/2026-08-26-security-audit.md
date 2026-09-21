# تقرير Audit أمني أولي — مشروع "السندات العالمية" (Supabase)

**تاريخ التقرير:** 2026-08-26
**مشروع Supabase:** bonds-global (ref: `hutxsqzplyuqgnghsrcs`)
**نطاق التقرير:** Read-Only — لم يُعدّل أي كود أو Schema أو Policy.

---

## 1. ملخص تنفيذي

- **إجمالي الجداول في `public`:** 198 جدول.
- **جداول بدون RLS:** 25 جدولاً.
- **جداول بـ RLS مُفعل:** 173 جدولاً.
- **Views عامة بدون RLS:** 3 views.
- **الوضع الأمني الحقيقي:** كل الجداول والـ Views بدون RLS لديها منح كاملة (`SELECT/INSERT/UPDATE/DELETE`) لكل من `anon` و`authenticated`. هذا يعني أن أي شخص يمتلك مفتاح `anon` (وهو متاح في المتصفح) يستطيع قراءة وتعديل وحذف بيانات هذه الجداول مباشرةً عبر Supabase API.
- **الكود الحالي لا يقرأ هذه الجداول من المتصفح** (حسب مراجعة الكود)، لكن التهديد قائم لأن الـ API مفتوح.

**ملاحظة مهمة:** لم أتمكن من سرد جميع تنبيهات Security Advisor الـ 141 (33 Critical + 108 Warnings) برمجياً لأنها تتطلب Management API token. هذا التقرير يغطي جميع المشاكل القابلة للاكتشاف من قاعدة البياناء + ما ظهر في لقطة الشاشة. إذا أردت تصنيفاً كاملاً لكل التنبيهات، يرجى تصديرها كـ CSV من لوحة Supabase أو نسخها هنا.

---

## 2. الجداول بدون RLS (25 جدولاً)

| # | الجدول | RLS | Policies حالية | حجم تقريبي | تصنيف البيانات | المستخدم الحالي |
|---|--------|-----|----------------|------------|----------------|-----------------|
| 1 | `_migrations` | ❌ Disabled | 0 | 32 kB | Internal only | migrations/scripts |
| 2 | `activity_market_profiles` | ❌ Disabled | 0 | 88 kB | Internal/Business data | Backend (غير مؤكد) |
| 3 | `bonds_objects` | ❌ Disabled | 1 (service_role only) | 40 kB | Internal IDs | Backend service role |
| 4 | `bonds_sequences` | ❌ Disabled | 1 (service_role only) | 24 kB | Internal IDs | Backend service role |
| 5 | `business_rules_registry` | ❌ Disabled | 1 (service_role only) | 96 kB | Internal config | Backend service role |
| 6 | `confidence_log` | ❌ Disabled | 0 | 24 kB | Internal analytics | غير مستخدم في الكود |
| 7 | `data_feedback` | ❌ Disabled | 0 | 40 kB | User feedback | غير مستخدم مباشرةً |
| 8 | `data_sources` | ❌ Disabled | 1 (service_role only) | 48 kB | Internal config | Backend service role |
| 9 | `fabric_api_contracts` | ❌ Disabled | 0 | 24 kB | Internal fabric | Backend service role |
| 10 | `fabric_conflicts` | ❌ Disabled | 0 | 32 kB | Internal fabric | غير مستخدم |
| 11 | `fabric_connector_definitions` | ❌ Disabled | 0 | 40 kB | Internal fabric | غير مستخدم |
| 12 | `fabric_consensus` | ❌ Disabled | 0 | 32 kB | Internal fabric | Backend service role |
| 13 | `fabric_data_quality` | ❌ Disabled | 0 | 32 kB | Internal fabric | Backend service role |
| 14 | `fabric_decision_impacts` | ❌ Disabled | 0 | 32 kB | Internal fabric | Backend service role |
| 15 | `fabric_marketplace_items` | ❌ Disabled | 0 | 40 kB | Internal fabric | Backend service role |
| 16 | `fabric_observability_events` | ❌ Disabled | 0 | 40 kB | Internal fabric | Backend service role |
| 17 | `fabric_plugins` | ❌ Disabled | 0 | 32 kB | Internal fabric | Backend service role |
| 18 | `fabric_provenance` | ❌ Disabled | 0 | 40 kB | Internal fabric | Backend service role |
| 19 | `fabric_refresh_policies` | ❌ Disabled | 0 | 32 kB | Internal fabric | غير مستخدم |
| 20 | `fabric_source_rankings` | ❌ Disabled | 0 | 32 kB | Internal fabric | غير مستخدم |
| 21 | `formula_registry` | ❌ Disabled | 1 (service_role only) | 48 kB | Internal config | Backend service role |
| 22 | `official_country_data` | ❌ Disabled | 0 | 104 kB | Public reference data | Scripts/migrations |
| 23 | `social_accounts` | ❌ Disabled | 0 | 48 kB | Social media config | Backend service role |
| 24 | `social_posts` | ❌ Disabled | 0 | 32 kB | Social media data | Backend service role |
| 25 | `social_scheduled_posts` | ❌ Disabled | 0 | 24 kB | Social media data | Backend service role |

---

## 3. الـ Views العامة بدون RLS (3 Views)

| # | View | RLS | Grants للـ anon | البيانات المعروضة | المستخدم في الكود |
|---|------|-----|-----------------|-------------------|-------------------|
| 1 | `assets_due_for_reassessment` | ❌ Disabled | SELECT/INSERT/UPDATE/DELETE | تقييمات أصول تقترب مواعيد إعادة التقييم | Admin UI (غير مؤكد) |
| 2 | `high_risk_assets` | ❌ Disabled | SELECT/INSERT/UPDATE/DELETE | تقييمات مخاطر عالية | غير مستخدم مباشرةً |
| 3 | `metric_feedback_accuracy` | ❌ Disabled | SELECT/INSERT/UPDATE/DELETE | ملخص دقة Metric Feedback | Backend service role (`v3/engine/data-acquisition/FeedbackEngine.js`) |

**ملاحظة خطيرة:** هذه الـ Views مبنية على جداول أساسية لها RLS (`asset_condition_assessments`, `risk_assessments`, `metric_feedback`)، لكن لأن الـ View نفسه بدون RLS وله `GRANT SELECT TO anon`، فإن أي مستخدم anon يستطيع قراءة البيانات من خلال الـ View حتى لو الجدول الأساسي محمي.

---

## 4. تصنيف الجداول/Views حسب نوع الوصول المقصود

### A) Public read مقصود
- `official_country_data` — بيانات مرجعية عامة عن الدول.

### B) Authenticated users (مستخدمون مسجلون)
- لا يوجد جدول بدون RLS يحتاج وصولاً عاماً للمستخدمين المسجلين.

### C) Admin/Internal only
- `assets_due_for_reassessment`
- `high_risk_assets`
- `activity_market_profiles`
- `data_feedback`
- `confidence_log`

### D) Service-role/backend only
- `bonds_objects`
- `bonds_sequences`
- `business_rules_registry`
- `formula_registry`
- `data_sources`
- جميع جداول `fabric_*`
- `social_accounts`, `social_posts`, `social_scheduled_posts`
- `_migrations`

---

## 5. مراجعة استخدام Supabase في الكود

### أنواع الـ Clients

| الملف | البيئة | المفتاح | الغرض |
|-------|--------|---------|-------|
| `supabase-client.js` | Browser | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | عميل anon عام |
| `bonds-auth-2026.js` | Browser | `SUPABASE_ANON_KEY` | توحيد Auth |
| `lib/api/supabase.js` | Server/Script | `SUPABASE_SERVICE_ROLE_KEY` | عميل service role |
| `v3/lib/supabase.js` | Server/Script | `SUPABASE_SERVICE_ROLE_KEY` | V3 service role |
| `v3/lib/auth.js` | Server | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | التحقق من التوكن |
| `v3/engine/loader.js` | Server | `SUPABASE_SERVICE_ROLE_KEY` | تحميل نماذج المشاريع |

### API Routes (جميعها Server / Service Role)

- `api/admin.js`
- `api/clear-user-data.js`
- `api/env.js`
- `api/funding.js`
- `api/health.js`
- `api/investment-analysis.js`
- `api/payments.js`
- `api/platform.js`
- `api/reference-data.js`
- `api/research.js`
- `v3/api/*`
- `lib/social/api-handlers.js`
- `lib/social/cache.js`

### الوصول المباشر من المتصفح إلى الجداول بدون RLS

**لم يُعثر على وصول مباشر من المتصفح إلى أي من الـ 25 جدولاً أو الـ 3 Views بدون RLS.**

الوصول من المتصفح محصور في جداول لها RLS مفعل، مثل:
`profiles`, `scenarios`, `subscriptions`, `user_notifications`, `risk_assessments`, `asset_valuations`، إلخ.

---

## 6. Functions ذات SECURITY DEFINER والـ Grants

| Function | SECURITY DEFINER | منفذة من anon | المخاطرة |
|----------|------------------|---------------|----------|
| `capture_lead` | ✅ | ✅ | مسموح عام — يُدرج leads فقط |
| `clear_data_quality_issues` | ✅ | ✅ | ⚠️ يحذف من `data_quality_issues` |
| `dq_run_all_checks` | ✅ | ✅ | ⚠️ يشغل فحوصات DQ |
| `exec_sql` | ✅ | ❌ (postgres + service_role فقط) | خطيرة جداً لكن محصورة |
| `get_user_permissions` | ✅ | ✅ | مقروءة عامة — مقبولة |
| `global_search` | ✅ | ✅ | مقروءة عامة — مقبولة |
| `grant_all_permissions` | ✅ | ✅ | ⚠️ تمنح كل الصلاحيات لدور |

**ملاحظة:** الـ Functions القابلة للتنفيذ من `anon` تتجاوز RLS لأنها `SECURITY DEFINER`. هذه ميزة مقصودة في Supabase للوصول المسيطر عليه، لكنها تحتاج مراجعة منطقية لكل function.

---

## 7. تصنيف المخاطر

### Critical (يجب إغلاقها فوراً)

| البند | السبب |
|-------|-------|
| `bonds_objects` + `bonds_sequences` | تخصيص IDs فريدة. التلاعب يؤدي إلى تضارب أو تسريب IDs. |
| `business_rules_registry` + `formula_registry` | قواعد وصيغ حسابية. التعديل يغير نتائج التقييمات والقرارات. |
| `data_sources` | إعدادات مصادر البيانات. التلاعب قد يعطل جمع البيانات. |
| `exec_sql` function | تنفيذ SQL عشوائي. محصور لكن يجب التأكد من أنه لا يُستخدم إلا من service_role. |
| 3 Views مكشوفة (`assets_due_for_reassessment`, `high_risk_assets`, `metric_feedback_accuracy`) | تعرض بيانات من جداول محمية عبر View بدون RLS. |

### High

| البند | السبب |
|-------|-------|
| جميع جداول `fabric_*` | بيانات بنية النظام والـ marketplace. |
| `social_accounts`, `social_posts`, `social_scheduled_posts` | بيانات وسائل التواصل والإعدادات. |
| `grant_all_permissions` function | تمنح صلاحيات واسعة وقابلة للتنفيذ من anon. |

### Medium

| البند | السبب |
|-------|-------|
| `activity_market_profiles` | بيانات سوق داخلية. |
| `data_feedback` | ملاحظات المستخدمين. |
| `confidence_log` | سجل تغييرات الثقة. |
| `official_country_data` | بيانات مرجعية عامة لكن التعديل يجب أن يكون محصوراً. |

### Low

| البند | السبب |
|-------|-------|
| `_migrations` | جدول migrations داخلي. |

---

## 8. Policies مقترحة (لم يُفعّل أي منها)

### للجداول التي يجب إغلاقها (Service-role only)

```sql
-- bonds_objects
ALTER TABLE public.bonds_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonds_objects_service_role_only"
  ON public.bonds_objects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- bonds_sequences
ALTER TABLE public.bonds_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonds_sequences_service_role_only"
  ON public.bonds_sequences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- business_rules_registry
ALTER TABLE public.business_rules_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_rules_registry_service_role_only"
  ON public.business_rules_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- formula_registry
ALTER TABLE public.formula_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formula_registry_service_role_only"
  ON public.formula_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- data_sources
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_sources_service_role_only"
  ON public.data_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### للـ Views المكشوفة

```sql
-- assets_due_for_reassessment
ALTER VIEW public.assets_due_for_reassessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_due_for_reassessment_authenticated"
  ON public.assets_due_for_reassessment
  FOR SELECT
  TO authenticated
  USING (true);

-- high_risk_assets
ALTER VIEW public.high_risk_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "high_risk_assets_authenticated"
  ON public.high_risk_assets
  FOR SELECT
  TO authenticated
  USING (true);

-- metric_feedback_accuracy
ALTER VIEW public.metric_feedback_accuracy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metric_feedback_accuracy_service_role"
  ON public.metric_feedback_accuracy
  FOR SELECT
  TO service_role
  USING (true);
```

**ملاحظة:** إذا كان الـ View مُستخدم فعلياً من المتصفح (حسب AGENTS.md قد تكون `assets_due_for_reassessment` للوحة الإدارة)، يجب تقييدها إلى `authenticated` مع RBAC مناسب بدلاً من `anon`.

### للجداول العامة المرجعية

```sql
-- official_country_data: قراءة عامة، تعديل محصور
ALTER TABLE public.official_country_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "official_country_data_public_read"
  ON public.official_country_data
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "official_country_data_service_role_write"
  ON public.official_country_data
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### لجداول Social Media

```sql
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_accounts_service_role"
  ON public.social_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "social_posts_service_role"
  ON public.social_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "social_scheduled_posts_service_role"
  ON public.social_scheduled_posts FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 9. أثر تفعيل RLS على النظام الحالي

### ما الذي **لن** يتوقف؟

- جميع API routes لأنها تستخدم service role.
- جميع scripts لأنها تستخدم service role.
- `bonds_objects`, `bonds_sequences`, `business_rules_registry`, `formula_registry`, `data_sources` لأنها تُستخدم فقط من service role.
- جميع عمليات UCP/Fabric لأنها تُستخدم من service role.

### ما الذي **قد** يتوقف؟

- أي Frontend code مستقبلي يحاول قراءة هذه الجداول مباشرةً.
- إذا كان هناك استخدام مباشر للـ Views من المتصفح (غير موجود حالياً حسب المراجعة).

### مخاطر جانبية

- `lib/api/supabase.js` يحتوي على fallback إلى `NEXT_PUBLIC_SUPABASE_ANON_KEY` إذا فشل service role. في Production لن يحدث هذا إذا كانت المتغيرات مضبوطة.
- بعض Functions مثل `grant_all_permissions` و`clear_data_quality_issues` قابلة للتنفيذ من anon؛ هذه ليست مشكلة RLS لكنها تحتاج مراجعة منطقية.

---

## 10. ترتيب الإصلاح الآمن (مقترح)

1. **قبل أي شيء:** خذ snapshot/backup للـ Production DB.
2. **الخطوة 1:** تفعيل RLS على الجداول الأكثر حساسية:
   - `bonds_objects`
   - `bonds_sequences`
   - `business_rules_registry`
   - `formula_registry`
   - `data_sources`
   مع Policy واحدة لـ `service_role`.
3. **الخطوة 2:** تفعيل RLS على الـ Views الثلاثة مع Policies مقيدة.
4. **الخطوة 3:** تفعيل RLS على جداول `fabric_*` وsocial مع Policies لـ service_role.
5. **الخطوة 4:** تفعيل RLS على `official_country_data` مع public read + service role write.
6. **الخطوة 5:** مراجعة Functions الـ `SECURITY DEFINER` القابلة للتنفيذ من anon (`grant_all_permissions`, `clear_data_quality_issues`).
7. **الخطوة 6:** اختبار شامل على Preview/Staging قبل Production.

---

## 11. ملاحظات مهمة

- لم يُعرض أي password أو service_role key أو JWT secret أو connection string في هذا التقرير.
- جميع البيانات المستخرجة من قاعدة البياناء هي metadata (أسماء جداول، أعمدة، grants، policies) ولا تحتوي على محتوى حساس.
- لم يُنفذ أي إصلاح. هذا التقرير للاعتماد قبل التنفيذ.

---

**التوصية:** لا تضغط "Fix" تلقائياً في Security Advisor. الترتيب المقترح أعلاه أكثر أماناً ويمنع تعطيل النظام.
