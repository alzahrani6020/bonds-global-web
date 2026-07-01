# BONDS Project Inventory — جرد المشروع

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **المراجع:** `docs/API_INVENTORY.md`، `docs/ROUTES_MAP.md`، `docs/DATABASE_ERD.md`، `docs/AUTHORIZATION_MAP.md`  
> **النوع:** وثيقة تأسيس — لا يحتوي على كود

---

## 1. ملخص المخزون

| الطبقة | العدد | الحالة |
|---|---|---|
| صفحات HTML | 399 | مستخدمة جزئياً؛ تكرار بين العربية والإنجليزية. |
| ملفات JavaScript | 358 | مستخدمة؛ تحتاج توحيد. |
| ملفات CSS | 29 | مستخدمة؛ تحتاج توحيد. |
| APIs (root + v3) | 40+ | مستخدمة؛ تحتاج أمان وتوجيه. |
| جداول قاعدة البيانات | 62+ | مستخدمة؛ يوجد تكرار وconflict. |
| أصول الصور | 35 | مستخدمة. |
| أيقونات PWA | 2 | مستخدمة. |
| تقارير HTML | 2 | مستخدمة. |
| حاسبات (عربي) | 113 | مستخدمة؛ تحتاج تحويل إلى Expert Engines. |
| حاسبات (إنجليزي) | 113 | mirror للعربية. |

---

## 2. الصفحات (Pages)

### 2.1 الصفحات التسويقية — العربية

| الملف | المسار | الحالة | يُستخدم؟ | مكرر؟ | يحتاج Refactor؟ | الأولوية |
|---|---|---|---|---|---|---|
| index.html | `/` | نشط | نعم | لا | نعم (Intent-First) | High |
| about.html | `/about.html` | نشط | نعم | لا | نعم | Medium |
| services.html | `/services.html` | نشط | نعم | لا | نعم | Medium |
| contact.html | `/contact.html` | نشط | نعم | لا | نعم | Medium |
| pricing.html | `/pricing.html` | نشط | نعم | لا | نعم | High |
| faq.html | `/faq.html` | نشط | نعم | لا | منخفض | Low |
| methodology.html | `/methodology.html` | نشط | نعم | لا | منخفض | Low |
| terms.html | `/terms.html` | نشط | نعم | لا | لا | Low |
| privacy.html | `/privacy.html` | نشط | نعم | لا | لا | Low |
| calculator.html | `/calculator.html` | نشط | نعم | لا | نعم | High |
| calculator-v2.html | `/calculator-v2.html` | نشط | نعم | لا | نعم | High |
| pitch.html | `/pitch.html` | نشط | نعم | لا | نعم | Medium |
| pitch-print.html | `/pitch-print.html` | نشط | نعم | لا | نعم | Medium |
| auth.html | `/auth.html` | legacy | نعم | لا | نعم | Medium |
| auth-v2.html | `/auth-v2.html` | legacy | نعم | لا | نعم | Medium |
| verify.html | `/verify.html` | utility | نعم | لا | نعم | Medium |
| v.html | `/v.html` | utility | نعم | لا | نعم | Medium |
| proof.html | `/proof.html` | utility | نعم | لا | نعم | Low |
| test.html | `/test.html` | dev | محدود | لا | نعم | Low |

### 2.2 الصفحات التسويقية — الإنجليزية (Mirror)

| المسار | الحالة | يُستخدم؟ | مكرر؟ | يحتاج Refactor؟ | الأولوية |
|---|---|---|---|---|---|
| `/en/index.html` | نشط | نعم | نعم (mirror) | نعم | High |
| `/en/about.html` | نشط | نعم | نعم | نعم | Medium |
| `/en/services.html` | نشط | نعم | نعم | نعم | Medium |
| `/en/contact.html` | نشط | نعم | نعم | نعم | Medium |
| `/en/pricing.html` | نشط | نعم | نعم | نعم | High |
| `/en/faq.html` | نشط | نعم | نعم | منخفض | Low |
| `/en/methodology.html` | نشط | نعم | نعم | منخفض | Low |
| `/en/terms.html` | نشط | نعم | نعم | لا | Low |
| `/en/privacy.html` | نشط | نعم | نعم | لا | Low |
| `/en/calculator.html` | نشط | نعم | نعم | نعم | High |
| `/en/pitch.html` | نشط | نعم | نعم | نعم | Medium |
| `/en/pitch-print.html` | نشط | نعم | نعم | نعم | Medium |

### 2.3 المدونة (Blog)

| الملف | المسار | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| blog/index.html | `/blog/` | نشط | نعم | لا | لا | Low |
| blog/break-even-explained.html | `/blog/...` | نشط | نعم | لا | لا | Low |
| blog/cash-flow-mistakes.html | `/blog/...` | نشط | نعم | لا | لا | Low |
| blog/financial-kpis.html | `/blog/...` | نشط | نعم | لا | لا | Low |
| blog/pricing-strategy.html | `/blog/...` | نشط | نعم | لا | لا | Low |
| blog/tax-zakat-sme.html | `/blog/...` | نشط | نعم | لا | لا | Low |
| blog/en/*.html | `/blog/en/` | نشط | نعم | نعم | لا | Low |

### 2.4 أدلة القطاعات (Sector Guides)

| الملف | المسار | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| sectors/manufacturing.html | `/sectors/manufacturing.html` | نشط | نعم | لا | نعم | Medium |
| sectors/manufacturing-*.html | `/sectors/manufacturing-*.html` | نشط | نعم | لا | نعم | Medium |
| en/sectors/manufacturing*.html | `/en/sectors/...` | نشط | نعم | نعم | نعم | Medium |

### 2.5 الحاسبات (Calculators)

| الموقع | العدد | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| `calculators/*.html` | 37 | نشطة | نعم | جزئي | نعم | High |
| `calculators/investment-center/*.html` | 76 | نشطة | نعم | لا | نعم | High |
| `calculators/auth/*.html` | 13 | نشطة | نعم | نعم (en) | نعم | High |
| `en/calculators/*.html` | 37 | mirror | نعم | نعم | نعم | High |
| `en/calculators/investment-center/*.html` | 76 | mirror | نعم | نعم | نعم | High |
| `en/calculators/auth/*.html` | 13 | mirror | نعم | نعم | نعم | High |

### 2.6 صفحات الإدارة (Admin Pages)

| الملف | المسار | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| admin/dashboard.html | `/admin/dashboard.html` | نشط | نعم | لا | نعم | High |
| admin/analytics.html | `/admin/analytics.html` | نشط | نعم | لا | نعم | Medium |
| admin/users.html | `/admin/users.html` | نشط | نعم | لا | نعم | Medium |
| admin/subscriptions.html | `/admin/subscriptions.html` | نشط | نعم | لا | نعم | Medium |
| admin/messages.html | `/admin/messages.html` | نشط | نعم | لا | نعم | Medium |
| admin/roles.html | `/admin/roles.html` | نشط | نعم | لا | نعم | Medium |
| admin/exceptions.html | `/admin/exceptions.html` | نشط | نعم | لا | نعم | Medium |
| admin/bank-transfers.html | `/admin/bank-transfers.html` | نشط | نعم | لا | نعم | Medium |
| admin/settings.html | `/admin/settings.html` | نشط | نعم | لا | نعم | Medium |
| admin/reset.html | `/admin/reset.html` | نشط | نعم | لا | نعم (أمن) | Critical |
| admin/force-reset.html | `/admin/force-reset.html` | نشط | نعم | لا | نعم (أمن) | Critical |
| admin/ai-business-advisor/* | `/admin/ai-business-advisor/` | نشط | نعم | لا | نعم | Medium |
| admin/city-intelligence/* | `/admin/city-intelligence/` | نشط | نعم | لا | نعم | Medium |
| admin/financial-advisory/* | `/admin/financial-advisory/` | نشط | نعم | لا | نعم | Medium |
| admin/distressed-recovery/* | `/admin/distressed-recovery/` | نشط | نعم | لا | نعم | Medium |
| admin/data-quality-center/* | `/admin/data-quality-center/` | نشط | نعم | لا | نعم | Medium |
| admin/executive-dashboard/* | `/admin/executive-dashboard/` | نشط | نعم | لا | نعم | Medium |
| admin/global-search/* | `/admin/global-search/` | نشط | نعم | لا | نعم | Medium |

### 2.7 صفحات V3

| الملف | المسار | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| v3/index.html | `/v3/index.html` | نشط | نعم | لا | نعم | High |
| v3/city-intelligence.html | `/v3/city-intelligence.html` | نشط | نعم | لا | نعم | High |
| v3/city-comparison.html | `/v3/city-comparison.html` | نشط | نعم | لا | نعم | High |
| v3/investment-map.html | `/v3/investment-map.html` | نشط | نعم | لا | نعم | High |
| v3/project-readiness.html | `/v3/project-readiness.html` | نشط | نعم | لا | نعم | High |
| v3/opportunity-bank.html | `/v3/opportunity-bank.html` | نشط | نعم | لا | نعم | High |
| v3/scenarios.html | `/v3/scenarios.html` | نشط | نعم | لا | نعم | High |
| v3/alerts.html | `/v3/alerts.html` | نشط | نعم | لا | نعم | High |
| v3/admin/index.html | `/v3/admin/*` | نشط | نعم | لا | نعم | High |

### 2.8 صفحات Pro

| الملف | المسار | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| pro/index.html | `/pro` | نشط | نعم | لا | نعم | Medium |
| pro/login.html | `/pro/login.html` | نشط | نعم | لا | نعم | Medium |
| pro/report.html | `/pro/report.html` | نشط | نعم | لا | نعم | Medium |

### 2.9 صفحات العميل (Client Pages)

| الملف | المسار | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| client/index.html | `/client/index.html` | نشط | نعم | لا | نعم | High |
| client/login.html | `/client/login.html` | نشط | نعم | لا | نعم | High |
| client/project.html | `/client/project.html` | نشط | نعم |لا | نعم | High |
| client/report.html | `/client/report.html` | نشط | نعم | لا | نعم | High |
| client/reports.html | `/client/reports.html` | نشط | نعم | لا | نعم | High |

### 2.10 صفحات عامة أخرى

| الملف | المسار | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| advisors.html | `/advisors.html` | نشط | نعم | لا | نعم | Medium |
| advisor/index.html | `/advisor/` | نشط | نعم | لا | نعم | Medium |
| funding-sources.html | `/funding-sources.html` | نشط | نعم | لا | نعم | Medium |
| funding-readiness.html | `/funding-readiness.html` | نشط | نعم | لا | نعم | Medium |
| for-banks.html | `/for-banks.html` | نشط | نعم | لا | نعم | Medium |
| project-rescue.html | `/project-rescue.html` | نشط | نعم | لا | نعم | Medium |
| nps.html | `/nps.html` | utility | محدود | لا | نعم | Low |
| modon_home.html | `/modon_home.html` | utility | محدود | لا | نعم | Low |
| modon_eservices.html | `/modon_eservices.html` | utility | محدود | لا | نعم | Low |
| دراسة-جدوى-إحياء-الأصول-الملقحة.html | `/...` | landing | نعم | لا | نعم | Medium |

---

## 3. المكونات (Components)

| المكون | الموقع | الحالة | يُستخدم؟ | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|---|
| Universal Dropdown | `components/universal-dropdown.js` | نشط | نعم | لا | لا | High |
| Universal Dropdown CSS | `components/universal-dropdown.css` | نشط | نعم | لا | لا | High |
| Universal Dropdown Init | `components/universal-dropdown-init.js` | نشط | نعم | لا | لا | High |
| Shared Export Footer | `calculators/shared-export.js` | نشط | نعم | لا | نعم | Medium |
| Shared Utils | `calculators/shared-utils.js` | نشط | نعم | لا | نعم | High |
| Valuation UI | `valuation/valuation-ui.js` | نشط | نعم | لا | نعم | High |
| Admin Embed | `admin/admin-embed.js` | نشط | نعم | لا | نعم | Medium |
| Site Layout | `site-layout.js` | نشط | نعم | لا | نعم | Medium |
| Header-Footer CSS | `header-footer.css` | نشط | نعم | لا | لا | Medium |

---

## 4. Layouts

| Layout | الموقع | الحالة | الوصف |
|---|---|---|---|
| site-layout.js | root | نشط | حقن header/footer ديناميكي. |
| header-footer.css | root | نشط | تنسيق header/footer ثابت. |
| auth-shared.css | `calculators/auth/auth-shared.css` | نشط | تنسيق صفحات المصادقة. |
| standalone | — | متنوع | صفحات مخصصة بدون تخطيط مشترك. |

---

## 5. Hooks / Contexts / Guards

| الاسم | الموقع | الحالة | الوظيفة | الأولوية |
|---|---|---|---|---|
| auth-guard.js | root | نشط | حالة تسجيل الدخول في الواجهة. | High |
| usage-guard.js | root | نشط | عرض حدود الاستخدام. | High |
| admin-auth-v2.js | root | نشط | حماية صفحات الإدارة. | Critical |
| bonds-auth-2026.js | root | نشط | مصادقة وصلاحيات. | Critical |
| admin-accessibility.js | admin/ | نشط | دعم accessibility في الإدارة. | Medium |

---

## 6. Services

| Service | الموقع | الحالة | الوظيفة | الأولوية |
|---|---|---|---|---|
| Supabase Client | `supabase-client.js` | نشط | اتصال Supabase. | Critical |
| Email Helper | `lib/api/email.js` | نشط | إرسال البريد. | High |
| Rate Limiter | `lib/api/rate-limit.js` | نشط | حدود الاستخدام (in-memory). | High |
| Orchestrator | `lib/ai/orchestrator.js` | نشط | توجيه OpenAI. | High |
| Valuation Analyze Handler | `lib/ai/valuation-analyze-handler.js` | نشط | تحليل التقييم. | High |
| Certificate Handler | `lib/ai/valuation-certificate-handler.js` | نشط | إصدار/تحقق الشهادات. | High |

---

## 7. APIs

| المجموعة | العدد | الحالة | Refactor | الأولوية |
|---|---|---|---|---|
| Site APIs (`/api/contact`, `/api/track`, `/api/env`, `/api/pro`) | 4 | نشطة | نعم | High |
| Auth / Billing APIs (`/api/create-checkout`, `/api/billing`, `/api/webhook`, `/api/bank-transfer`, `/api/password`, `/api/usage`, `/api/funding-sources`) | 7 | نشطة | نعم | Critical |
| Admin Legacy API (`/api/admin`) | 1 | نشطة | نعم | Critical |
| V3 APIs (`/api/v3/*`) | 10+ | نشطة | نعم | Critical |

تفاصيل كل endpoint متاحة في `docs/API_INVENTORY.md`.

---

## 8. قاعدة البيانات (Database)

### 8.1 الجداول الرئيسية (62+ جدول)

| الجدول | الوصف | الحالة | مكرر؟ | Refactor | الأولوية |
|---|---|---|---|---|---|
| profiles | بيانات المستخدمين | نشط | نعم (vs auth.users) | نعم | Critical |
| subscriptions | الاشتراكات | نشط | نعم (إصدارات متعددة) | نعم | Critical |
| moyasar_invoices | فواتير Moyasar | نشط | لا | لا | Medium |
| bank_transfer_requests | طلبات التحويل البنكي | نشط | لا | لا | Medium |
| webhook_events | أحداث Webhook | نشط | نعم (legacy vs V3) | نعم | High |
| admin_roles | أدوار الإدارة | نشط | لا | لا | High |
| site_settings | إعدادات الموقع | نشط | لا | لا | Medium |
| usage_exceptions | استثناءات الاستخدام | نشط | لا | لا | Medium |
| contact_messages | رسائل التواصل | نشط | لا | لا | Medium |
| usage_logs | سجلات الاستخدام | نشط | لا | لا | Medium |
| page_views | مشاهدات الصفحات | نشط | لا | لا | Low |
| page_sessions | جلسات الصفحات | نشط | لا | لا | Low |
| scenarios | سيناريوهات | نشط | نعم (vs project_scenarios) | نعم | High |
| projects | مشاريع | نشط | نعم (vs user_projects) | نعم | High |
| ingredients | مكونات | نشط | نعم (نسختان) | نعم | High |
| recipes | وصفات | نشط | لا | لا | Medium |
| economic_sectors | القطاعات | نشط | لا | لا | High |
| economic_sub_sectors | الأنشطة الفرعية | نشط | لا | لا | High |
| economic_activities | الأنشطة | نشط | لا | لا | High |
| project_models | نماذج المشاريع | نشط | لا | لا | High |
| project_scenarios | سيناريوهات V3 | نشط | نعم (vs scenarios) | نعم | High |
| user_projects | مشاريع V3 | نشط | نعم (vs projects) | نعم | High |
| cities | المدن | نشط | لا | لا | High |
| city_indicators | مؤشرات المدن | نشط | لا | لا | High |
| city_market_data | بيانات السوق | نشط | لا | لا | High |
| normalized_metrics | المقاييس الموحدة | نشط | لا | لا | High |
| data_source_runs | تشغيل مصادر البيانات | نشط | لا | لا | High |
| ml_models | نماذج ML | نشط | لا | لا | Medium |
| reports | تقارير V3 | نشط | لا | لا | High |
| asset_valuations | ترويسة التقييم | نشط | لا | لا | High |
| valuation_ai_reports | تقارير AI للتقييم | نشط | لا | لا | High |
| valuation_certificates | شهادات التقييم | نشط | لا | لا | High |
| recovery_asset_valuations | تقييمات الأصول المتعثرة | نشط | لا | لا | Medium |

---

## 9. Views / Stored Procedures

| النوع | العدد | الحالة | ملاحظات |
|---|---|---|---|
| Views | 0 موثق | — | يُنصح بإنشاء views لقراءة auth.users + profiles. |
| Stored Procedures | 0 موثق | — | بعض الدوال في SQL migrations؛ تحتاج توثيق. |
| Functions (PostgreSQL) | 1+ | — | `generate_bonds_certificate_number` وغيرها. |

---

## 10. الملفات حسب النوع

| النوع | العدد | الملاحظات |
|---|---|---|
| HTML | 399 | تكرار عربي/إنجليزي. |
| JavaScript | 358 | توزيع بين root/bonds-v2/v3. |
| CSS | 29 | توحيد مطلوب. |
| Markdown docs | 60+ | توثيق كثير؛ يحتاج فهرسة. |
| Python scripts | 30+ | أدوات ومهام صيانة. |
| SQL migrations | 50+ | توحيد مطلوب. |

---

## 11. الصور والأيقونات والأصول

| النوع | العدد | الحالة |
|---|---|---|
| صور الشعار | ~10 | مستخدمة. |
| صور generic | ~20 | مستخدمة. |
| study-images | متنوع | مستخدمة. |
| أيقونات PWA | 2 (192/512) | مستخدمة. |

---

## 12. التقارير والشهادات

| النوع | الموقع | الحالة | الأولوية |
|---|---|---|---|
| Executive Valuation Report | `valuation/` + AI | نشط | High |
| BDVC Certificate | `lib/ai/valuation-certificate-handler.js` | نشط | High |
| Calculator Reports | `calculators/shared-export.js` | نشطة | Medium |
| V3 Reports | `reports/` | نشطة | Medium |
| Pro Report | `pro/report.html` | نشطة | Medium |

---

## 13. وحدات الذكاء الاصطناعي (AI Modules)

| الوحدة | الموقع | الحالة | الأولوية |
|---|---|---|---|
| Orchestrator | `lib/ai/orchestrator.js` | نشط | High |
| Prompts | `lib/ai/prompts.js` | نشط | High |
| Valuation Analyze Handler | `lib/ai/valuation-analyze-handler.js` | نشط | High |
| Certificate Handler | `lib/ai/valuation-certificate-handler.js` | نشط | High |
| V3 AI Chat | `v3/api/ai.js` | نشط | High |
| AI Business Advisor | `admin/ai-business-advisor/` | نشط | Medium |

---

## 14. المحركات الخبيرة (Expert Engines)

| المحرك | الحالة | الموقع | الأولوية |
|---|---|---|---|
| Valuation Engine | جزئي | `valuation/`, `lib/ai/` | High |
| Feasibility Engine | جزئي | `calculators/feasibility.html`, V3 | High |
| Risk Engine | جزئي | `calculators/creditworthiness.html` | High |
| Cashflow Engine | جزئي | `calculators/cash-flow.html` | High |
| Financing Engine | جزئي | `calculators/loan.html` | High |
| Market Intelligence | جزئي | V3 data engine | High |
| AI Analyst | جزئي | `lib/ai/` | High |
| Certificate Engine | جزئي | `lib/ai/valuation-certificate-handler.js` | High |
| Knowledge Engine | مخطط | `docs/intelligence/` | High |
| Economic Brain | مخطط | — | Critical |
| Decision Graph | مخطط | — | High |
| Digital Twin | مخطط | — | High |

---

## 15. لوحات التحكم (Dashboards)

| Dashboard | الموقع | الحالة | الأولوية |
|---|---|---|---|
| Admin Dashboard | `admin/dashboard.html` | نشط | High |
| V3 Admin | `v3/admin/index.html` | نشط | High |
| Executive Dashboard | `admin/executive-dashboard/` | نشط | Medium |
| Client Dashboard | `client/index.html` | نشط | High |
| Calculator Dashboard | `calculators/dashboard.html` | نشط | Medium |
| Pro Dashboard | `pro/index.html` | نشط | Medium |

---

## 16. الملاحظات والتوصيات

- **أولوية قصوى:** معالجة التكرار في الجداول والصفحات والـ APIs غير الآمنة.
- **يجب توحيد المصطلحات** قبل Sprint 1.
- **يجب إنشاء Global Object Registry** لكل كيان.
- **226 حاسبة** (عربي + إنجليزي) تحتاج خطة تحويل تدريجي.
