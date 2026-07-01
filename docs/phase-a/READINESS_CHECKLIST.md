# BONDS Readiness Checklist — قائمة تحقق الجاهزية

> **الإصدار:** 1.0-draft  
> **المرجع الأعلى:** `docs/BONDS_CONSTITUTION.md`  
> **النوع:** وثيقة تنفيذية — لا يحتوي على كود

---

## تعليمات

- كل بند يجب أن يُ评估 بـ **Pass / Fail / N/A**.
- لا يبدأ Sprint 1 حتى تحقق جميع العناصر الحرجة (Critical).
- الهدف: **> 300 بند**.

---

## Architecture — 20

- [ ] Economic Brain معرف كمحرك مركزي.
- [ ] Unified Data Layer معرف وموثق.
- [ ] Decision Graph معرف كمفهوم وتصميم.
- [ ] Digital Twin معرف كمفهوم وتصميم.
- [ ] Knowledge Graph vs Knowledge Cloud تم توضيح الحدود بينهما.
- [ ] Expert Engine Pattern معتمد لكل محرك.
- [ ] V3 router wrapper يُزال ويُوجه مباشرة إلى `v3/api/index.js`.
- [ ] Event Bus معرف للتواصل بين المحركات.
- [ ] Standard Output Schema معتمد.
- [ ] لا يوجد محرك معزول عن Economic Brain.
- [ ] Plugin Architecture معرفة دون عزل للبيانات.
- [ ] Intent-First UX معرف في التصميم.
- [ ] لا توجد صفحات حاسبات منفصلة في التصميم المستهدف.
- [ ] Architecture Conflicts موثقة بأولويات.
- [ ] Architecture Decision Records مكتملة.
- [ ] Dependency Graph بين المحركات معتمد.
- [ ] Implementation Sequence معتمد.
- [ ] Work Breakdown Structure معتمد.
- [ ] Transformation Matrix معتمد.
- [ ] Stabilization Matrix معتمد.

## Data — 25

- [ ] Canonical Data Model معتمد.
- [ ] جميع الجداول المكررة لها خطة توحيد.
- [ ] `profiles` vs `auth.users` تم حله.
- [ ] `subscriptions` legacy vs V3 تم حله.
- [ ] `scenarios` legacy vs V3 تم حله.
- [ ] `projects` legacy vs V3 تم حله.
- [ ] `ingredients` / `menu_items` تم توحيدهما.
- [ ] Smart Data Override معرف مع Audit.
- [ ] Data Lineage معرف.
- [ ] Data Quality Rules معرفة.
- [ ] Confidence Score A-D معرف.
- [ ] Outlier Detection معرف.
- [ ] Duplicate Data Handling معرف.
- [ ] Data Source Registry معتمد.
- [ ] Global Data Catalog معرف.
- [ ] Enterprise Data Fabric معرف.
- [ ] Live Data Ingestion Framework معرف.
- [ ] Live Data Validation Pipeline معرف.
- [ ] Fallback Strategy لكل مصدر حي معرف.
- [ ] Hardcoded JS data migration plan معتمد.
- [ ] Data Dictionary معتمد.
- [ ] كل حقل له مصدر ووحدة ووصف.
- [ ] Metadata management معرف.
- [ ] Data expiry/validity معرفة.
- [ ] Historical data archiving معرف.

## AI — 20

- [ ] AI Analyst JSON Schema معتمد.
- [ ] Quality Gates معرفة لكل مخرج AI.
- [ ] Explainable AI معرف.
- [ ] Confidence thresholds مدمجة في AI.
- [ ] Bilingual AI Prompts (ar/en) معتمدة.
- [ ] AI output مرتبط بالأدلة.
- [ ] AI guardrails مشفرة.
- [ ] Human-in-the-loop للقرارات الحرجة.
- [ ] AI model versioning معرف.
- [ ] Self-Learning platform معرفة دون تغيير تلقائي غير موثق.
- [ ] Autonomous Intelligence معرفة كتنبيهات فقط.
- [ ] No autonomous final decisions.
- [ ] AI prompts review workflow معرف.
- [ ] AI cost monitoring معرف.
- [ ] AI hallucination mitigation plan معتمد.
- [ ] AI response validation automated.
- [ ] AI fallback for API failures.
- [ ] Arabic number/RTL formatting in AI output.
- [ ] English LTR formatting in AI output.
- [ ] AI audit logs defined.

## UX — 15

- [ ] Intent-first journey designed.
- [ ] Unified dashboard wireframes approved.
- [ ] Multi-step wizard designed.
- [ ] Client Command Center UX approved.
- [ ] Admin Command Center UX approved.
- [ ] Proactive notifications UX defined.
- [ ] Empty states designed.
- [ ] Loading states designed.
- [ ] Error states designed.
- [ ] Success states designed.
- [ ] Mobile-first responsive verified.
- [ ] Touch targets ≥ 44px.
- [ ] RTL/LTR switching verified.
- [ ] Accessibility labels defined.
- [ ] User feedback loops defined.

## UI — 15

- [ ] Design tokens documented.
- [ ] Color palette enforced.
- [ ] Typography system enforced.
- [ ] Button variants defined.
- [ ] Card variants defined.
- [ ] Dialog/modal variants defined.
- [ ] Form input variants defined.
- [ ] Table variants defined.
- [ ] Chart styling unified.
- [ ] Dark theme default verified.
- [ ] Light theme coverage plan approved.
- [ ] Icon set approved.
- [ ] Spacing system (8px grid) enforced.
- [ ] No custom inline styles in new code.
- [ ] CSS consolidation plan approved.

## Performance — 15

- [ ] Performance budgets defined.
- [ ] API p95 < 2s target set.
- [ ] Lighthouse score target ≥ 70.
- [ ] Caching strategy defined.
- [ ] CDN usage defined.
- [ ] Lazy loading strategy defined.
- [ ] Image optimization defined.
- [ ] Font loading strategy defined.
- [ ] Bundle size limits defined.
- [ ] DB query optimization plan.
- [ ] Monte Carlo server-side plan.
- [ ] HTTP cache headers defined.
- [ ] Static asset cache busting defined.
- [ ] Background job strategy for heavy tasks.
- [ ] Real-user monitoring (RUM) plan.

## Security — 25

- [ ] Admin reset endpoints secured.
- [ ] CORS restricted on auth endpoints.
- [ ] Owner email moved to env var.
- [ ] No API keys in frontend.
- [ ] No secrets in repository.
- [ ] RLS enabled on all sensitive tables.
- [ ] RLS policies reviewed.
- [ ] Input validation on all APIs.
- [ ] Output encoding verified.
- [ ] Rate limiting centralized.
- [ ] Admin roles matrix approved.
- [ ] Feature-gate permissions approved.
- [ ] JWT validation unified.
- [ ] Webhook signature verification unified.
- [ ] Payment webhooks merged.
- [ ] 2FA plan for admin approved.
- [ ] SSO/SAML future plan documented.
- [ ] Penetration test plan.
- [ ] Dependency audit clean.
- [ ] Deprecated packages plan.
- [ ] Security runbook created.
- [ ] Incident response plan.
- [ ] Data encryption at rest verified.
- [ ] Data encryption in transit verified.
- [ ] Secret rotation plan.

## Database — 20

- [ ] All migrations in `supabase/migrations/`.
- [ ] V3 migrations merged.
- [ ] Migration ordering verified.
- [ ] FK indexes added.
- [ ] Comments on all tables.
- [ ] Comments on all columns.
- [ ] Audit logs table created.
- [ ] Override audit table created.
- [ ] Sequence registry created.
- [ ] Canonical user view created.
- [ ] Backup strategy tested.
- [ ] Restore strategy tested.
- [ ] Staging mirror exists.
- [ ] Data migration scripts ready.
- [ ] Rollback scripts ready.
- [ ] Data quality score stored.
- [ ] Data source runs logged.
- [ ] ML models table ready.
- [ ] Reports table ready.
- [ ] Certificate table ready.

## API — 20

- [ ] V3 router canonical path.
- [ ] API Inventory updated.
- [ ] Uniform JSON envelope defined.
- [ ] Error response shape defined.
- [ ] Auth middleware unified.
- [ ] Admin middleware unified.
- [ ] Rate limiting middleware applied.
- [ ] Validation schemas for all endpoints.
- [ ] CORS policy documented.
- [ ] Public/Auth/Admin endpoints classified.
- [ ] API versioning strategy.
- [ ] OpenAPI/Postman collection planned.
- [ ] Webhook handlers unified.
- [ ] Cron endpoints secured.
- [ ] Vercel function limit respected.
- [ ] Circuit breaker strategy.
- [ ] API fallback strategy.
- [ ] API cost monitoring.
- [ ] API deprecation policy.
- [ ] API change log.

## Reports — 15

- [ ] Report Template System defined.
- [ ] Interactive report design approved.
- [ ] PDF export path defined.
- [ ] Excel export path defined.
- [ ] DOCX export path defined.
- [ ] Evidence Summary in every report.
- [ ] Audience-specific templates defined.
- [ ] Arabic/English report templates.
- [ ] Report footer unified.
- [ ] Report header unified.
- [ ] Charts in reports styled.
- [ ] Report versioning defined.
- [ ] Report delivery methods (email/download).
- [ ] Report access control.
- [ ] Report audit log.

## Certificates — 15

- [ ] BDVC number format approved.
- [ ] Certificate issuance flow defined.
- [ ] Certificate evidence binding defined.
- [ ] QR code generation defined.
- [ ] Verify endpoint enhanced.
- [ ] Certificate expiry logic defined.
- [ ] Certificate revocation plan.
- [ ] Certificate template approved.
- [ ] Certificate digital signature/HMAC plan.
- [ ] Public verify page designed.
- [ ] Certificate access control.
- [ ] Certificate audit log.
- [ ] Multi-certificate support (JDV, FDV, etc.).
- [ ] Certificate quality gates defined.
- [ ] Certificate translation plan.

## Calculators — 20

- [ ] All 113 Arabic calculators classified.
- [ ] English mirrors mapped.
- [ ] Expert Engine migration plan per calculator.
- [ ] Calculation logic extraction plan.
- [ ] Country-variant calculators merge plan.
- [ ] Auth calculator pages migration plan.
- [ ] Investment-center calculators mapped to sectors.
- [ ] Formula Catalog applied.
- [ ] Evidence Bundle integration plan.
- [ ] Confidence Score integration plan.
- [ ] AI integration plan.
- [ ] Scenario comparison integration plan.
- [ ] Redirect strategy for old URLs.
- [ ] Calculator deprecation policy.
- [ ] User onboarding for new flow.
- [ ] Calculator usage analytics.
- [ ] A/B test plan for new vs old.
- [ ] Calculator accessibility audit.
- [ ] Calculator mobile responsiveness plan.
- [ ] Calculator export/report plan.

## Knowledge — 15

- [ ] Knowledge Graph schema approved.
- [ ] Economic Knowledge Cloud pipeline approved.
- [ ] Sector taxonomy approved.
- [ ] Activity taxonomy approved.
- [ ] City taxonomy approved.
- [ ] Best practices catalog started.
- [ ] Regulations catalog started.
- [ ] Hidden costs catalog started.
- [ ] Failure factors catalog started.
- [ ] Success factors catalog started.
- [ ] KPI benchmarks catalog started.
- [ ] Lessons learned process defined.
- [ ] Content review workflow defined.
- [ ] Knowledge update frequency defined.
- [ ] Knowledge confidence scoring defined.

## Plugins — 10

- [ ] Plugin Runtime defined.
- [ ] Plugin Registry defined.
- [ ] Plugin Interface defined.
- [ ] Plugin Lifecycle defined.
- [ ] Plugin Security Review defined.
- [ ] Plugin Data Access Rules (UDL only).
- [ ] Plugin Marketplace future plan.
- [ ] Sample plugin spec (Restaurant).
- [ ] Sample plugin spec (Factory).
- [ ] Plugin testing strategy.

## Governance — 15

- [ ] Roles and responsibilities approved.
- [ ] Calculator addition approval flow.
- [ ] Calculator deletion approval flow.
- [ ] Formula change approval flow.
- [ ] Data source addition approval flow.
- [ ] Certificate change approval flow.
- [ ] Report change approval flow.
- [ ] Sector addition approval flow.
- [ ] Plugin addition approval flow.
- [ ] AI model addition approval flow.
- [ ] API addition approval flow.
- [ ] Change log process.
- [ ] Conflict documentation process.
- [ ] Emergency change process.
- [ ] Documentation update process.

## Monitoring — 10

- [ ] Logging strategy defined.
- [ ] Error tracking tool selected.
- [ ] Performance monitoring defined.
- [ ] Uptime alerts defined.
- [ ] Cost monitoring defined.
- [ ] AI cost monitoring defined.
- [ ] API usage monitoring.
- [ ] User journey analytics.
- [ ] Alert escalation plan.
- [ ] On-call runbook.

## Deployment — 10

- [ ] CI/CD pipeline defined.
- [ ] Staging environment ready.
- [ ] Production deployment checklist.
- [ ] Feature flags strategy.
- [ ] Database migration runbook.
- [ ] Rollback runbook.
- [ ] Environment variables inventory.
- [ ] Vercel function limits verified.
- [ ] Domain/redirect plan.
- [ ] PWA deployment plan.

## Quality — 15

- [ ] Code review checklist.
- [ ] Security review checklist.
- [ ] UX review checklist.
- [ ] Design review checklist.
- [ ] AI output review checklist.
- [ ] Data quality review checklist.
- [ ] Accessibility review checklist.
- [ ] Performance review checklist.
- [ ] i18n review checklist.
- [ ] SEO review checklist.
- [ ] Documentation review checklist.
- [ ] Test coverage threshold (≥ 80%).
- [ ] Critical test pass rate (100%).
- [ ] No critical bugs gate.
- [ ] No high security vulnerabilities gate.

## Testing — 20

- [ ] Unit testing strategy.
- [ ] Integration testing strategy.
- [ ] Regression testing strategy.
- [ ] Performance testing strategy.
- [ ] Security testing strategy.
- [ ] Accessibility testing strategy.
- [ ] Load testing strategy.
- [ ] Stress testing strategy.
- [ ] AI validation strategy.
- [ ] Calculation validation strategy.
- [ ] Valuation validation strategy.
- [ ] Financial validation strategy.
- [ ] Data validation strategy.
- [ ] UX validation strategy.
- [ ] Acceptance testing strategy.
- [ ] Visual regression strategy.
- [ ] Mobile testing strategy.
- [ ] Cross-browser testing strategy.
- [ ] CI/CD test pipeline.
- [ ] Test data management.

## Documentation — 15

- [ ] AGENTS.md updated.
- [ ] README.md updated.
- [ ] API Inventory updated.
- [ ] ROUTES_MAP updated.
- [ ] DATABASE_ERD updated.
- [ ] AUTHORIZATION_MAP updated.
- [ ] Deployment guide updated.
- [ ] Onboarding guide created.
- [ ] Runbooks created.
- [ ] User guide planned.
- [ ] Admin guide planned.
- [ ] Change log maintained.
- [ ] Glossary maintained.
- [ ] Decision records maintained.
- [ ] Conflict logs maintained.

## Compliance — 10

- [ ] Data privacy policy (GDPR/PDPL) reviewed.
- [ ] Terms of service reviewed.
- [ ] Disclaimer in reports.
- [ ] Certificate standards documented.
- [ ] Financial regulations compliance plan.
- [ ] Audit report template.
- [ ] Electronic signature plan.
- [ ] Data retention policy.
- [ ] User consent management.
- [ ] Cross-border data plan.

---

## الإجمالي

**عدد البنود:** 360

| الحالة | العدد |
|---|---|
| Pass | ___ |
| Fail | ___ |
| N/A | ___ |
| **النسبة** | ___% |

> **الهدف:** ≥ 95% Pass قبل Sprint 1.
