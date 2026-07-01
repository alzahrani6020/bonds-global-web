# BONDS Transformation Matrix — مصفوفة التحول

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة تنفيذية — لا يحتوي على كود

---

## 1. الرؤية

تحديد التحول المطلوب لكل جزء من النظام الحالي إلى الوضع المستهدف، مع توضيح الفائدة والمخاطر والتبعيات وSprint المسؤول.

---

## 2. جدول التحول

| # | الوضع الحالي | الوضع المستهدف | الفائدة | المخاطر | التبعيات | Sprint |
|---|---|---|---|---|---|---|
| T-001 | حاسبة مستقلة (226 صفحة) | Expert Engine ضمن رحلة موحدة | تجربة موحدة، صيانة أسهل | فقدان بعض المنطق، مقاومة المستخدمين | Economic Brain، UDL | 13–20 |
| T-002 | إدخال يدوي لكل قيمة | Auto Population من Live Data + Knowledge | سرعة، دقة | جودة البيانات الخارجية | Live Intelligence، Data Fabric | 2، 7 |
| T-003 | بيانات ثابتة في JS | Live Intelligence + DB | تحديث تلقائي، دقة | تكلفة APIs، انقطاع | UDL، Data Fabric | 2، 7 |
| T-004 | تقرير PDF ثابت | Interactive Report قابل للتصدير | تفاعل، تحديث فوري | تعقيد التطوير | Evidence Layer، Reports Engine | 16 |
| T-005 | شهادة ثابتة | Smart Certificate مرتبط بالأدلة | ثقة، تحقق | تعقيد | Certificate Engine، Evidence Layer | 17 |
| T-006 | صفحات Admin منفصلة | Admin Command Center موحد | كفاءة الإدارة | صلاحيات واسعة | Economic Brain، Reports Engine | 19 |
| T-007 | Client pages متفرقة | Client Command Center موحد | تجربة مستخدم متكاملة | تعقيد | Economic Brain، Digital Twin | 18 |
| T-008 | نماذج مصادقة legacy | Auth flow موحد مع RBAC | أمان، UX | تأثير على المستخدمين الحاليين | Unified Auth | 1–2 |
| T-009 | جداول بيانات مكررة | Canonical Data Model | سلامة البيانات | فقدان/تلف أثناء الدمج | Migration Strategy | 1–2 |
| T-010 | Admin verification مكرر | Unified Admin Middleware | صيانة أسهل، أمان | تغيير APIs | Auth | 1 |
| T-011 | Payment webhooks مكررة | Unified Billing Webhook | سلوك متسق | فشل أثناء التبديل | Billing | 1 |
| T-012 | CORS wildcard | Restricted CORS | أمان | حاجة لإعداد نطاقات | Security | 1 |
| T-013 | API routes متفرقة | Single V3 Router | استقرار، صيانة | تغيير توجيه | Vercel Config | 1 |
| T-014 | Hardcoded owner email | env-based ADMIN_EMAIL | مرونة، أمان | — | Config | 1 |
| T-015 | اعتماديات قديمة/متفرقة | Unified Dependencies | builds مستقرة | breaking changes | Package Management | 1 |
| T-016 | Missing input validation | Schema validation everywhere | أمان | أداء | Validation Library | 1–2 |
| T-017 | In-memory rate limits | Centralized Rate Limiter | حماية أفضل | حاجة لـ Redis/Store | Rate Limit Service | 2 |
| T-018 | No audit logs | Comprehensive Audit Trail | تتبع، امتثال | حجم التخزين | DB | 2 |
| T-019 | No data override log | Smart Data Override Audit | شفافية | — | UDL | 2 |
| T-020 | Static confidence score | Dynamic Confidence Engine | ثقة حقيقية | تعقيد الحساب | All Engines | 8 |
| T-021 | Reports without evidence | Evidence-linked Reports | قابلية التدقيق | حجم | Evidence Layer | 16 |
| T-022 | Manual scenario comparison | Simulation Engine | تحليل أعمق | أداء | Valuation/Feasibility/Financing | 10 |
| T-023 | Arabic-only AI prompts | Bilingual AI Prompts | دعم اللغتين | جودة الترجمة | AI Analyst | 12 |
| T-024 | Standalone Knowledge docs | Economic Knowledge Cloud | تحديث بدون code | جودة المحتوى | Knowledge Engine | 6 |
| T-025 | No proactive alerts | Autonomous Intelligence | فرص استباقية | False positives | Live Data，Decision OS | 7+ |
| T-026 | Manual report generation | Report Template Engine | سرعة، تخصيص | تعقيد | Reports Engine | 16 |
| T-027 | Static PWA assets | Updated PWA + Service Worker | تجربة جوال | caching | Assets | 20 |
| T-028 | Manual i18n mirrors | i18n Engine | صيانة أسهل | تعقيد | Content Pipeline | 18–20 |
| T-029 | No decision memory | Decision Memory + Self-Learning | تحسن مستمر | bias | AI，Audit | 7، 8 |
| T-030 | No plugin runtime | Plugin Architecture | قطاعات جديدة بسهولة | عزل البيانات | Economic Brain | 15+ |

---

## 3. ملخص التحولات حسب Sprint

| Sprint | التحولات الرئيسية |
|---|---|
| Sprint 1 | Unify auth/admin/webhooks/CORS/deps/validation |
| Sprint 2 | Canonical Data Model + Audit + Override + Rate limiter |
| Sprint 3 | Economic Brain + Event Bus |
| Sprint 4 | Decision Graph |
| Sprint 5 | Digital Twin |
| Sprint 6 | Knowledge Graph / Knowledge Cloud |
| Sprint 7 | Live Intelligence + Autonomous Intelligence |
| Sprint 8 | Confidence Engine + Self-Learning |
| Sprint 9 | Evidence Layer |
| Sprint 10 | Simulation Engine |
| Sprint 11 | Recommendation Engine |
| Sprint 12 | AI Decision Analyst (bilingual) |
| Sprint 13–15 | Refactor Valuation/Feasibility/Financing |
| Sprint 16 | Interactive Reports Engine |
| Sprint 17 | Smart Certificates |
| Sprint 18 | Client Command Center |
| Sprint 19 | Admin Command Center |
| Sprint 20 | Global Optimization + PWA + i18n + Calculators redirect |

---

## 4. ملاحظات

- كل تحول يجب أن يحافظ على الوظائف الحالية (no regression).
- يجب استخدام Feature Flags لتمكين التحولات تدريجياً.
- يجب توثيق كل تحول في Architecture Decision Records.
