# دليل نشر Bonds Global SaaS
## Supabase → Stripe → Vercel (خطوة بخطوة)

---

## 🚀 الطريقة السريعة (One-Click)

بعد إنشاء الحسابات فقط، شغّل هذين الأمرين:

```bash
# 1. إعداد Supabase (جداول + RLS + Triggers)
SUPABASE_DB_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" npm run setup:supabase

# 2. إنشاء منتجات Stripe
STRIPE_SECRET_KEY="sk_test_xxx" npm run setup:stripe
```

**النتيجة:**
- ✅ قاعدة البيانات جاهزة
- ✅ منتجات Stripe جاهزة مع Price IDs مطبوعة
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

### ١.٢ إعداد قاعدة البيانات (تلقائي)
1. من Dashboard → **Project Settings** → **Database**
2. انسخ **Connection string** (URI format)
3. شغّل الأمر:
```bash
SUPABASE_DB_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres" npm run setup:supabase
```

**أو يدوياً:**
1. من Dashboard → اذهب إلى **SQL Editor** (أعلى يسار)
2. اضغط **"New query"**
3. انسخ ولصق محتوى ملف `templates/supabase-schema.sql` بالكامل
4. اضغط **"Run"**

### ١.٣ إعداد Auth (المصادقة)
1. من Sidebar → **Authentication** → **Providers**
2. تأكد تفعيل **Email** (مفعّل افتراضياً)
3. (اختياري) فعّل **Confirm email** إذا تريد التحقق من البريد
4. من Sidebar → **Authentication** → **URL Configuration**
5. في حقل **Site URL** ضع: `https://bonds-global.vercel.app` (أو دومينك النهائي)
6. في **Redirect URLs** أضف:
   - `https://bonds-global.vercel.app/calculators/auth/`
   - `https://bonds-global.vercel.app/en/calculators/auth/`

### ١.٤ الحصول على مفاتيح API
1. من Sidebar → **Project Settings** (أسفل) → **API**
2. انسخ القيم التالية:
   - **Project URL** ← `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** ← `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** ← `SUPABASE_SERVICE_ROLE_KEY` (🔒 سرّي — لا تُعرضه أبداً في Frontend)

---

## الجزء ٢: Stripe (المدفوعات)

### ٢.١ إنشاء الحساب
1. اذهب إلى [stripe.com](https://stripe.com) وسجّل دخولك
2. اختار "Developers" → فعّل **Test mode** أولاً

### ٢.٢ إنشاء المنتجات والأسعار (تلقائي)
```bash
STRIPE_SECRET_KEY="sk_test_xxx" npm run setup:stripe
```

**النتيجة:** يطبع لك الـ Script الـ `Price IDs` — انسخها مباشرة.

**أو يدوياً:**
1. من Sidebar → **Product Catalog** → **Products** → **Add product**
2. أنشئ منتج **Pro**:
   - Name: `Bonds Pro`
   - Price: `19.00 USD` | Recurring | Month
3. أنشئ منتج **Enterprise**:
   - Name: `Bonds Enterprise`
   - Price: `49.00 USD` | Recurring | Month
4. انسخ **Price IDs** (تبدأ بـ `price_`)

### ٢.٣ إعداد Webhook
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

### ٢.٤ الحصول على مفاتيح API
1. من Sidebar → **Developers** → **API keys**
2. انسخ:
   - **Publishable key** (`pk_test_...`) ← `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (`sk_test_...`) ← `STRIPE_SECRET_KEY`

---

## الجزء ٣: Vercel (الاستضافة + النشر)

### ٣.١ ربط المشروع
1. اذهب إلى [vercel.com](https://vercel.com) وسجّل دخولك بـ GitHub
2. اضغط **"Add New Project"**
3. اختار مستودع `bonds-global-web`
4. في إعدادات المشروع:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: (اتركه فارغاً — لدينا `vercel.json`)
   - **Output Directory**: (اتركه فارغاً)
5. اضغط **Deploy** (سيفشل أولاً لأننا لم نضف المتغيرات بعد — لا مشكلة)

### ٣.٢ إضافة متغيرات البيئة (Environment Variables)
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
| `NEXT_PUBLIC_APP_URL` | رابط الموقع النهائي | `https://bonds-global.vercel.app` |

3. تأكد إضافة كل المتغيرات لكل البيئات: **Production**, **Preview**, **Development**

### ٣.٣ إعداد GitHub Actions (CI/CD)
1. في Vercel Dashboard → Project Settings → **Git** → **Deploy Hooks** (اختياري)
2. أو استخدم GitHub Actions المُضمَّن:
   - اذهب إلى Vercel → Project Settings → **Git** → **Connected Git Repository**
   - تأكد تفعيل "Deploy every time a commit is pushed"
3. أضف **GitHub Secrets** (إذا تريد GitHub Actions):
   - `VERCEL_TOKEN` — من Vercel Account Settings → Tokens
   - `VERCEL_ORG_ID` — من Project Settings → General
   - `VERCEL_PROJECT_ID` — من Project Settings → General

### ٣.٤ إعادة النشر
1. ادفع أي commit جديد إلى GitHub:
```bash
git add .
git commit -m "SaaS ready"
git push
```
2. سينشر Vercel تلقائياً

---

## الجزء ٤: اختبار ما بعد النشر

### ٥.١ اختبار المصادقة
1. افتح `https://your-site.vercel.app/calculators/auth/`
2. أنشئ حساب جديد ببريد إلكتروني
3. تأكد ظهور البريد في Supabase → Table Editor → `profiles`

### ٥.٢ اختبار الاشتراك (Test Mode)
1. اذهب إلى Pricing → اضغط "Subscribe Pro"
2. في Stripe Checkout استخدم بيانات اختبارية:
   - Card: `4242 4242 4242 4242`
   - Date: أي تاريخ مستقبلي
   - CVC: أي 3 أرقام
3. بعد الدفع الناجح:
   - تأكد ظهور الاشتراك في Supabase → `subscriptions`
   - تأكد تحديث `profiles.tier` إلى `pro`
   - تأكد فتح PDF export في الحاسبة

### ٥.٣ اختبار Webhook
1. في Stripe Dashboard → Developers → Webhooks → اضغط على endpoint
2. انظر إلى **Recent deliveries** — يجب أن ترى أحداث `checkout.session.completed` و `invoice.payment_succeeded`
3. في Supabase → `webhook_events` — تأكد تسجيل الأحداث

### ٥.٤ اختبار تدفق كامل
1. سجّل دخولك → اذهب للحاسبة
2. أدخل بيانات → احفظ سيناريو
3. اذهب لـ `calculators/auth/account.html` → تأكد ظهور السيناريو
4. اضغط "Open" → تأكد تحميل السيناريو في الحاسبة

---

## الجزء ٥: الانتقال للـ Production (Live)

بعد اكتمال الاختبار:

1. في Stripe → شغّل **Live mode** (زر أعلى اليمين)
2. شغّل `STRIPE_SECRET_KEY="sk_live_xxx" npm run setup:stripe` لإنشاء منتجات Live
3. حدّث `STRIPE_SECRET_KEY` و `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` و `STRIPE_PRICE_PRO` و `STRIPE_PRICE_ENTERPRISE` بقيم Live في Vercel
4. أنشئ Webhook endpoint جديد في Live mode
5. حدّث `STRIPE_WEBHOOK_SECRET`
6. أعد نشر في Vercel

---

## 🆘 استكشاف أخطاء شائعة

| المشكلة | السبب | الحل |
|---|---|---|
| `Supabase not initialized` | المفاتيح غير مضبوطة | تأكد من `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY` في Vercel |
| `Invalid API key` | استخدام `service_role` في Frontend | استخدم `anon` key فقط في Frontend |
| Webhook 400 error | Signature mismatch | تأكد تطابق `STRIPE_WEBHOOK_SECRET` |
| Checkout لا يفتح | Price ID خاطئ | تأكد من `STRIPE_PRICE_PRO` يبدأ بـ `price_` |
| tier لا يتغير بعد الدفع | Webhook لا يصل | تأكد رابط الـ Webhook يبدأ بـ `https` وليس `http` |
| `/api/env` فارغ | المتغيرات غير محددة في Vercel | أضف `NEXT_PUBLIC_` prefix للمتغيرات العامة |

---

**هل تحتاج مساعدة في خطوة معينة؟** 🚀
