# BONDS Core Stabilization Matrix — مصفوفة التثبيت الأساسي

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **المراجع:** `docs/foundation/FOUNDATION_CONFLICTS.md`، `docs/architecture/ARCHITECTURE_CONFLICTS.md`، `docs/intelligence/INTELLIGENCE_CONFLICTS.md`  
> **النوع:** وثيقة تنفيذية — لا يحتوي على كود

---

## 1. الرؤية

تحويل المشكلات المكتشفة في Sprint 0 والتعارضات المعمارية والاستخباراتية إلى خطة تثبيت واضحة. كل عنصر يحتوي على: المشكلة، الفئة، التأثير، الإجراء، المسؤول، الأولوية، معيار النجاح، والـ Sprint المستهدف.

---

## 2. مصادر المشكلات

| المصدر | العدد | الملف |
|---|---|---|
| Foundation Conflicts | 27 | `docs/foundation/FOUNDATION_CONFLICTS.md` |
| Architecture Conflicts | 7 | `docs/architecture/ARCHITECTURE_CONFLICTS.md` |
| Intelligence Conflicts | 6 | `docs/intelligence/INTELLIGENCE_CONFLICTS.md` |
| System Audit Findings | 18 | `docs/BONDS_SYSTEM_AUDIT.md` |
| **الإجمالي** | **58** | — |

---

## 3. مصفوفة التثبيت

| # | المشكلة | المصدر | الفئة | التأثير | الإجراء | المسؤول | الأولوية | معيار النجاح | Sprint |
|---|---|---|---|---|---|---|---|---|---|
| CS-001 | جداول `profiles` و `auth.users` مكررة | Foundation | Data | تكرار هوية المستخدم | اعتماد Canonical User Model يستخدم `auth.users` كمصدر وحيد | Data Lead | Critical | جدول واحد للمستخدمين | 1–2 |
| CS-002 | جداول `subscriptions` legacy و V3 مكررة | Foundation | Data | بيانات اشتراك متضاربة | دمج `subscriptions` مع V3، migration واضح | Data Lead | Critical | subscriptions واحد | 1–2 |
| CS-003 | جداول `scenarios` و `projects` legacy vs V3 | Foundation | Data | فقدان سيناريوهات | Migration + unification plan | Data Lead | Critical | V3 canonical | 1–2 |
| CS-004 | `menu_items` vs `ingredients` تداخل | Foundation | Data | تكرار مكونات المطاعم | توحيد `ingredients` + `recipes` | Data Lead | High | نموذج موحد | 2 |
| CS-005 | مدخلات/مخرجات المحركات غير متناسقة | Foundation | Architecture | صعوبة التكامل | اعتماد Standard Output Schema | Lead Architect | Critical | جميع المحركات تتبع Schema | 3 |
| CS-006 | 113 حاسبة منفصلة | Foundation | UX | صيانة صعبة | خطة Expert Engine + redirect | Engineering Lead | High | خطة migration معتمدة | 13–20 |
| CS-007 | بعض الحاسبات ليس لها تصنيف قطاعي واضح | Foundation | Domain | ثغرات في التغطية | إكمال Calculator Classification | Product Owner | High | 100% classified | 1 |
| CS-008 | مصطلحات متعددة لنفس المفهوم | Foundation | Terminology | لبس | اعتماد Glossary موحد | Content Lead | High | Glossary معتمد | 1–2 |
| CS-009 | علاقات بين الكيانات غير واضحة | Foundation | Data | أخطاء في الحساب | تحديث ERD/Data Dictionary | Data Lead | High | ERD approved | 1–2 |
| CS-010 | Formulas متكررة/متعارضة | Foundation | Logic | نتائج مختلفة | Formula Catalog + formula registry | Engineering Lead | High | Formula registry | 1–2 |
| CS-011 | مصادر البيانات غير موثقة | Foundation | Data | جودة منخفضة | Data Source Registry | Data Lead | High | Registry approved | 1 |
| CS-012 | Reglas de negocio no centralizadas | Foundation | Logic | تكرار منطق | Business Rules Catalog | Engineering Lead | High | Catalog approved | 1–2 |
| CS-013 | Governance gaps: من يوافق على إضافة حاسبة | Foundation | Governance | فوضى في الإضافات | Calculator Approval Flow | Product Owner | Critical | Flow documented | 1 |
| CS-014 | لا توجد Confidence Scores للبيانات | Foundation | Data | ثقة منخفضة | Confidence Engine plan | Data Lead | High | Plan approved | 2 |
| CS-015 | لا يوجد Audit Trail | Foundation | Compliance | عدم امتثال | Audit logs table + policy | Compliance Lead | Critical | Audit logs designed | 1–2 |
| CS-016 | Smart Data Override غير موثق | Foundation | Data | فقدان تتبع | Override table + audit | Data Lead | High | Designed | 2 |
| CS-017 | فجوات في i18n (blog/sectors غير مترجمة) | Foundation | i18n | تجربة غير متسقة | i18n Engine plan | UX Lead | Medium | Plan approved | 20 |
| CS-018 | Admin reset endpoints مفتوحة | Audit | Security | اختراق محتمل | Secure endpoints + tests | Security Lead | Critical | No open reset endpoints | 1 |
| CS-019 | CORS wildcard على auth APIs | Audit | Security | هجمات محتملة | Restrict CORS | Security Lead | Critical | CORS restricted | 1 |
| CS-020 | Owner email hardcoded | Audit | Security | عدم مرونة | Move to env var | Engineering Lead | High | env-based | 1 |
| CS-021 | Admin middleware مكرر | Audit | Architecture | تكرار منطق | Unified Admin Middleware | Engineering Lead | High | Middleware unified | 1 |
| CS-022 | Payment webhooks مكررة | Audit | Billing | تناقض فواتير | Unified Billing Webhook | Engineering Lead | High | One handler | 1 |
| CS-023 | V3 router wrapper يضيع functions | Audit | Deployment | تجاوز حد Vercel | Remove wrapper | Engineering Lead | High | Direct routing | 1 |
| CS-024 | Dependencies متفرقة/قديمة | Audit | Technical | builds غير مستقرة | Unify + update | Engineering Lead | High | npm audit clean | 1 |
| CS-025 | Missing input validation | Audit | Security | حقن/أخطاء | Add validation schemas | Engineering Lead | High | All endpoints validated | 1–2 |
| CS-026 | In-memory rate limiting | Audit | Security | عدم حماية | Centralized Rate Limiter | Engineering Lead | High | Rate limiter designed | 2 |
| CS-027 | No fallback for AI/orchestrator | Audit | AI | انقطاع | Fallback strategy | AI Lead | High | Plan approved | 1–2 |
| CS-028 | لا يوجد Sequence Registry | Audit | Data | تضارب IDs | Create bonds_sequences | Data Lead | High | Table designed | 2 |
| CS-029 | Deep Knowledge Layer vs Expert Engine overlap | Architecture | Architecture | لبس في المسؤوليات | توضيح: Knowledge = static facts, Expert Engine = dynamic analysis | Lead Architect | High | ADR approved | 3–6 |
| CS-030 | Continuous Feedback vs Self-Learning confusion | Architecture | AI | تداخل | توضيح: Feedback = user signals, Self-Learning = model improvement suggestions | AI Lead | High | ADR approved | 3–8 |
| CS-031 | Recommendation vs AI Analyst overlap | Architecture | AI | تداخل | AI Analyst generates analysis; Recommendation Engine ranks actions | AI Lead | High | ADR approved | 11–12 |
| CS-032 | Plugin Architecture and Data Isolation | Architecture | Architecture | أمان | Plugins access UDL only via sandbox | Lead Architect | High | ADR approved | 15+ |
| CS-033 | V3 API routing under Vercel limits | Architecture | Deployment | حدود functions | Direct `/api/v3/*` routing | Engineering Lead | High | ADR approved | 1 |
| CS-034 | Evidence Layer before Confidence Engine order | Architecture | Sequence | تسلسل غير صحيح | Evidence Layer يبنى بعد Standard Output، Confidence يأتي لاحقاً | Lead Architect | High | Sequence updated | 3, 8 |
| CS-035 | Admin/Client Command Centers vs old pages | Architecture | UX | انتقال | SPA Command Centers + redirect | UX Lead | High | Plan approved | 18–19 |
| CS-036 | Knowledge Cloud vs Knowledge Graph | Intelligence | Data | تداخل | Knowledge Cloud = content pipeline; Knowledge Graph = structured ontology | Content Lead | High | ADR approved | 6 |
| CS-037 | Live Intelligence vs Autonomous Intelligence | Intelligence | AI | تداخل | Live Intelligence = data ingestion; Autonomous = proactive alerts only | AI Lead | High | ADR approved | 7+ |
| CS-038 | Decision Graph vs Simulation Engine | Intelligence | Sequence | تداخل | Simulation uses Decision Graph for propagation | Lead Architect | Medium | Sequence approved | 4, 10 |
| CS-039 | Digital Twin vs Project Snapshot | Intelligence | Data | تداخل | Digital Twin = active model; Snapshot = historical version | Engineering Lead | High | ADR approved | 5 |
| CS-040 | Confidence Score vs Quality Score | Intelligence | Metrics | تداخل | Confidence = per datum/result; Quality Score = aggregate | Data Lead | High | ADR approved | 8 |
| CS-041 | No canonical formula registry | Foundation | Logic | تكرار | Create `bonds_formulas` registry | Engineering Lead | High | Registry approved | 1–2 |
| CS-042 | No data quality score storage | Foundation | Data | عدم قياس | Add data_quality_score columns | Data Lead | Medium | Schema approved | 2 |
| CS-043 | No FK indexes | Foundation | Performance | بطء | Add missing indexes | Engineering Lead | Medium | Migration approved | 1–2 |
| CS-044 | Missing business rules engine | Foundation | Logic | قواعد مبعثرة | Define rules engine | Engineering Lead | High | Design approved | 2–3 |
| CS-045 | No migration rollback strategy | Foundation | Deployment | مخاطر | Rollback runbook | DevOps | Critical | Runbook approved | 1 |
| CS-046 | No conflict resolution process | Foundation | Governance | تكرار | Conflict documentation process | Product Owner | High | Process approved | 1 |
| CS-047 | No feature flag strategy | Foundation | Deployment | مخاطر إطلاق | Feature flags tool + rules | Engineering Lead | High | Strategy approved | 1 |
| CS-048 | No on-call/incident response | Foundation | Operations | تأخر الاستجابة | Incident response runbook | DevOps | High | Runbook approved | 1 |
| CS-049 | No AI validation framework | Foundation | AI | مخرجات خاطئة | AI validation pipeline | AI Lead | High | Pipeline approved | 1–2 |
| CS-050 | No calculation validation framework | Foundation | Quality | نتائج خاطئة | Calculation test harness | Engineering Lead | High | Harness approved | 1–2 |
| CS-051 | No accessibility testing process | Foundation | Quality | a11y issues | a11y test pipeline | UX Lead | High | Pipeline approved | 1 |
| CS-052 | No mobile testing process | Foundation | Quality | UX سيء | Mobile test pipeline | UX Lead | High | Pipeline approved | 1 |
| CS-053 | No visual regression baseline | Foundation | Quality | انحدار بصري | Visual regression plan | UX Lead | Medium | Plan approved | 1 |
| CS-054 | No user feedback loop | Foundation | UX | عدم التحسن | Feedback collection tool | Product Owner | Medium | Tool selected | 1–2 |
| CS-055 | No definition of done | Foundation | Governance | جودة متفاوتة | DoD checklist | Scrum Master | Critical | DoD approved | 1 |
| CS-056 | No architecture review board | Foundation | Governance | قرارات متعارضة | Review board formed | Lead Architect | High | Board defined | 1 |
| CS-057 | No data retention policy | Foundation | Compliance | مخالفة | Retention policy | Compliance Lead | High | Policy approved | 1 |
| CS-058 | No cross-border data plan | Foundation | Compliance | مخالفة | Data residency plan | Compliance Lead | Medium | Plan approved | 1 |

---

## 4. ملخص حسب الفئة

| الفئة | العدد | الأولوية Critical | الأولوية High | الأولوية Medium |
|---|---|---|---|---|
| Data | 15 | 5 | 8 | 2 |
| Security | 6 | 3 | 3 | 0 |
| Architecture | 12 | 2 | 8 | 2 |
| Billing/Payment | 1 | 0 | 1 | 0 |
| Deployment | 5 | 2 | 2 | 1 |
| AI | 6 | 0 | 6 | 0 |
| UX | 4 | 0 | 2 | 2 |
| Governance | 7 | 3 | 4 | 0 |
| Compliance | 2 | 0 | 2 | 0 |

---

## 5. ملخص حسب Sprint

| Sprint | عناصر التثبيت الرئيسية | الأهداف |
|---|---|---|
| Sprint 1 | CS-001 partial, CS-018..CS-025, CS-045..CS-048, CS-055, CS-056, CS-057 | أمان + بنية + عمليات |
| Sprint 2 | CS-001 complete, CS-002, CS-003, CS-008, CS-009, CS-010, CS-014, CS-015, CS-016, CS-026, CS-028, CS-041..CS-044, CS-049, CS-050, CS-051, CS-052 | UDL + validation |
| Sprint 3 | CS-005, CS-029, CS-034 partial | Economic Brain |
| Sprint 4 | CS-034, CS-038 partial | Decision Graph |
| Sprint 5 | CS-039 | Digital Twin |
| Sprint 6 | CS-036 | Knowledge Graph |
| Sprint 7 | CS-037 | Live Intelligence |
| Sprint 8 | CS-040 | Confidence Engine |
| Sprint 9 | CS-015 finalize | Evidence Layer |
| Sprint 10 | CS-038 finalize | Simulation Engine |
| Sprint 11–12 | CS-031, CS-037 finalize | Recommendation + AI Analyst |
| Sprint 13–15 | CS-006 partial | Expert Engines Refactor |
| Sprint 16–17 | — | Reports + Certificates |
| Sprint 18–19 | CS-035 | Command Centers |
| Sprint 20 | CS-006 complete, CS-017 | Global Optimization + i18n |

---

## 6. معايير إغلاق التثبيت

- جميع عناصر Critical مغلقة أو مخططة بـ Sprint واضح.
- Readiness Score ≥ 95%.
- لا يوجد Critical items بدون plan.
- جميع التعارضات Architecture/Intelligence تم حلها بـ ADRs.

---

## 7. ملاحظات

- هذه المصفوفة هي المرجع الرئيسي لـ Sprint 0.5 (Stabilization).
- يجب تحديثها بعد إغلاق كل عنصر.
