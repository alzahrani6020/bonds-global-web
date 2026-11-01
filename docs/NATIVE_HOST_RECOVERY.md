# دليل استرداد مضيف Bonds Native

> يشرح كيف تعيد تشغيل مضيف الذكاء الاصطناعي المحلي (النموذج + خدمة token + النفق) إذا تعطل الجهاز الحالي أو احتجت نقله.
> **غير مجرَّب على جهاز نظيف.** مبني على سكربتات التثبيت الموجودة وعلى حالة المضيف الحالية. جرّبه أول مرة في وقت صيانة.
> لا يحتوي أي سر. الأسماء والمسارات فقط.

## 1. ما الذي يعمل أين

| المكوّن | الموقع | يتعافى تلقائياً؟ |
|---|---|---|
| الموقع + API | Vercel (يتأثر بتعطل المضيف فقط عبر المساعد) | نعم |
| خدمة Native (النموذج) | `BondsNativeRuntimeService`، المنفذ `127.0.0.1:8765` | نعم عند الانهيار (SCM) |
| خدمة token | `BondsTokenRuntimeService`، المنفذ `127.0.0.1:8771` | نعم عند الانهيار (SCM) |
| النفق | خدمة `Cloudflared` → `native.bonds-global.com` و`token.bonds-global.com` | نعم عند الانهيار (SCM) |
| مراقب الصحة | مهمة `BondsServiceSupervisor` (SYSTEM) | يعيد تشغيل الخدمات التي تعلق |

عند تعطل **الجهاز كله** لا يتعافى شيء تلقائياً. المساعد على الإنتاج يعمل على Native فقط (`BONDS_AI_PROVIDER=native-only`)، فيتوقف حتى يعود المضيف.

## 2. ما الذي لا يمكن استرجاعه إلا من نسخة احتياطية

انسخ هذه العناصر دورياً إلى مكان مشفّر خارج الجهاز. **لا أعرف إن كانت لديك نسخة منها الآن.**

| العنصر | المسار | يمكن إعادة إنشائه؟ |
|---|---|---|
| قاعدة التوكنات | `C:\ProgramData\BondsTokenRuntime\data\tokens.db` | لا. تحتوي حالة الإلغاء (revocation). |
| سر الإدارة | `C:\ProgramData\BondsTokenRuntime\secrets\admin.secret` | يُنشأ سر جديد، لكنه محلي فقط ولا نسخة منه في Vercel. |
| سر القناة / الوسيط | `...\secrets\channel.secret` و`broker.secret` | نسختان في Vercel لكن بنوع Hidden لا يمكن قراءتهما. عند فقدهما أنشئ قيماً جديدة وحدّث Vercel (القسم 6). |
| توكن Native | متغير الجهاز `BONDS_NATIVE_TOKEN` | كذلك: نسخة Hidden في Vercel. أنشئ جديداً وحدّث Vercel. |
| بيانات النفق | `C:\ProgramData\BondsNative\cloudflared\<tunnel-id>.json` و`config.yml` | يمكن إعادة إنشاء النفق من لوحة Cloudflare، لكن النسخة أسرع. |
| النموذج | `C:\ProgramData\BondsNative\models\gemma-4-E4B-it-Q4_K_M.gguf` (~5 GB) | نعم. يُنزَّل ويُتحقق من SHA256 (القسم 4). |

## 3. متطلبات الجهاز الجديد

- Windows، وصلاحية مسؤول، وجهاز يبقى موصولاً بالكهرباء. الإعداد الموصى به: `powercfg /change standby-timeout-dc 0` و`standby-timeout-ac 0`، وضبط "ساعات النشاط" لمنع إعادة التشغيل التلقائي لتحديثات Windows.
- Python 3.12 في `C:\Program Files\Python312\` ثم:
  ```powershell
  & "C:\Program Files\Python312\python.exe" -m pip install -r requirements-native-inference.txt
  ```
  (`llama-cpp-python` و`pywin32`).
- `git`، وملف `cloudflared.exe` الحقيقي (لا shim).
- نسخة نظيفة من المستودع على `main`. مثبّت token يشترط نسخة Git نظيفة وبصمة بناء من 40 محرفاً.

## 4. إعادة بناء المضيف

كل الأوامر من PowerShell **بصلاحية مسؤول** داخل نسخة المستودع.

### 4.1 النموذج
```powershell
.\services\bonds_native_inference\windows\provision-canonical-model.ps1
```
ينزّل النموذج المعتمد في `canonical-model.json` ويتحقق من SHA256 (`0ffb122c...3770`). الإعدادات المعتمدة: `n_ctx=8192`, `n_threads=10`, `n_gpu_layers=-1`, `max_tokens=512`.

### 4.2 توكن Native (على الجهاز)
اضبط متغير الجهاز `BONDS_NATIVE_TOKEN` بقيمة عشوائية طويلة:
```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Environment]::SetEnvironmentVariable("BONDS_NATIVE_TOKEN", [Convert]::ToBase64String($b), "Machine")
```
إذا كانت لديك نسخة احتياطية من القيمة القديمة فاستعملها وتخطَّ القسم 6.

### 4.3 خدمة Native
```powershell
.\services\bonds_native_inference\windows\install-runtime-service.ps1 -ModelPath "C:\ProgramData\BondsNative\models\gemma-4-E4B-it-Q4_K_M.gguf" -Activate
```
تثبّت `BondsNativeRuntimeService` (تشغيل تلقائي + إعادة تشغيل عند الانهيار) وتنتظر `/health`. عند الفشل تتراجع.

### 4.4 النفق
ضع `config.yml` وملف بيانات النفق (`credentials-file`) في `%USERPROFILE%\.cloudflared\` ثم:
```powershell
.\services\bonds_native_inference\windows\install-cloudflared-service.ps1 -Activate
```
تنسخ الملفات إلى `C:\ProgramData\BondsNative\cloudflared\`، وتتحقق من إعداد الـ ingress، وتثبّت الخدمة، وتتأكد من `https://native.bonds-global.com/health`.

### 4.5 خدمة token
المثبّت **لا ينشئ أسراراً**. يشترط وجودها مسبقاً. اضبط متغيرات الجهاز التالية (المسارات المعتمدة حالياً):

| المتغير | القيمة |
|---|---|
| `BONDS_TOKEN_DB` | `C:\ProgramData\BondsTokenRuntime\data\tokens.db` |
| `BONDS_TOKEN_ADMIN_SECRET_FILE` | `C:\ProgramData\BondsTokenRuntime\secrets\admin.secret` |
| `BONDS_TOKEN_CHANNEL_SECRET_FILE` | `C:\ProgramData\BondsTokenRuntime\secrets\channel.secret` |
| `BONDS_TOKEN_BROKER_SECRET_FILE` | `C:\ProgramData\BondsTokenRuntime\secrets\broker.secret` |
| `BONDS_TOKEN_PORT` | `8771` |
| `BONDS_TOKEN_BUILD_COMMIT` | بصمة الإيداع (40 محرفاً) المسحوب منه الكود |
| `BONDS_TOKEN_PYTHON_EXE` | `C:\Program Files\Python312\python.exe` |

استعد قاعدة التوكنات والأسرار من النسخة الاحتياطية إن وجدت، وإلا أنشئ ملفات أسرار جديدة (قيمة عشوائية في كل ملف، بصلاحيات مقيّدة بـ SYSTEM والمسؤولين) واتبع القسم 6. ثم:
```powershell
.\services\bonds_token_runtime\windows\install-token-service.ps1 -Activate
```
التفاصيل وإجراء التراجع الكامل في `services/bonds_token_runtime/README.md` (قسم Recovery / rollback). لا تستعد نسخة قديمة من قاعدة التوكنات فوق قاعدة أحدث، لأن ذلك قد يعيد إحياء توكنات أُلغيت.

### 4.6 مراقب الصحة
```powershell
.\services\bonds_native_inference\windows\install-service-supervisor.ps1
```

## 5. التحقق
```powershell
.\services\bonds_native_inference\windows\service-supervisor.ps1 -Once       # الخدمات الثلاث (قراءة فقط)
.\services\bonds_native_inference\windows\verify-readiness.ps1                # محلي + نفق + إنتاج
```
ثم افتح `https://bonds-global.com/api/readiness` وتأكد: `status=ready` و`checks.native=ok` و`checks.assistant_chat=ok`.

## 6. إذا غيّرت أسراراً: حدّث Vercel أيضاً
الموقع يتصل بالمضيف بأسرار تطابق ما على الجهاز. بعد إنشاء قيم جديدة حدّث متغيرات Vercel في بيئة Production **بالقيم نفسها** ثم أعد إصدار الموقع:

- `BONDS_NATIVE_TOKEN` ← توكن Native
- `BONDS_TOKEN_CHANNEL_SECRET` ← محتوى `channel.secret`
- `BONDS_TOKEN_BROKER_SECRET` ← محتوى `broker.secret`
- `BONDS_TOKEN_EXPECTED_BUILD_COMMIT` ← يطابق `BONDS_TOKEN_BUILD_COMMIT` على الجهاز

إن اختلف أي سر عن الآخر فسيفشل `/api/readiness` (`native` أو `token_runtime`) وتُحجب ترقية الإصدار القادم.
لا تضع قيم الأسرار في المستودع ولا في المحادثات.

## 7. ما هو مخزَّن في Vercel ولا علاقة له بالمضيف
`BONDS_INFERENCE_MODE=REMOTE_BONDS_NATIVE`, `BONDS_NATIVE_REMOTE_URL`, `BONDS_NATIVE_TIMEOUT_MS`, `BONDS_AI_PROVIDER=native-only`, `BONDS_OPENAI_FALLBACK=false`. لا تغيّرها عند نقل المضيف إلا إذا تغيّر نطاق النفق.
عند الحاجة لتشغيل المساعد مؤقتاً أثناء غياب المضيف، يمكن حذف `BONDS_AI_PROVIDER` و`BONDS_OPENAI_FALLBACK` (يعود الاحتياط إلى OpenAI)، ثم إعادتهما لاحقاً. أي تغيير في متغيرات Vercel يسري بعد إعادة إصدار الموقع. هذا قرار تشغيلي يحتاج موافقتك لأن ردود OpenAI تختلف عن Native.
