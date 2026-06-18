# دليل نشر Bonds Global SaaS — الإصدار النهائي
## Supabase → Stripe → Moyasar → Vercel (خطوة بخطوة)

---

## 🚀 الطريقة السريعة (One-Click)

بعد إنشاء الحسابات فقط، شغّل هذين الأمرين:

```bash
# 1. إعداد Supabase (جداول + RLS + Triggers + Migrations الجديدة)
SUPABASE_DB_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" npm run setup:supabase

# 2. إنشاء منتجات Stripe بالريال السعودي
STRIPE_SECRET_KEY="sk_test_xxx" npm run setup:stripe
```

**النتيجة:**
- ✅ قاعدة البيانات جاهزة
- ✅ منتجات Stripe جاهزة بعملة SAR + Price IDs مطبوعة
- ✅ انسخ الـ Price IDs إلى Vercel مباشرة

---

## الجزء ١: Supabase (قاعدة البيانات + المصادقة)

### ١.١ إنشاء المشروع
1. اذهب إلى [supabase.com](https://supabase.com) وسجّل دخولك
2. اضغط "New Project"
3. اختار اسم المؤسسة (مثال: `bonds-global`)
4. اختار اسم المشروع: `bonds-saas`
5. اختار region: **الأقرب لعملائك** (مثال: `Middle East (UAE)` أو `West US`)
6. اضغط "Create new project" وانتظر ٢–٣ دقائق

### ١.٢ إعداد قاعدة البيانات (Migrations)

**الطريقة المُوصى بها — عبر SQL Editor:**
1. من Dashboard → اذهب إلى **SQL Editor** (أعلى يسار)
2. اضغط **"New query"**
3. نفّذ كل migration بالترتيب:

```sql
-- Migration 1: الأساسي (الجداول الرئيسية)
\i supabase/migrations/20260608010000_admin_roles.sql

-- Migration 2: Analytics
\i supabase/migrations/20260608020000_usage_logs.sql

-- Migration 3: Contact Form
\i supabase/migrations/20260608030000_contact_messages.sql

-- Migration 4: Profiles sync
\i supabase/migrations/20260608040000_profiles_email_phone.sql

-- Migration 5: Moyasar invoices
\i supabase/migrations/20260608030000_moyasar_invoices.sql
```

**أو يدوياً — نسخ/لصق:**
1. افتح كل ملف `.sql` في `supabase/migrations/`
2. انسخ المحتوى بالكامل
3. الصق في SQL Editor → اضغط **Run**
4. كرر لكل migration بالترتيب

### ١.٣ إعداد Auth (المصادقة)
1. من Sidebar → **Authentication** → **Providers**
2. تأكد تفعيل **Email** (مفعّل افتراضياً)
3. (اختياري) فعّل **Confirm email** إذا تريد التحقق من البريد
4. من Sidebar → **Authentication** → **URL Configuration**
5. في حقل **Site URL** ضع: `https://bonds-global.vercel.app` (أو دومينك النهائي)
6. في **Redirect URLs** أضف:
   - `https://bonds-global.vercel.app/calculators/auth/`
   - `https://bonds-global.vercel.app/en/calculators/auth/`

### ١.٤ إعداد Webhook للإيميلات (اختياري)
1. من Sidebar → **Database** → **Webhooks** (أو **Hooks**)
2. أنشئ webhook جديد → اسمه `user-created-email`
3. **Table**: `profiles`
4. **Events**: `INSERT`
5. **URL**: `https://bonds-global.vercel.app/api/webhook-user-created`
6. **Headers**: `Authorization: Bearer [SUPABASE_SERVICE_ROLE_KEY]`

### ١.٥ الحصول على مفاتيح API
1. من Sidebar → **Project Settings** (أسفل) → **API**
2. انسخ القيم التالية:
   - **Project URL** ← `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** ← `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** ← `SUPABASE_SERVICE_ROLE_KEY` (🔒 سرّي — لا تُعرضه أبداً في Frontend)

---

## الجزء ٢: Stripe (المدفوعات بالبطاقة)

### ٢.١ إنشاء الحساب
1. اذهب إلى [stripe.com](https://stripe.com) وسجّل دخولك
2. اختار "Developers" → فعّل **Test mode** أولاً

### ٢.٢ إنشاء Tax Rate (VAT 15%)
1. من Sidebar → **Tax** → **Tax rates** → **Add tax rate**
2. **Display name**: `VAT`
3. **Inclusive / Exclusive**: اختر **Exclusive** (تُضاف فوق السعر)
4. **Percentage**: `15`
5. **Country**: `Saudi Arabia`
6. اضغط **Save** → انسخ الـ ID (يبدأ بـ `txr_`) ← `STRIPE_TAX_RATE_ID`

### ٢.٣ إنشاء المنتجات والأسعار (SAR)
```bash
STRIPE_SECRET_KEY="sk_test_xxx" npm run setup:stripe
```

**النتيجة:** يطبع لك الـ Script الـ `Price IDs` — انسخها مباشرة.

**أو يدوياً:**
1. من Sidebar → **Product Catalog** → **Products** → **Add product**
2. أنشئ منتج **Pro**:
   - Name: `Bonds Pro`
   - Price: `71.00 SAR` | Recurring | Month
3. أنشئ منتج **Enterprise**:
   - Name: `Bonds Enterprise`
   - Price: `184.00 SAR` | Recurring | Month
4. انسخ **Price IDs** (تبدأ بـ `price_`)

### ٢.٤ إعداد Webhook
1. من Sidebar → **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://bonds-global.vercel.app/api/webhook`
3. اختار الأحداث (Select events):
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. اضغط **Add endpoint**
5. افتح الـ Endpoint الجديد → انسخ **Signing secret** (يبدأ بـ `whsec_`) ← `STRIPE_WEBHOOK_SECRET`

### ٢.٥ الحصول على مفاتيح API
1. من Sidebar → **Developers** → **API keys**
2. انسخ:
   - **Publishable key** (`pk_test_...`) ← `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (`sk_test_...`) ← `STRIPE_SECRET_KEY`

---

## الجزء ٣: Moyasar (SADAD / التحويل البنكي)

### ٣.١ إنشاء الحساب
1. اذهب إلى [dashboard.moyasar.com](https://dashboard.moyasar.com)
2. سجّل حساب جديد (Business)
3. أكمل التحقق (KYC) — قد يستغرق ١–٢ يوم

### ٣.٢ الحصول على مفاتيح API
1. من Sidebar → **Developers** → **API Keys**
2. انسخ:
   - **Secret Key** (`sk_test_...` أو `sk_live_...`) ← `MOYASAR_SECRET_KEY`
   - **Publishable Key** (`pk_test_...`) ← للـ Frontend (اختياري حالياً)

### ٣.٣ إعداد Webhook (اختياري لكن مُوصى به)
1. من Sidebar → **Webhooks** → **Add webhook**
2. URL: `https://bonds-global.vercel.app/api/moyasar-webhook`
3. Events: `invoice.paid`
4. (ملاحظة: `api/moyasar-webhook.js` غير منشأ — التحقق يتم عبر polling أو redirect)

---

## الجزء ٤: Vercel (الاستضافة + النشر)

### ٤.١ ربط المشروع
1. اذهب إلى [vercel.com](https://vercel.com) وسجّل دخولك بـ GitHub
2. اضغط **"Add New Project"**
3. اختار مستودع `bonds-global-web`
4. في إعدادات المشروع:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: (اتركه فارغاً — لدينا `vercel.json`)
   - **Output Directory**: (اتركه فارغاً)
5. اضغط **Deploy** (سيفشل أولاً لأننا لم نضف المتغيرات بعد — لا مشكلة)

### ٤.٢ إضافة متغيرات البيئة (Environment Variables)
1. افتح المشروع في Vercel → **Settings** → **Environment Variables**
2. أضف كل المتغيرات التالية:

| Variable | Value | مثال |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام (anon) | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | المفتاح السري (service_role) | `eyJhbG...` |
| `SUPABASE_DB_URL` | PostgreSQL connection string | `postgresql://...` |
| `STRIPE_SECRET_KEY` | Secret key من Stripe | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key | `pk_test_...` |
| `STRIPE_PRICE_PRO` | Price ID لـ Pro | `price_...` |
| `STRIPE_PRICE_ENTERPRISE` | Price ID لـ Enterprise | `price_...` |
| `STRIPE_TAX_RATE_ID` | Tax Rate ID للـ VAT 15% | `txr_...` |
| `MOYASAR_SECRET_KEY` | Secret key من Moyasar | `sk_test_...` |
| `NEXT_PUBLIC_APP_URL` | رابط الموقع النهائي | `https://bonds-global.vercel.app` |
| `ADMIN_EMAILS` | إيميلات المشرفين | `admin@bonds-global.com` |
| `ADMIN_USER_IDS` | UUIDs المشرفين (اختياري) | `uuid1,uuid2` |

3. تأكد إضافة كل المتغيرات لكل البيئات: **Production**, **Preview**, **Development**

### ٤.٣ إعادة النشر
1. ادفع أي commit جديد إلى GitHub:
```bash
git add .
git commit -m "Production ready: SAR pricing + VAT + Moyasar"
git push
```
2. سينشر Vercel تلقائياً

---

## الجزء ٥: اختبار ما بعد النشر (Test Mode)

### ٥.١ اختبار المصادقة
1. افتح `https://your-site.vercel.app/calculators/auth/`
2. أنشئ حساب جديد ببريد إلكتروني
3. تأكد ظهور البريد في Supabase → Table Editor → `profiles`

### ٥.٢ اختبار Stripe (بطاقة)
1. اذهب إلى Pricing → اضغط "💳 اشترك Pro"
2. في Stripe Checkout استخدم بيانات اختبارية:
   - Card: `4242 4242 4242 4242`
   - Date: أي تاريخ مستقبلي
   - CVC: أي 3 أرقام
3. تأكد ظهور VAT 15% في الفاتورة
4. بعد الدفع الناجح:
   - تأكد ظهور الاشتراك في Supabase → `subscriptions`
   - تأكد تحديث `profiles.tier` إلى `pro`

### ٥.٣ اختبار Moyasar (SADAD)
1. اذهب إلى Pricing → اضغط "🏦 ادفع عبر SADAD"
2. يُعاد توجيهك إلى صفحة Moyasar
3. في **Test mode** استخدم:
   - اضغط "Success" مباشرة (إذا متوفر)
   - أو استخدم بيانات اختبار Moyasar
4. بعد الدفع:
   - تأكد إنشاء سجل في `moyasar_invoices`
   - تأكد تفعيل `profiles.tier` إلى `pro`

### ٥.٤ اختبار Webhook
1. في Stripe Dashboard → Developers → Webhooks → اضغط على endpoint
2. انظر إلى **Recent deliveries** — يجب أن ترى أحداث `checkout.session.completed` و `invoice.payment_succeeded`
3. في Supabase → `webhook_events` — تأكد تسجيل الأحداث

### ٥.٥ اختبار Admin Dashboard
1. افتح `https://your-site.vercel.app/admin/`
2. سجّل دخول بحساب admin
3. تأكد ظهور:
   - إحصائيات المستخدمين
   - الرسائل (Contact Form)
   - Analytics

---

## الجزء ٦: الانتقال للـ Production (Live)

### ٦.١ Stripe Live
1. في Stripe → شغّل **Live mode** (زر أعلى اليمين)
2. أنشئ **Tax Rate** جديد للـ Live (نفس الخطوات)
3. شغّل:
   ```bash
   STRIPE_SECRET_KEY="sk_live_xxx" npm run setup:stripe
   ```
4. أنشئ **Webhook endpoint** جديد في Live mode
5. حدّث هذه المتغيرات في Vercel بقيم Live:
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_ENTERPRISE`
   - `STRIPE_TAX_RATE_ID`
   - `STRIPE_WEBHOOK_SECRET`

### ٦.٢ Moyasar Live
1. في Moyasar Dashboard → فعّل **Live mode**
2. احصل على **Live Secret Key**
3. حدّث `MOYASAR_SECRET_KEY` في Vercel

### ٦.٣ إعادة النشر
```bash
git commit --allow-empty -m "Go live"
git push
```

---

## 🆘 استكشاف أخطاء شائعة

| المشكلة | السبب | الحل |
|---|---|---|
| `Supabase not initialized` | المفاتيح غير مضبوطة | تأكد من `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `Invalid API key` | استخدام `service_role` في Frontend | استخدم `anon` key فقط في Frontend |
| Webhook 400 error | Signature mismatch | تأكد تطابق `STRIPE_WEBHOOK_SECRET` |
| Checkout لا يفتح | Price ID خاطئ | تأكد `STRIPE_PRICE_PRO` يبدأ بـ `price_` ويعمل في نفس الـ mode (test/live) |
| VAT لا تظهر | `STRIPE_TAX_RATE_ID` غير مضبوط | تأكد إنشاء Tax Rate في Stripe ونسخ المعرف |
| tier لا يتغير بعد الدفع | Webhook لا يصل | تأكد رابط الـ Webhook يبدأ بـ `https` |
| SADAD لا يعمل | `MOYASAR_SECRET_KEY` غير مضبوط | تأكد المفتاح صحيح ومُفعّل |
| `/api/env` فارغ | المتغيرات غير محددة | أضف `NEXT_PUBLIC_` prefix للمتغيرات العامة |

---

**هل تحتاج مساعدة في خطوة معينة؟** 🚀
