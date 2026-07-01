# BONDS Work Breakdown Structure — هيكل تقسيم العمل

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة تنفيذية — لا يحتوي على كود

---

## 1. الرؤية

تقسيم المشروع إلى مستويات واضحة: Program → Portfolio → Epic → Feature → Module → Component → Task → Sub-task، مع تحديد المسؤول والأولوية والاعتماديات والتقدير ومعايير القبول.

---

## 2. Program

| المعرف | الاسم | الوصف | المالك | الأولوية |
|---|---|---|---|---|
| PGM-001 | BONDS Global Intelligence Platform | تحويل BONDS إلى منصة ذكاء اقتصادي عالمية. | Product Owner | Critical |

---

## 3. Portfolios

| المعرف | الاسم | الوصف | المالك | الأولوية |
|---|---|---|---|---|
| PRT-001 | Core Stabilization | تثبيت الأساسات المعمارية والأمان والبيانات. | Lead Architect | Critical |
| PRT-002 | Intelligence Engine | بناء محركات الذكاء والتحليل. | AI Lead | Critical |
| PRT-003 | Unified Experience | بناء واجهات مستخدم موحدة للعميل والإدارة. | UX Lead | High |
| PRT-004 | Enterprise Enablement | دعم سير العمل المؤسسي والامتثال. | Compliance Lead | High |

---

## 4. Epics

| المعرف | Portfolio | الاسم | الوصف | المالك | الأولوية | التبعيات |
|---|---|---|---|---|---|---|
| EP-001 | PRT-001 | Core Infrastructure | إصلاح الأساسات التقنية. | Engineering Lead | Critical | — |
| EP-002 | PRT-001 | Unified Data Layer | بناء طبقة بيانات موحدة. | Data Lead | Critical | EP-001 |
| EP-003 | PRT-002 | Economic Brain | بناء العقل المركزي. | Lead Architect | Critical | EP-002 |
| EP-004 | PRT-002 | Decision Graph | رسم أثر القرارات. | Lead Architect | High | EP-003 |
| EP-005 | PRT-002 | Digital Twin | ملف رقمي دائم للمشاريع. | Lead Architect | High | EP-004 |
| EP-006 | PRT-002 | Knowledge Graph | بناء المعرفة القطاعية. | Content Lead | High | EP-002 |
| EP-007 | PRT-002 | Live Intelligence | جلب البيانات الحية. | Data Lead | High | EP-002 |
| EP-008 | PRT-002 | Confidence Engine | حساب درجة الثقة. | Data Lead | High | EP-003، EP-007 |
| EP-009 | PRT-002 | Evidence Layer | ربط النتائج بالأدلة. | Compliance Lead | High | EP-003 |
| EP-010 | PRT-002 | Simulation Engine | محاكاة السيناريوهات. | Engineering Lead | High | EP-003 |
| EP-011 | PRT-002 | Recommendation Engine | توصيات استثمارية. | AI Lead | High | EP-010 |
| EP-012 | PRT-002 | AI Decision Analyst | تحليل AI ثنائي اللغة. | AI Lead | High | EP-008، EP-009 |
| EP-013 | PRT-002 | Valuation Refactor | تحويل التقييم إلى Expert Engine. | Engineering Lead | High | EP-003 |
| EP-014 | PRT-002 | Feasibility Refactor | تحويل الجدوى إلى Expert Engine. | Engineering Lead | High | EP-003 |
| EP-015 | PRT-002 | Financing Refactor | تحويل التمويل إلى Expert Engine. | Engineering Lead | High | EP-003 |
| EP-016 | PRT-003 | Reports Engine | توليد تقارير تفاعلية. | UX Lead | High | EP-009، EP-012 |
| EP-017 | PRT-003 | Certificate Engine | شهادات ذكية. | Compliance Lead | High | EP-009 |
| EP-018 | PRT-003 | Client Command Center | لوحة عميل موحدة. | UX Lead | High | EP-005 |
| EP-019 | PRT-003 | Admin Command Center | لوحة إدارة موحدة. | UX Lead | High | EP-006 |
| EP-020 | PRT-004 | Global Optimization | تحسين شامل. | Engineering Lead | Medium | جميع Epics |

---

## 5. Features (مثال على Epic EP-001 Core Infrastructure)

| المعرف | Epic | الاسم | الوصف | المالك | الأولوية | التبعيات | التقدير | معايير القبول |
|---|---|---|---|---|---|---|---|---|
| F-001 | EP-001 | Secure Admin Endpoints | إغلاق reset/force-reset endpoints. | Security Lead | Critical | — | 2d | لا يوجد endpoint مفتوح |
| F-002 | EP-001 | Restrict CORS | تقييد CORS على APIs المصادقة. | Security Lead | Critical | — | 1d | CORS restricted |
| F-003 | EP-001 | V3 Router Fix | توجيه `/api/v3/*` إلى `v3/api/index.js`. | Engineering Lead | High | — | 1d | Wrapper removed |
| F-004 | EP-001 | Unified Admin Verification | دمج verifyAdmin/verifyAdminStrict. | Engineering Lead | High | F-001 | 2d | Middleware واحد |
| F-005 | EP-001 | Dependency Unification | توحيد stripe/nodemailer/jest/vercel. | Engineering Lead | High | — | 2d | npm audit clean |
| F-006 | EP-001 | Input Validation | إضافة validation schemas. | Engineering Lead | High | — | 1w | All endpoints validated |
| F-007 | EP-001 | Unified Billing Webhook | دمج legacy + V3 webhooks. | Engineering Lead | High | — | 2d | One webhook handler |
| F-008 | EP-002 | Canonical User Model | توحيد profiles/auth.users. | Data Lead | Critical | — | 1w | Single source of truth |
| F-009 | EP-002 | Canonical Subscription Model | توحيد subscriptions. | Data Lead | Critical | — | 1w | No duplication |
| F-010 | EP-002 | Audit Logs Table | إنشاء audit_logs. | Data Lead | High | — | 1w | Logs all changes |
| F-011 | EP-002 | Override Audit Table | إنشاء data_overrides. | Data Lead | High | — | 1w | Overrides tracked |
| F-012 | EP-002 | Sequence Registry | إنشاء bonds_sequences. | Data Lead | High | — | 1d | Unique IDs |
| F-013 | EP-002 | FK Indexes | إضافة missing indexes. | Engineering Lead | Medium | — | 2d | Query performance improved |
| F-014 | EP-003 | Engine Registry | تسجيل جميع المحركات. | Lead Architect | Critical | EP-002 | 1w | All engines registered |
| F-015 | EP-003 | Event Bus | نشر/اشتراك أحداث. | Lead Architect | Critical | EP-002 | 1w | Events propagated |
| F-016 | EP-003 | Intent Parser | فهم نية المستخدم. | AI Lead | High | EP-014 | 2w | 3+ intents parsed |
| F-017 | EP-003 | Standard Output Schema | توحيد مخرجات المحركات. | Lead Architect | Critical | EP-002 | 1w | All engines comply |
| F-018 | EP-004 | Dependency Graph Model | نموذج العلاقات. | Lead Architect | High | EP-003 | 1w | Model defined |
| F-019 | EP-004 | Propagation Engine | إعادة الحساب عند التغيير. | Engineering Lead | High | F-018 | 1w | Changes propagated |
| F-020 | EP-005 | Twin Snapshot Store | تخزين snapshots. | Engineering Lead | High | EP-004 | 1w | Snapshots stored |
| F-021 | EP-005 | Twin Update Triggers | تحديث تلقائي. | Engineering Lead | High | F-020 | 1w | Auto updates |
| F-022 | EP-006 | Knowledge Graph Schema | بنية المعرفة. | Content Lead | High | EP-002 | 1w | Schema approved |
| F-023 | EP-006 | Knowledge Cloud Pipeline | جلب/مراجعة محتوى. | Content Lead | High | F-022 | 2w | Content approved |
| F-024 | EP-007 | Ingestion Framework | جلب البيانات الحية. | Data Lead | High | EP-002 | 2w | 3+ sources ingested |
| F-025 | EP-007 | Validation Pipeline | التحقق من البيانات. | Data Lead | High | F-024 | 1w | Validation rules applied |
| F-026 | EP-008 | Confidence Rules | قواعد حساب الثقة. | Data Lead | High | EP-003، EP-007 | 1w | Scores produced |
| F-027 | EP-009 | Evidence Bundle Schema | هيكل حزمة الأدلة. | Compliance Lead | High | EP-003 | 1w | Schema approved |
| F-028 | EP-009 | Evidence Linking | ربط المخرجات. | Engineering Lead | High | F-027 | 1w | All outputs linked |
| F-029 | EP-010 | Scenario Manager | إدارة السيناريوهات. | Engineering Lead | High | EP-003 | 1w | Scenarios managed |
| F-030 | EP-010 | Monte Carlo Server | محاكاة Monte Carlo. | Engineering Lead | Medium | F-029 | 2w | Server-side MC |
| F-031 | EP-011 | Recommendation Rules | قواعد التوصية. | AI Lead | High | EP-010 | 1w | Rules defined |
| F-032 | EP-012 | Bilingual Prompts | قوالب AI ثنائية اللغة. | AI Lead | High | EP-003 | 2w | ar/en reports |
| F-033 | EP-013 | Valuation Engine Refactor | ربط بالـ Economic Brain. | Engineering Lead | High | EP-003 | 2w | Integrated |
| F-034 | EP-014 | Feasibility Engine Refactor | ربط بالـ Economic Brain. | Engineering Lead | High | EP-003 | 2w | Integrated |
| F-035 | EP-015 | Financing Engine Refactor | ربط بالـ Economic Brain. | Engineering Lead | High | EP-003 | 2w | Integrated |
| F-036 | EP-016 | Interactive Report Templates | قوالب تفاعلية. | UX Lead | High | EP-009، EP-012 | 2w | Templates render |
| F-037 | EP-017 | Smart Certificate Issuance | شهادات مرتبطة بالأدلة. | Compliance Lead | High | EP-009 | 1w | Certificates issued |
| F-038 | EP-018 | Client Dashboard | لوحة عميل. | UX Lead | High | EP-005 | 2w | Dashboard functional |
| F-039 | EP-019 | Admin Dashboard | لوحة إدارة. | UX Lead | High | EP-006 | 2w | Dashboard functional |
| F-040 | EP-020 | PWA Refresh | تحديث PWA. | Engineering Lead | Low | جميع Epics | 2d | PWA passes audit |

---

## 6. Modules / Components / Tasks (مثال على Feature F-001)

| المعرف | Feature | النوع | الاسم | الوصف | المالك | التقدير | معايير القبول |
|---|---|---|---|---|---|---|---|
| M-001 | F-001 | Module | Admin Auth Module | مصادقة Admin endpoints. | Security Lead | 1d | JWT + admin_roles verified |
| C-001 | M-001 | Component | Password Reset Handler | معالجة reset password. | Security Lead | 1d | Owner-only access |
| T-001 | C-001 | Task | Add auth check | إضافة تحقق من Bearer + role. | Security Lead | 4h | No unauthenticated access |
| ST-001 | T-001 | Sub-task | Update tests | تحديث اختبارات. | Security Lead | 2h | Tests pass |

---

## 7. معايير القبول العامة

- كل Task يجب أن يكون قابلاً للاختبار.
- كل Feature يجب أن يمر على Code Review + Security Review.
- كل Epic يجب أن ينتج نظاماً يعمل (Working System Increment).
- كل Sprint يجب أن ينتهي بـ Demo.

---

## 8. ملاحظات

- هذا الـ WBS يُحدّث بعد كل Sprint.
- التقديرات تقريبية وقابلة للمراجعة.
