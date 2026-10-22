# BONDS Dual-Core Self-Evolving Intelligence System

## الحالة

معمارية معتمدة كأساس للتطوير اللاحق. لا تلغي `BONDS_ASSISTANT_MASTER_PLAN.md` بل توسعها وتربط المساعد بالتعلم والتدريب والتطوير والتحديث الذاتي.

## النواة A — BONDS Operational Intelligence Core

مسؤولة عن:
- Assistant
- Intent
- Planning
- Capability Discovery
- Governance
- Service Tokens
- Workflows
- Documents
- Calculators
- Execution
- Verification
- User-visible responses

المسار المرجعي:

```text
User
-> Assistant
-> Intent
-> Plan
-> Authorization
-> Structured Action
-> Capability
-> Execution
-> Verification
-> Response
```

## النواة B — BONDS Self-Evolving Intelligence Core

تحتوي خمسة محركات مترابطة:

1. Self-Learning Engine
2. Self-Training Engine
3. Self-Development Engine
4. Self-Updating Engine
5. Validation & Outcome Engine

المسار المرجعي:

```text
Observe
-> Learn
-> Detect Gap
-> Propose
-> Approve Target
-> Build Candidate
-> Test
-> Repair
-> Revalidate
-> Update
-> Monitor
-> Learn Again
```

## الربط بين النواتين

يتم عبر Dynamic Intelligence Bus قائم على أحداث منظمة، منها:

- assistant.intent.failed
- assistant.low_confidence
- capability.missing
- capability.failed
- user.corrected
- workflow.abandoned
- calculation.mismatch
- document.extraction.failed
- candidate.validated
- release.promoted
- production.regression

النواة التشغيلية ترسل outcomes/signals.
النواة الذاتية تعيد capabilities/rules/prompts/models/code updates بعد التحقق.

## الذاكرة المشتركة

المكونات المشتركة:
- Governance
- State
- Audit
- Evidence
- Capability Registry
- Release provenance
- Model provenance
- Learning provenance

## العتاد

المعمارية لا تعتمد على جهاز بعينه.
Runtime Capability Profiler يحدد ما يمكن تشغيله الآن.
Scheduler يخفض التوازي والسياق وحجم النموذج عند ضعف الموارد دون خفض معايير الأمان أو الاختبار.

الحالات المتوقعة:
- RUNNABLE
- WAITING_FOR_CAPACITY
- PAUSED
- BLOCKED
- VALIDATING
- READY_FOR_PROMOTION
- COMPLETED

## التوليد المحلي

المزود الحالي:
`BondsNativeProvider`

يستهلكه كل من:
- Operational Core
- Self-Evolving Core

لكن Scheduler يعطي أولوية Production ويمنع تنازع الموارد على الجهاز المحدود.

## الموافقة

`APPROVED_TARGET` تعني أن الهدف أصبح مطلوب الإنجاز.
الفشل الفني لا يلغي الهدف؛ يدخل Candidate في Repair Loop.
طلب موافقة جديدة مطلوب فقط عند تغيير جوهري في النطاق أو المخاطر أو invariant محمي.

## Candidate Isolation

كل Candidate يبدأ من `origin/main` النظيف داخل worktree/branch مستقل.
لا تعديل مباشر على `main`.
لا نشر قبل validation + CI + freshness check + staged verification.

## الاستمرار بعد إعادة التشغيل

كل عمل طويل يجب أن يدعم checkpoint/resume.
الحالة التشغيلية لا تعتمد على المحادثة.
