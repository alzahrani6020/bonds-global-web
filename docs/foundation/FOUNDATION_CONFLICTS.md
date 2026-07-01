# BONDS Foundation Conflicts — تعارضات التأسيس

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة تأسيس — لا يحتوي على كود

---

## 1. الهدف

توثيق أي تعارض أو نقص أو تكرار تم اكتشافه أثناء إنشاء وثائق Sprint 0. لا يتم معالجة أي تعارض قبل الحصول على الموافقة.

---

## 2. التعارضات المعمارية والتقنية

| الكود | التعارض | الموضوع | الواقع | الحل المقترح | الأولوية |
|---|---|---|---|---|---|
| **FC-001** | تعدد أسماء المحرك المركزي | `BONDS Intelligence Core` vs `Economic Brain` | وثائق مختلفة تستخدم اسمين | توحيد المصطلح على `Economic Brain` | Medium |
| **FC-002** | تداخل Knowledge Graph و Economic Knowledge Cloud | كلاهما يتحدث عن المعرفة | `architecture/02_KNOWLEDGE_GRAPH.md` و `intelligence/03_ECONOMIC_KNOWLEDGE_CLOUD.md` | Knowledge Graph = البنية؛ Knowledge Cloud = المحتوى | Medium |
| **FC-003** | تداخل Decision Memory و Self-Learning | كلاهما يتعلم من النتائج | `architecture/07_DECISION_MEMORY.md` و `intelligence/08_SELF_LEARNING_PLATFORM.md` | Decision Memory = التخزين؛ Self-Learning = تحديث النماذج | Medium |
| **FC-004** | V3 router مغلّف | `api/v3/index.js` wrapper | يخالف `v3/api/index.js` standard | توجيه مباشر وإزالة wrapper | High |
| **FC-005** | CORS wildcard على APIs المصادقة | `vercel.json` | يخالف Security Standard | تقييد CORS على النطاقات المعروفة | Critical |

---

## 3. تعارضات البيانات

| الكود | التعارض | الواقع | الحل المقترح | الأولوية |
|---|---|---|---|---|
| **FC-006** | تكرار جدول `subscriptions` | إصدار legacy وإصدار V3 | دمج أو ربط بوضوح | Critical |
| **FC-007** | تكرار جدول `scenarios` | `scenarios` vs `project_scenarios` | توحيد أو view موحد | High |
| **FC-008** | تكرار جدول `projects` | `projects` vs `user_projects` | توحيد أو view موحد | High |
| **FC-009** | تكرار جدول `ingredients` / `menu_items` | نسختان من المكونات | توحيد الجدول | High |
| **FC-010** | بيانات المستخدم مكررة في `profiles` و `auth.users` | email, phone, country | استخدام view أو metadata | High |
| **FC-011** | بيانات جغرافية/قطاعية ثابتة في JS | `country-platforms-data.js` | نقل إلى DB | High |

---

## 4. تعارضات الأمان

| الكود | التعارض | الواقع | الحل المقترح | الأولوية |
|---|---|---|---|---|
| **FC-012** | admin reset/force-reset endpoints غير مصادق | `api/password.js` | إضافة authz صارم | Critical |
| **FC-013** | تكرار منطق admin verification | `verifyAdmin` / `verifyAdminStrict` | دمج في middleware واحد | High |
| **FC-014** | RLS غير مفعل على بعض الجداول | — | مراجعة وتمكين RLS | High |
| **FC-015** | Owner email مُدمج في الكود | `iiffund.dev@gmail.com` | استخدام `ADMIN_EMAIL` env | High |

---

## 5. تعارضات الحاسبات والصفحات

| الكود | التعارض | الواقع | الحل المقترح | الأولوية |
|---|---|---|---|---|
| **FC-016** | 226 صفحة حاسبة منفصلة | `calculators/` و `en/calculators/` | تحويل تدريجي إلى Expert Engines + redirects | Critical |
| **FC-017** | تكرار الصفحات العربية/الإنجليزية | Mirror يدوي | أتمتة أو دمج في نظام i18n واحد | High |
| **FC-018** | `factory-cost-*.html` لكل دولة | 22 صفحة منفصلة | دمج في محرك مصنع واحد مع اختيار الدولة | Medium |
| **FC-019** | صفحات `auth.html` و `auth-v2.html` legacy | — | إزالة أو إعادة توجيه | Medium |

---

## 6. تعارضات الاعتماديات والبنية التحتية

| الكود | التعارض | الواقع | الحل المقترح | الأولوية |
|---|---|---|---|---|
| **FC-020** | `stripe` إصدارات مختلفة | root `^15` vs bonds-v2/v3 `^22` | توحيد على `^22` | High |
| **FC-021** | `nodemailer` إصدارات مختلفة | root `^8` vs v3 `^6` | توحيد على إصدار واحد | High |
| **FC-022** | `jest` إصدارات مختلفة | root `^30` vs bonds-v2 `^29` | توحيد على `^30` | Medium |
| **FC-023** | `vercel` tag `latest` | غير قابل للتكرار | تثبيت `^54.14.2` | High |
| **FC-024** | `puppeteer` غير مُعلن | سكربتات تستخدمه | إضافة إلى devDependencies أو حذف السكربتات | Medium |

---

## 7. تعارضات المصطلحات والمحتوى

| الكود | التعارض | الواقع | الحل المقترح | الأولوية |
|---|---|---|---|---|
| **FC-025** | مصطلحات متعددة لنفس المعنى | مدة المشروع/مدة التنفيذ/العمر الاقتصادي | تطبيق `08_GLOBAL_TERMINOLOGY.md` | Medium |
| **FC-026** | قوالب AI عربية فقط | `lib/ai/prompts.js` | بناء قوالب ثنائية اللغة | High |
| **FC-027** | مصادر البيانات غير موثقة في النظام | — | تطبيق `07_DATA_SOURCE_REGISTRY.md` | High |

---

## 8. ملاحظات

- جميع التعارضات السابقة تحتاج إلى موافقة قبل المعالجة.
- بعض التعارضات قد تنتقل إلى `docs/architecture/ARCHITECTURE_CONFLICTS.md` إذا كانت معمارية.
- يجب إدراج حلول هذه التعارضات في خطة Sprint 1.
