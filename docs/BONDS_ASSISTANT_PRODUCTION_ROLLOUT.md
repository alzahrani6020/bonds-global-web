# إطلاق BONDS Assistant V1 على الإنتاج

الحالة: **PASS — اكتملت جميع بوابات قبول production_rollout بتاريخ 2026-10-22.**

المرجعان الرسميان هما `BONDS_ASSISTANT_MASTER_PLAN.md` و`bonds-assistant-roadmap.json`.
هذا الملف يوثق إجراء الإطلاق والدليل التشغيلي فقط.

## نقطة البداية المتحققة — 2026-10-22

- المستودع: `alzahrani6020/bonds-global-web`؛ الفرع: `main`.
- Red Team مدمج عبر [PR #373](https://github.com/alzahrani6020/bonds-global-web/pull/373).
- SHA البداية: `73198471595d4948d5e9db00f5f857b61b2ff61c`.
- [CI #373](https://github.com/alzahrani6020/bonds-global-web/actions/runs/39772888099): PASS، بما فيه Accessibility في آخر attempt.
- مشروع Vercel: `bonds-global-web`، `prj_djffUO1KXbGKtumZBWsziWxqJ6Qk`، فريق `dr-talal`.
- النطاق المنشور: `https://bonds-global.com`.
- قاعدة الإنتاج المثبتة من `/api/env` ومن Supabase: `hutxsqzplyuqgnghsrcs` (`bonds-global`).

## سبب الترحيل الاستدراكي

[تشغيل #369](https://github.com/alzahrani6020/bonds-global-web/actions/runs/39771037310)
طبّق النسخة الأصلية من `20261022143000_assistant_action_audit.sql` من SHA
`a5016043b969ac7a8f8f19a3c2baa376785310a4`.
[تشغيل #371](https://github.com/alzahrani6020/bonds-global-web/actions/runs/39771878921)
توقف عند `Determine migrations` لأن ملفات forward السابقة غير قابلة للتعديل في مسار النشر.

فحص metadata المباشر في الإنتاج أثبت:

- جدول Audit موجود وRLS مفعل، لكن constraint يقبل تسعة أحداث قديمة فقط.
- `execution_started/succeeded/failed/denied` غير مقبولة في القاعدة.
- Trigger منع التعديل والحذف غير موجود.
- `service_role` يملك صلاحيات مباشرة على الجدول، بما فيها التعديل والحذف والتفريغ.
- `service_role` يملك بالفعل EXECUTE على append RPC؛ لا يوجد دليل على فشل تلك الصلاحية.

الترحيل الجديد هو:

`supabase/migrations/20261022120521_assistant_audit_rollout_recovery.sql`

يعدل constraint القائم، ويسحب الوصول المباشر إلى Audit، ويثبت حق الإضافة عبر RPC،
وينشئ Trigger بصياغة SQL صحيحة، ويضيف RPC قراءة metadata فقط باسم
`assistant_rollout_readiness()` متاحًا لـ`service_role` فقط. لا يغير أو يحذف سجلات موجودة.

**حدود الاستعادة:** يحتوي ملف #371 التاريخي على `AS $` غير صالح. يبقى كما هو التزامًا
بقاعدة عدم تعديل migrations المدمجة. الترحيل الجديد يصلح قاعدة الإنتاج الموجودة؛ لا يثبت
صلاحية إعادة تشغيل السلسلة التاريخية كاملة على قاعدة فارغة. تولد اسم الاستدراك من ساعة CLI
الحالية بتوقيت UTC، بينما أسماء الاعتماديات القديمة لاحقة له زمنيًا. يجب تطبيقه بعد تحقق
وجود جدولي Assistant السابقين، باستخدام آلية الملف المحدد في workflow الحالي.

## بوابات القبول

| البوابة | الدليل المطلوب |
|---|---|
| مراجعة المصدر | تغيير محصور في استدراك Audit وفحص جاهزية وقبول Assistant والوثائق |
| CI | Dependency Security وService Worker وCI الرئيسي PASS على نفس رأس PR |
| قاعدة البيانات | Apply Supabase Migrations PASS للملف الجديد، ثم فحص الكتالوج المباشر |
| جاهزية النشر | `/api/readiness` يعيد `checks.assistant=ok` و`assistant.schema_version=1` |
| نشر الإصدار | SHA الإصدار المرحلي يطابق `main` قبل promotion، و`/api/health.version` يطابقه بعده |
| جلسة موثقة | Production Authenticated Smoke ينجح باستخدام حساب الاختبار وMFA الموجودين |
| رحلة المساعد | protocol/registries/plan ورفض غير الموثق وغير المسجل وconfirmation وgoverned read وidempotency PASS |
| Audit فعلي | قراءة counts للأحداث المرتبطة بـmarker من تشغيل smoke، دون كشف بيانات أو أسرار |

فحص جاهزية Assistant يتحقق من تسعة شروط: وجود الجدولين وRLS عليهما، أحداث Audit،
صلاحيات RPC، منع الوصول المباشر إلى Audit، وTrigger الفعال. يعتمد فحص النشر المرحلي
على هذه النتيجة؛ نجاح unit tests وحده لا يجيز إثبات جاهزية قاعدة الإنتاج.

## أثر رحلة الاختبار

يعيد `scripts/assistant-production-smoke.js` استخدام جلسة workflow القائمة.
ينشئ marker فريدًا بالشكل `assistant-smoke-<SHA12>-<UUID>`، ويطبع هذا المعرف فقط
مع عدد الطلبات وحالة القبول. يختبر قدرة تنقل مسجلة، ولا يحفظ نموذجًا أو ملف تمويل.
ينشئ سجل idempotency اصطناعيًا ثم يحسمه `uncertain`؛ لا يدعي نجاح كتابة لم تحدث.

الدليل المتوقع في Audit عند نجاح الرحلة:

- تسعة أحداث مع `session_id = marker`.
- حدثا `execution_started` و`execution_succeeded` مع `metadata.request_id = marker`.

ردود API الناجحة لا تثبت Audit وحدها لأن الإضافة الحالية best-effort. يلزم التحقق المباشر
من counts المرتبطة بالمعرف قبل إغلاق الإطلاق، دون عرض محتوى سجلات العملاء.

## النشر والتراجع

1. يمر الإصلاح عبر PR والبوابات الثلاث دون bypass.
2. يطبق workflow الترحيل الجديد من SHA الدمج المحدد داخل transaction.
3. يعمل Production Release بعد CI على `main`: stage ثم readiness ثم current-main gate ثم promote.
4. تعمل رحلة smoke الموّثقة على الإصدار المنشور، ثم يتحقق Audit مباشرة.
5. عند فشل الترحيل، تتراجع transaction ولا يتغير الإصدار القديم؛ عند فشل readiness لا يحدث promotion.
6. بعد promotion يمكن الرجوع إلى إصدار Vercel السابق المتحقق منه. يحتفظ الاستدراك بجدول Audit
   ويقبل كل الأحداث السابقة، فلا يلزم حذف بيانات أو إزالة حماية السجل للتراجع عن كود التطبيق.

لا يغير هذا الإطلاق اختيار AI provider أو model أو context أو throughput، ولا يغير Service Token
أو صلاحيات التنفيذ. تظل confirmation تعبيرًا عن النية وتظل authorization منفصلة عنها.

## سجل الإثبات النهائي

- PR الإصلاح: #375
- SHA الإنتاج: `6313b460aaec33e21378f40d5a33cc493e3268b0`
- Apply Supabase Migrations: run `39776756331` — PASS
- CI — Tests, Audit & Visual Regression: run `39776756323` — PASS
- Production Release: run `39777448567` — PASS
- Production Authenticated Smoke: run `39777715213` — PASS
- Production `/api/health`: `status=ok`, `version=6313b46`, `environment=production`
- Production `/api/readiness`: `status=ready`, `checks.assistant=ok`, `assistant.schema_version=1`
- Supabase `assistant_rollout_readiness()`: `ready=true` وجميع الشروط التسعة = true
- Smoke marker: `assistant-smoke-6313b460aaec-0591d62a-f97e-4bec-9046-37e100058327`
- Audit المرتبط بـ`session_id`: 9 أحداث
- Audit المرتبط بـ`metadata.request_id`: `execution_started=1`, `execution_succeeded=1`

النتيجة النهائية: `production_rollout = PASS`، واكتمل BONDS Assistant V1. المرحلة التالية هي Phase 2 — Workflow & Documents.
