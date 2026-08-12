# ربط بوندز بمنصات التواصل الاجتماعي

هذا الملف يوثق كيفية ربط موقع بوندز وحساباته على **Instagram** و **YouTube** و **X**.

## نظرة عامة

- البنية جاهزة بالكامل في الكود.
- التوكنات والمفاتيح تُحفظ فقط في **متغيرات بيئة Vercel** ولا تُعرض في الواجهة الأمامية.
- إذا لم تُضف التوكنات، يظهر للزوار قسم "تابعنا" مع روابط الحسابات الافتراضية بدون Feed.
- يمكن نشر المنشورات فوراً أو جدولتها، مع رفع الصور/الفيديوهات إلى Supabase Storage.

## التطوير المحلي

لاختبار الربط محلياً:

1. انسخ `.env.example` إلى `.env.local` واملأ المتغيرات المطلوبة.
2. فعّل الـ Feed محلياً:
   ```env
   SOCIAL_FEED_ENABLED=true
   ```
3. شغّل الخادم:
   ```bash
   npm run dev:local
   ```
4. جرّب الـ endpoints:
   ```bash
   curl http://localhost:3005/api/social-feed?limit=2
   curl http://localhost:3005/api/social-accounts -H "Authorization: Bearer ADMIN_TOKEN"
   curl -X POST http://localhost:3005/api/social-publish \
     -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"platforms":["x"],"text":"منشور تجريبي"}'
   ```
   بدون Bearer token تُرجع الـ endpoints المحمية `401 Unauthorized`.

## متغيرات البيئة المطلوبة

في لوحة تحكم Vercel (Project Settings → Environment Variables) أضف:

```env
# تشغيل/إيقاف Feed
SOCIAL_FEED_ENABLED=true
SOCIAL_FEED_CACHE_TTL_SECONDS=900

# روابط الحسابات (اختياري — للفوتر وقسم Follow Us)
SOCIAL_INSTAGRAM_URL=https://instagram.com/bonds.global
SOCIAL_YOUTUBE_URL=https://www.youtube.com/@bondsglobal
SOCIAL_X_URL=https://x.com/bonds_global
SOCIAL_LINKEDIN_URL=https://www.linkedin.com/company/bonds-global

# Instagram (Graph API)
INSTAGRAM_ACCESS_TOKEN=          # long-lived User Access Token
INSTAGRAM_ACCOUNT_ID=            # Instagram Business Account ID
INSTAGRAM_APP_ID=                 # لتحديث التوكن (اختياري)
INSTAGRAM_APP_SECRET=             # لتحديث التوكن (اختياري)

# YouTube Data API v3 (قراءة)
YOUTUBE_API_KEY=
YOUTUBE_CHANNEL_ID=

# YouTube OAuth 2.0 (نشر فيديوهات)
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_ACCESS_TOKEN=             # قصير الأجل
YOUTUBE_REFRESH_TOKEN=            # للتجديد التلقائي

# X API v2 (قراءة)
X_BEARER_TOKEN=
X_USERNAME=                       # بدون @
# X OAuth 1.0a (نشر)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# Cron لتنفيذ المنشورات المجدولة
CRON_SECRET=
```

## كيفية الحصول على التوكنات

### Instagram

1. أنشئ تطبيقاً على [developers.facebook.com](https://developers.facebook.com).
2. أضف المنتج **Instagram Graph API**.
3. اربط حساب Instagram Business بصفحة Facebook.
4. احصل على **User Access Token** بصلاحيات `instagram_basic` و `instagram_content_publish`.
5. احصل على **Instagram Account ID** من Graph API Explorer عبر `/me/accounts` ثم `instagram_business_account.id`.

### YouTube

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com).
2. أنشئ مشروعاً وفّر **YouTube Data API v3**.
3. أنشئ **API Key** (للقراءة).
4. لرفع فيديوهات، أنشئ **OAuth 2.0 Web application credentials**.
5. استخدم OAuth flow للحصول على `refresh_token` و `access_token` مع النطاق `https://www.googleapis.com/auth/youtube.upload`.

### X (Twitter)

1. سجّل في [developer.x.com](https://developer.x.com) واحصل على مستوى **Basic** أو أعلى.
2. أنشئ تطبيقاً وأنشئ **Bearer Token** للقراءة.
3. في Keys and Tokens → **OAuth 1.0a** أنشئ Access Token & Secret بصلاحية **Read and Write**.

## Endpoints

| الطريقة | المسار | الوصف | الصلاحية |
|---|---|---|---|
| GET | `/api/social-feed` | جلب آخر المنشورات | عام |
| GET | `/api/social-accounts` | حالة الربط | Admin Bearer |
| POST | `/api/social-accounts` | اختبار توكن (`action=test`) | Admin Bearer |
| POST | `/api/social-publish` | نشر فوري | Admin Bearer |
| POST | `/api/social-upload` | رفع ميديا (base64) | Admin Bearer |
| GET / POST / DELETE | `/api/social-schedule` | إدارة المنشورات المجدولة | Admin Bearer |
| GET / POST | `/api/social-cron` | تنفيذ المنشورات المستحقة | CRON_SECRET |

## الجدولة

1. من لوحة الإدارة → **التواصل الاجتماعي** → **إنشاء منشور** → اكتب المحتوى واختر الموعد.
2. المنشور يُحفظ في جدول `social_scheduled_posts` بحالة `pending`.
3. أضف cron في Vercel أو GitHub Actions يستدعي:
   ```
   GET https://bonds-global.com/api/social-cron?cronSecret=CRON_SECRET
   ```
   كل 5-15 دقيقة.
4. عند حلول الموعد، يُنشر تلقائياً ويُحدّث `status` إلى `published` أو `failed` مع `results`.

## رفع الميديا

- من نفس نموذج الإنشاء اختر ملف صورة أو فيديو.
- الملف يُرفع إلى Supabase Storage في bucket `social-media`.
- YouTube يتطلب فيديو (≤16 MB عبر multipart upload).
- Instagram يتطلب رابط صورة/فيديو عام — استخدم رابط Supabase Storage.

## الأمان

- لا تُخزن التوكنات في `api/env.js` أو في ملفات HTML/JS.
- لا ترفع `.env` إلى Git.
- استخدم متغيرات بيئة Vercel فقط.
- `/api/social-cron` محمي بـ `CRON_SECRET`.

## استكشاف الأخطاء

- **Feed فارغ**: تأكد من `SOCIAL_FEED_ENABLED=true` والتوكنات صحيحة.
- **YouTube publish يفشل**: تحقق من `YOUTUBE_REFRESH_TOKEN` والنطاق `youtube.upload`.
- **Instagram publish يفشل**: يجب أن تكون الصورة/الفيديو برابط عام (public Supabase URL).
- **X publish يفشل**: تحقق من صلاحيات Access Token (Read and Write).
