# BONDS Assistant — Master Plan

> **Canonical project memory for the BONDS conversational assistant architecture.**
>
> Repository: `alzahrani6020/bonds-global-web`  
> Baseline main SHA at creation: `20c3c990b30f2a9ceaac0e6b2d8157a236c9fb51`  
> Created: 2026-10-22  
> Language of record: Arabic  
> Status: PHASE_1_COMPLETE / PHASE_2_WORKFLOW_DOCUMENTS

## 1. Purpose

هذا الملف هو المرجع المعماري الدائم لمشروع **BONDS Assistant**. يجب الرجوع إليه قبل بدء أو استئناف أي عمل متعلق بالشات، الذكاء الاصطناعي، القدرات، النماذج، التنقل، التوكنات، الأتمتة أو رحلات المستخدم.

الهدف النهائي هو تحويل الشات من واجهة سؤال وجواب إلى **طبقة تشغيل محادثية للموقع** تعمل وفق المسار:

```text
User Goal
  -> Intent
  -> Plan
  -> Authorization
  -> Structured Action
  -> Capability
  -> Service Token when required
  -> Execution
  -> Verification
  -> UI Update
  -> Audit Receipt
```

## 2. الحقائق المؤكدة عند إنشاء الخطة

- يوجد `v3/components/ai-chat-widget.js` ويعمل كشات داخل الموقع.
- يوجد `v3/api/ai.js` للمحادثة والاستدلال.
- يوجد `lib/ai/inference-router.js` و`lib/ai/orchestrator.js`.
- يوجد Capability Registry وPlanner وGovernance Gateway وGoverned Executor وRuntime Adapters.
- يوجد `lib/forms/dynamic-form-engine.js`.
- توجد بنية Funding File تشمل المراحل والمتطلبات وsubmissions والمسارات العربية والإنجليزية.
- يوجد Service Token Broker بواجهات `/broker/issue`, `/broker/revoke`, `/introspect`.
- Broker-issued Service Tokens أحادية الاستخدام عند introspection.
- Runtime contract الحالي: contract v2 / schema v3.
- Service Token TTL الحالي ثابت 3600 ثانية.
- User Session منفصل عن Service Token.
- آخر تغيير provider-agnostic لا يربط authorization بمزود AI أو model أو compute ceiling.
- Chat API الحالي ما زال يحتوي قيودًا مستقلة: rate limit لكل IP، output clamp محلي، timeout محلي. هذه ليست جزءًا من Capability Governance ويجب مراجعتها عند بناء Assistant V1.

## 3. مبادئ لا يجب كسرها

1. **التوكن يحدد من يستطيع الفعل، لا مدى قوة الذكاء الاصطناعي.**
2. لا يوضع model/provider/context/throughput/compute داخل authorization token.
3. لا ينفذ النص الحر ككود أو رابط أو أمر مباشر.
4. التنفيذ يتم فقط من خلال capabilities مسجلة وعقود structured actions.
5. لا يسمح للـAI باختراع URL أو DOM selector أو SQL أو JavaScript للتنفيذ.
6. أي فعل حساس يمر عبر governance وconfirmation المناسب.
7. أي معلومة مستنتجة من AI لا تتحول إلى حقيقة محفوظة قبل التأكيد.
8. الحسابات المالية تنفذها المحركات/الحاسبات، والـAI يفسر النتائج.
9. البيانات الحساسة لا تُرسل إلى مزود خارجي إلا وفق سياسة بيانات واضحة.
10. يجب أن يبقى النظام قابلًا للعمل في degraded mode حتى لو تعطل AI.
11. لا يتم تغيير Service Token Runtime الحالي بلا حاجة عملية واختبارات قبول كاملة.
12. لا يتم إزالة أو إضعاف audience/scope/revocation/replay protections.
13. كل تغيير معماري يجب أن يكون versioned ومختبرًا وقابلًا للتراجع.
14. المستودع هو مصدر الحقيقة لهذه الخطة، وليس ذاكرة المحادثة وحدها.

---

# 4. جميع الاقتراحات المعمارية والتنفيذية

## A. طبقة المساعد والبروتوكول

### 1. BONDS Assistant V1
إنشاء طبقة مساعد مركزية للموقع تكون نقطة الدخول الموحدة للطلبات المحادثية والإجراءات.

### 2. Assistant API
إنشاء نقطة دخول موحدة مثل `/api/v3/assistant`.

### 3. BONDS_ASSISTANT_PROTOCOL_V1
عقد موحد بين الشات والواجهة والقدرات والخدمات.

### 4. Structured Response Contract
الرد يدعم `reply`, `actions`, `cards`, `forms`, `confirmations`, `navigation`, `suggestions`, `status`.

### 5. Structured Actions
كل إجراء يعبّر عنه بكائن منظم، لا بنص حر.

### 6. أوضاع تشغيل المساعد
دعم أوضاع مثل `assist`, `guide`, `execute`.

### 7. فصل الفهم عن التنفيذ
النموذج يفهم ويقترح، والمنظومة تتحقق ثم تنفذ.

### 8. فصل التخطيط عن التنفيذ
الخطة لا تنفذ تلقائيًا؛ كل خطوة تمر على governance.

### 9. Intent Confidence Engine
قياس ثقة فهم النية وعدم تنفيذ الأفعال الحساسة عند الغموض.

### 10. Plan Optimizer
اختيار أقصر وأوضح مسار لإنجاز هدف المستخدم.

### 11. Deterministic Planner
عندما تكون القواعد واضحة من النظام، تستخدم قواعد حتمية بدل AI.

### 12. Missing-Data Resolver
البحث عن البيانات الناقصة في profile/project/funding/document قبل سؤال المستخدم.

### 13. Explain-Then-Act
عرض ما سيقوم به المساعد قبل سلسلة الأفعال المهمة.

### 14. Dry Run / Simulation
معاينة ما سيحدث بدون تنفيذ فعلي.

### 15. Preview Before Execute
إظهار نطاق التغيير قبل الإجراءات المؤثرة.

### 16. Before/After Diff
عرض القيم السابقة والجديدة قبل حفظ تعديل حساس.

### 17. Action Receipts
إيصال نتيجة لكل إجراء مهم مع رقم مرجعي ووقت ونتيجة.

### 18. Explainability Log
تسجيل القرار التشغيلي والقواعد والمصادر دون تخزين chain-of-thought.

### 19. Permission Explainability
تفسير سبب المنع واقتراح البديل الممكن.

### 20. Error Taxonomy
أخطاء موحدة مثل `AI_UNAVAILABLE`, `CAPABILITY_DENIED`, `FORM_NOT_FOUND`, `RESOURCE_NOT_OWNED`, `TOKEN_BROKER_FAILED`, `VALIDATION_FAILED`, `CONFIRMATION_REQUIRED`.

---

## B. سجل القدرات وتنفيذ الأدوات

### 21. Capability Registry مركزي
كل قدرة تسجل بمدخلاتها ومخرجاتها وخطورتها ونسختها ومتطلبات الصلاحية.

### 22. Capability Discovery
إرجاع القدرات المتاحة ديناميكيًا حسب المستخدم والحالة.

### 23. Capability Attestation
كل خدمة تعلن رسميًا ما تدعمه وما لا تدعمه.

### 24. Capability Versioning
دعم نسخ مثل `form_load@1` و`form_load@2`.

### 25. Capability Bundles
تجميع scopes/قدرات منطقية عند الحاجة بدون إخفاء الصلاحيات الدقيقة داخليًا.

### 26. منع القدرات الشبحية
أي capability غير مفعلة لا تظهر للمخطط.

### 27. Tool Sandboxing
لا تنفذ الأدوات إلا الأفعال المسجلة والمعتمدة.

### 28. Tool Output Validation
فحص نتائج الأدوات مقابل schema قبل استهلاكها.

### 29. UI Action Bus
بوابة واحدة مثل `BondsAssistant.execute(action)` لتنفيذ أوامر الواجهة.

### 30. Safe Retry Policy
إعادة المحاولة للقراءة فقط افتراضيًا؛ writes تحتاج idempotency.

---

## C. القدرات الأولية المقترحة

### 31. site_navigate
انتقال إلى destination مسجل.

### 32. section_open
فتح قسم أو تبويب معروف.

### 33. form_find
العثور على النموذج المناسب.

### 34. form_load
تحميل schema النموذج.

### 35. form_prefill
اقتراح/ملء القيم المسموح بها.

### 36. form_validate
التحقق من صحة واكتمال النموذج.

### 37. form_save_draft
حفظ مسودة دون إرسال نهائي.

### 38. form_submit
إرسال نهائي مع confirmation مرتفع.

### 39. project_status
قراءة حالة المشروع.

### 40. project_update
تحديث مشروع ضمن صلاحيات واضحة.

### 41. funding_status
قراءة حالة ملف التمويل.

### 42. funding_next_step
تحديد الخطوة التالية.

### 43. funding_next_requirements
إرجاع المكتمل والناقص والمتطلب التالي.

### 44. document_find
العثور على المستند المطلوب.

### 45. document_attach
ربط مستند بمورد مسموح.

### 46. calculator_open
فتح الحاسبة المناسبة.

### 47. calculator_run
تشغيل محرك الحساب الفعلي.

### 48. help_explain
شرح الحقل أو المرحلة أو المتطلب.

### 49. service_discover
إظهار الخدمات المتاحة للمخطط.

### 50. request_create
إنشاء طلب أو مسودة طلب وفق الحوكمة.

### 51. external_send
إرسال خارجي حساس ويحتاج تأكيدًا قويًا.

### 52. consent_accept
اعتماد موافقة قانونية ضمن flow صريح.

### 53. payment_action
قدرة مستقبلية شديدة الحساسية لا تفعل إلا بعد ضوابط إضافية.

---

## D. التنقل وخريطة الموقع

### 54. Navigation Registry
إنشاء `navigation-registry.json` للمسارات المعتمدة.

### 55. عدم السماح بروابط من اختراع النموذج
الـAI يعيد target key فقط.

### 56. دعم العربية والإنجليزية في نفس destination
العقد منطقي، والواجهة تحل المسار حسب اللغة.

### 57. Deep Links
فتح الصفحة والسجل والتبويب الصحيح.

### 58. UI Highlighting
تمييز عنصر مسجل بالمعرف بدل selector حر.

### 59. Semantic Site Search
فهم سؤال المستخدم عن مكان الخدمة حتى لو لم يعرف اسم الصفحة.

### 60. Semantic Site Index
فهرس دلالي للصفحات والنماذج والخدمات والقدرات.

### 61. Self-Healing Registry
كشف destinations المكسورة أو التي تغيرت.

### 62. Registry Validation in CI
فشل CI إذا كانت route/form/capability غير صالحة.

### 63. Link Verification
اختبار destinations المسجلة آليًا.

---

## E. النماذج

### 64. Form Registry
إنشاء سجل مركزي لكل النماذج ومساراتها ونسخها وصلاحياتها.

### 65. Inline Forms
عرض نماذج صغيرة داخل الشات.

### 66. Progressive Forms
جمع البيانات تدريجيًا بدل نموذج ضخم مرة واحدة.

### 67. Form Copilot
شرح الحقول والمطلوب ومساعدة المستخدم على التصحيح.

### 68. Prefill
ملء البيانات الموجودة مسبقًا.

### 69. Provenance لكل قيمة
تسجيل المصدر: profile/project/funding_case/document/calculator/conversation/ai_inference.

### 70. Suggested vs Confirmed
فصل القيم المقترحة عن القيم المؤكدة.

### 71. Confidence للقيم المستنتجة
إضافة درجة ثقة عندما تكون القيمة مستنبطة.

### 72. Consistency Validation
منع التعارض الصامت بين قيمة جديدة وقيمة موثوقة.

### 73. Draft-first Editing
الحفظ كمسودة افتراضيًا قبل الإرسال النهائي.

### 74. Form Schema Versioning
ربط الرحلات الطويلة بنسخة النموذج المناسبة.

### 75. Backward Compatibility
الطلبات القديمة لا تتعطل بعد تحديث schema.

---

## F. رحلة التمويل والمشروع

### 76. User Journey Engine
تمثيل الرحلة كمراحل واضحة.

### 77. Next-Step Engine
تحديد ما أنجز وما ينقص وما التالي.

### 78. Funding File Integration
الاعتماد على stages/requirements/submissions الحالية بدل التخمين.

### 79. Goal Graph
تمثيل الهدف الرئيسي والأهداف الفرعية والاعتماديات.

### 80. Task Graph
تمثيل التنفيذ كمهام مترابطة بدل مجرد history رسائل.

### 81. Cross-Page State
الحفاظ على المهمة أثناء التنقل بين الصفحات.

### 82. Task Resume
استئناف المهمة لاحقًا.

### 83. Cancelable Workflows
إيقاف ما لم ينفذ بعد.

### 84. Pause/Resume Workflows
إيقاف مؤقت واستكمال لاحق.

### 85. Workflow Versioning
تثبيت نسخة الرحلة المستخدمة.

### 86. State Machine للمسارات الحساسة
حالات مثل draft/ready/confirmed/submitted/completed/failed.

### 87. Agent Inbox
إظهار ما ينتظر من المستخدم.

### 88. Draft Center
مكان موحد للمسودات قبل الإرسال.

### 89. Notification Engine
تنبيه المستخدم بالحالة أو النقص أو الحاجة للتأكيد.

### 90. Event-Driven Assistant
الاستجابة لأحداث مثل form_saved/document_uploaded/case_status_changed/page_changed.

---

## G. سياق المحادثة والبيانات

### 91. Assistant State Store
تخزين goal/current_stage/open_tasks/required_data/confirmed_facts/pending_confirmation.

### 92. Structured Conversation State
عدم الاعتماد على transcript وحده.

### 93. Context Summarization
تلخيص history الطويل إلى state موثوق.

### 94. Context Boundary
إغلاق سياق المشروع السابق عند الانتقال لمشروع آخر.

### 95. Identity Graph
ربط user/establishment/project/funding_case/documents/forms/conversations.

### 96. Digital Twin تشغيلي
نموذج حالة شامل للمستخدم ومشاريعه ونواقصه؛ يؤجل لمرحلة لاحقة.

### 97. Context Firewall
كل خدمة ترى الحد الأدنى اللازم من بيانات المستخدم.

### 98. Data Classification
تصنيف البيانات public/internal/confidential/restricted.

### 99. PII Redaction
إخفاء البيانات الحساسة قبل إرسالها لمزود خارجي عند الحاجة.

### 100. Provider Trust Policy
ربط تصنيف البيانات بالمزود المسموح.

### 101. Privacy Controls
تمكين المستخدم من التحكم في بعض أوجه استخدام بياناته.

### 102. Data Retention Policies
سياسات منفصلة للمحادثات والتدقيق والتوكنات والمستندات.

---

## H. المستندات والحسابات

### 103. Document Assistant
تحديد المطلوب وسبب الحاجة ومكان الرفع.

### 104. Document Classification
تصنيف المستند المرفوع.

### 105. Document Field Extraction
استخراج الحقول المنظمة مع provenance.

### 106. Document-to-Workflow
استخدام المستند لتعبئة نموذج وتحديث المتطلب واقتراح التالي.

### 107. Prompt Injection Firewall
محتوى PDF/ويب/API يعتبر بيانات لا أوامر تنفيذ.

### 108. Calculation Authority Separation
الحاسبات تنفذ الحساب، والـAI يفسر فقط.

### 109. Calculator Orchestration
تشغيل الحاسبات المناسبة تلقائيًا حسب الطلب.

### 110. Evidence Binding
ربط النتائج والأرقام بالمصدر الحقيقي.

---

## I. التوكنات والأمان

### 111. Action Token
نوع توكن مستقبلي لفعل واحد محدد ومورد محدد.

### 112. Workflow Token
توكن مرتبط برحلة متعددة الخطوات.

### 113. Confirmation Token
توكن قصير جدًا لتأكيد فعل حساس بنفس payload.

### 114. Resource-Bound Token
ربط التوكن بمشروع/مستند/ملف تمويل محدد.

### 115. Token Exchange
`Session -> Action -> Service -> Provider Credential`.

### 116. Delegation Chain
تتبع User -> Assistant -> Orchestrator -> Service.

### 117. Token Lineage
parent/child relationships بين التوكنات.

### 118. Token Families
إلغاء عائلة كاملة عند الحاجة.

### 119. Revocation Epoch
إبطال جيل كامل من التوكنات وفق نطاق معين.

### 120. Proof-of-Possession
ربط التوكن بالجلسة/الطلب للأفعال الحساسة مستقبلًا.

### 121. Asymmetric Signing / JWKS
تطوير مستقبلي؛ ليس أولوية V1.

### 122. KMS/HSM
تخزين مفاتيح خاص عالي الحماية؛ مؤجل.

### 123. Credential Vault
حفظ أسرار مزودي API بعيدًا عن العميل وإعطاء الخدمات وصولًا مؤقتًا.

---

# 5. اقتراحات تشغيلية إضافية مرتبطة بالخطة

هذه عناصر داعمة وردت ضمن النقاش ويجب عدم فقدها حتى وإن كانت مدمجة مع الاقتراحات أعلاه:

- Per-service key isolation.
- Key rotation with overlap.
- Environment binding بين Production/Staging.
- Tenant isolation عند تعدد الشركات.
- Region binding إذا تطلبت إقامة البيانات.
- Risk-based authorization.
- Dynamic confirmation حسب المخاطر.
- Idempotency ledger.
- Replay protection على مستوى الأفعال.
- Undo/compensating actions.
- Human escalation.
- Human approval queue.
- Employee assistant mode.
- Emergency kill switch لكل capability.
- Read-only emergency mode.
- Anomaly detection.
- Token introspection cache آمن عند الحاجة.
- Policy-as-Code.
- Policy simulation.
- Shadow authorization.
- Operational dashboard.
- Assistant Control Center.
- User Control Center.
- Audit search.
- Operational replay لأغراض debugging.
- Cost governance منفصل عن authorization.
- Per-task budget.
- Latency-aware routing.
- Streaming.
- Parallel tool execution للأعمال المستقلة.
- Multi-agent داخلي في مرحلة لاحقة.
- Verifier/Critic للمهام الحساسة.
- Multi-model consensus فقط للحالات الحرجة.
- Voice layer مستقبلًا.
- Multimodal layer مستقبلًا.
- Accessibility.
- Synthetic production journeys.
- Golden conversations.
- Assistant evaluations.
- Red-team scenarios.
- End-to-end CI journeys.
- Outcome analytics.
- Journey analytics.
- Conversion metrics.

---

# 6. ترتيب التنفيذ الموصى به

## Phase 1 — Assistant V1
1. `BONDS_ASSISTANT_PROTOCOL_V1`
2. `/api/v3/assistant`
3. `navigation-registry.json`
4. `form-registry.json`
5. Structured Actions
6. `site_navigate`
7. `form_find`
8. `form_load`
9. `funding_status`
10. `funding_next_step`
11. `project_status`
12. Calculator capabilities
13. تحديث chat widget لعرض actions/cards/forms
14. Context state
15. Prefill + provenance
16. Confirmation engine
17. Save draft
18. Idempotency
19. Audit trail
20. End-to-end tests
21. Security/red-team tests
22. Production rollout

## Phase 2 — Workflow & Documents
- Persistent workflow state.
- Document assistant/classification/extraction.
- Document-to-workflow.
- Event-driven assistant.
- Notifications.
- Draft center.
- Agent inbox.
- Human escalation.

## Phase 3 — Advanced Authorization
- Action Tokens.
- Workflow Tokens.
- Confirmation Tokens.
- Resource binding.
- Token Exchange.
- Delegation/lineage.
- Token families.

## Phase 4 — Advanced Platform
- Asymmetric signing/JWKS.
- KMS/HSM.
- Digital Twin.
- Multi-agent.
- Voice.
- Multimodal.
- Advanced distributed token infrastructure.

---

# 7. ما لا ينفذ في V1

لا يبدأ V1 بـ:
- HSM/KMS.
- full JWT/JWKS migration.
- full multi-agent autonomy.
- generalized Digital Twin.
- generalized token family infrastructure.
- voice/multimodal execution.
- direct DOM control.
- arbitrary URLs.
- arbitrary JavaScript.
- arbitrary SQL.
- AI-generated financial calculations بدون calculator engine.

---

# 8. الحالة التنفيذية الحالية

- آخر `main` متحقق منه لقبول Assistant V1 في الإنتاج: `6313b460aaec33e21378f40d5a33cc493e3268b0`، دمج PR #375.
- Assistant V1: **IMPLEMENTED / PRODUCTION ACCEPTANCE PASS**.
- Structured action protocol / Assistant API / Navigation registry / Form registry: **MERGED**.
- قدرات القراءة والتمويل والمشروع والحاسبات، وعارض الشات والسياق وprovenance وconfirmation وحفظ المسودة: **MERGED**؛ انظر قائمة `completed` في الخارطة.
- Durable idempotency: **MERGED** عبر PR #367.
- Audit implementation: **MERGED / PRODUCTION VERIFIED** عبر #369 و#371 و#375؛ forward-only recovery migration مطبقة، وقيود الأحداث وRLS ومنع التعديل المباشر وimmutable trigger متحققة على Production.
- E2E journeys: **PASS / MERGED** عبر PR #372، SHA `8a97097df16130cb1b3d20e8597f98d97cbba787`.
- Security Red Team: **PASS / MERGED** عبر PR #373؛ Accessibility نجحت في أحدث attempt، وجميع البوابات الثلاث ناجحة.
- Production rollout: **PASS / COMPLETE**. Production على SHA `6313b460aaec33e21378f40d5a33cc493e3268b0`; `/api/readiness` = `ready` مع `assistant=ok` و`schema_version=1`; Production Authenticated Smoke = PASS; سجل التدقيق أثبت 9 أحداث session و`execution_started=1` و`execution_succeeded=1` لنفس marker.
- تفاصيل القبول وحدود الدليل والتراجع: `docs/BONDS_ASSISTANT_PRODUCTION_ROLLOUT.md`. المرحلة الحالية الرسمية: **Phase 2 — Workflow & Documents**.
- Persistent workflow state: **IMPLEMENTED_BASE / MERGED**.
- Document assistant / classification / extraction: **IMPLEMENTED_BASE / MERGED**.
- Document-to-Workflow: **IMPLEMENTED_BASE / API ACCEPTANCE COVERED** — owned document + owned funding case binding, completion-aware requirement suggestions, project-boundary conflict rejection, suggestion-only policy, and explicit no-auto-write behavior.
- Event-Driven Assistant: **IMPLEMENTED_BASE / API ACCEPTANCE COVERED** — explicit event registry, stable event IDs, bounded replay protection, exact workflow boundary enforcement, suggestion-only reactions, immutable audit lifecycle, and duplicate-notification suppression.
- Notifications: **IMPLEMENTED_BASE / API + DURABLE INBOX COVERED** — durable user-scoped storage, deterministic deduplication, unread/read lifecycle, authenticated retrieval, replay-safe persistence, bilingual widget inbox, and governed logical actions only.
- Draft Center: **IMPLEMENTED_BASE / API ACCEPTANCE COVERED** — authenticated read-only unified view over owned editable drafts, schema-verified source selects, exact ownership/status/subject filtering, canonical form-registry navigation, partial-source tolerance, and explicit no-submit/no-write/no-execution policy.
- Assistant User Inbox: **IMPLEMENTED_BASE / USER-SCOPED READ-ONLY VIEW / PRODUCTION VERIFIED** — authenticated aggregation of the user's workflow requirements, pending confirmations, drafts, and unread notification context; no execution authority.
- Agent Inbox: **IMPLEMENTED_BASE / ADMIN OPERATIONAL QUEUE COVERED** — separate durable employee/admin human-review queue with server-side storage, source-ownership verification, semantic deduplication, scoped owner/super_admin/admin/support access, approved-assignee validation, lifecycle management, admin UI, and no assistant execution authority.
- Sensitive Workflow State Machine: **IMPLEMENTED_BASE / MERGED / PRODUCTION VERIFIED** — governed states `draft/ready/confirmed/submitted/completed/failed`, atomic PostgreSQL transition RPC with `FOR UPDATE`, optimistic version and boundary enforcement, generic-save sensitive-state guard, service-role-only database execution, and explicit no-external-execution/no-authorization semantics. Production migration applied and verified; Vercel production READY on merge SHA `162123d1d7f21a873fb211f01a0870f83965c922`; `/api/readiness` reports `assistant=ok` and `token_runtime=ok`; runtime error scan clean.
- Human Escalation: **IMPLEMENTED_BASE / USER-TO-HUMAN REVIEW BRIDGE** — authenticated user-scoped escalation into the operational Agent Inbox with exact workflow/boundary/version binding, idempotent queueing, server-derived priority by bounded reason, user-visible escalation status, immutable audit integration, and no assistant execution authority.
- Human Approval Queue: **IMPLEMENTED_BASE / MERGED / PRODUCTION VERIFIED** — durable server-side approval requests bound to exact workflow, boundary, version and action fingerprint; only high/critical confirmation-required actions are eligible; decisions require attributable owner/super_admin/admin bearer identity; Support cannot decide; approved status remains evidence only and never grants execution authority. Production database schema/permissions verified and `/api/health` + `/api/readiness` are PASS on production version `6646045`.
- Employee Assistant Mode: **IMPLEMENTED_BASE / ROLE-BOUND OPERATIONAL VIEW** — authenticated operating mode derived from owner/admin role identity; ordinary users remain customer mode; employees receive bounded operational workspace counts; Support can use Agent Inbox but cannot access human approval decisions; mode never escalates permissions and never grants execution authority.
- Emergency Kill Switch: **IMPLEMENTED_BASE / EXISTING CONTROL-PLANE REUSED** — runtime enforcement reuses `public.admin_ai_kill_switches`; a global `assistant` switch or bounded per-mutation feature switch blocks state-changing Assistant routes before request-body processing or side effects; expired switches automatically cease blocking; control-plane lookup failure fails closed for writes; internal administrative reasons are not exposed to users; read-only Assistant routes remain available; no new table, token change, provider change, or execution authority is introduced.
- Read-only Emergency Mode: **IMPLEMENTED_BASE / MERGED / PRODUCTION VERIFIED** — reuses `public.admin_ai_kill_switches` with bounded feature `assistant.read_only`; all registered Assistant mutations are denied before request-body processing or side effects while read/search/planning routes remain available; public mode state is exposed without internal administrative reason text; expiry and global-kill precedence are enforced; no schema/token/provider/model/context/throughput changes. Production version `751bdcd` reports health/readiness PASS with no runtime errors in the verified window.
- Anomaly Detection: **IMPLEMENTED_BASE / DETERMINISTIC / ADMIN-OBSERVABILITY ONLY** — scans immutable `public.assistant_action_audit` for bounded deterministic signals including high-risk execution without confirmation, failure/denial bursts, uncertain-write bursts, and replay bursts; results use opaque subject references, expose no raw user ID, never auto-block or grant execution authority, and can be explicitly persisted as operational alerts in existing `public.admin_alerts` with best-effort deduplication.
- Safe Introspection Cache: **IMPLEMENTED_BASE / INFORMATIONAL-ONLY / BOUNDED TTL** — adds a small in-memory cache for sanitized Assistant introspection only: protocol/registry versions and counts, registered action types, and bounded emergency-mode status. Cache keys are static and bounded, TTL is 1–30 seconds (5 seconds default), entries are capped, no user/session data or secrets are stored, and cached data is explicitly forbidden as an authorization or execution source. Kill Switch enforcement continues to read its control plane directly and is not cached.
- Policy as Code: **IMPLEMENTED_BASE / VERSIONED / DETERMINISTIC** — centralizes existing Assistant action-governance rules in `lib/assistant/assistant-policy.json` and `lib/assistant/policy-engine.js`; protocol normalization now evaluates the versioned policy for registered action types, valid risk levels, recursive executable-field denial, and confirmation requirements. The policy does not grant authorization or execution authority, cannot be model-generated, and preserves existing behavior rather than introducing new permissions.
- Policy Simulation: **IMPLEMENTED_BASE / READ-ONLY / DRY-RUN** — evaluates hypothetical structured actions against the versioned Assistant policy and returns allow/deny/confirmation outcomes plus matched rule IDs. Simulation performs no database writes, invokes no tools, grants no authorization, never executes an action, does not echo arbitrary input payloads, and is batch-bounded.
- Shadow Authorization: **IMPLEMENTED_BASE / NON-ENFORCING / DRIFT-OBSERVABILITY** — runs a bounded authorization projection beside the existing production `evaluateGovernance()` decision inside the governed executor. It evaluates service/capability state and already-resolved user permissions/entitlements, then reports `would_allow`, `would_deny`, or `not_evaluated` plus drift against the actual decision. It deliberately does not re-run service-token verification, feature-flag providers, or rate-limit counters, never changes the production decision, grants no authority, and cannot trigger execution.
- Operational Dashboard: **IMPLEMENTED_BASE / ADMIN-ONLY / READ-ONLY** — adds a bounded Assistant operations aggregator and `admin/assistant-operations.html`, integrated into the existing Platform Center. It reports recent audit lifecycle counts, active Agent Inbox and Human Approval queue counts, persisted Assistant anomaly alert counts, and sanitized emergency-mode state. It exposes no raw user identifiers, audit metadata, tokens, secrets, or internal kill-switch reasons; it performs no writes and grants no execution authority. Shadow Authorization drift is explicitly marked unavailable until durable telemetry exists rather than fabricating a metric.
- Assistant Control Center: **IMPLEMENTED_BASE / ADMIN-CONTROL / EXISTING AUDITED PLANE** — adds `admin/assistant-control-center.html` with explicit Normal, Read-only Emergency, and Full Stop modes. It reuses the existing permissioned and audited `/api/admin?action=ai-operations` and `ai-kill-switch-update` paths, restricts controls to `assistant` and `assistant.read_only`, requires typed plus browser confirmation, and orders multi-step transitions to avoid temporarily weakening a restrictive state. It introduces no new authorization layer and does not modify token/provider/model/context/throughput settings.
- User Control Center: **IMPLEMENTED_BASE / USER-SCOPED / SESSION-PRIVACY-CONTROL** — adds `calculators/auth/assistant-control.html` over existing user-scoped capabilities. The user can disable structured Assistant session context, clear all session-scoped Assistant context boundaries, and review/mark Assistant notifications through the existing authenticated notifications API. The chat widget omits `assistantState` when context use is disabled. No token/provider/model/context-size/throughput/compute controls, parallel authorization API, or database migration were introduced.\n- Audit Search: **IMPLEMENTED_BASE / ADMIN-ONLY / READ-ONLY / PRIVACY-SANITIZED** — adds `GET /api/admin?action=assistant-audit-search` and `admin/assistant-audit-search.html` over the existing immutable `public.assistant_action_audit` table. It reuses `ai.operations.read`, supports bounded server-side filters and pagination, and returns an opaque `subject_ref` instead of raw user identifiers while omitting `session_id`, `metadata`, and idempotency material. It performs no writes, introduces no new authorization plane, and requires no database migration.\n- Operational Replay: **IMPLEMENTED_BASE / ADMIN-ONLY / EVIDENCE-RECONSTRUCTION / NO-EXECUTION** — adds `GET /api/admin?action=assistant-operational-replay` and `admin/assistant-operational-replay.html`. It reconstructs an ordered lifecycle timeline from existing immutable `assistant_action_audit` rows using `action_id` or `resource_id`, returns sanitized opaque identity context, derives terminal status/anomalies deterministically, and explicitly performs no capability execution, writes, token issuance, or authorization simulation. It reuses `ai.operations.read` and requires no database migration.\n- Cost Governance: **IMPLEMENTED_BASE / OBSERVABILITY-ONLY / SEPARATE-FROM-AUTHORIZATION** — adds `GET /api/admin?action=assistant-cost-governance` and `admin/assistant-cost-governance.html` over existing `admin_ai_operation_events`. It reports bounded-window request counts, recorded USD cost, token totals, latency, cost coverage, and breakdowns by feature/model. It has no authorization effect, does not block execution, does not limit tokens/compute, and does not alter provider routing or model selection. No database migration or parallel control plane was introduced.\n- العنصر التالي الرسمي: **Per-task Budget**.
- Action token: **NOT IMPLEMENTED**
- Workflow token: **NOT IMPLEMENTED**
- Confirmation token: **NOT IMPLEMENTED**
- Token exchange: **NOT IMPLEMENTED**
- Service token broker: **IMPLEMENTED / PRODUCTION**
- Capability governance: **IMPLEMENTED**
- Dynamic form engine: **IMPLEMENTED**
- Funding file architecture: **IMPLEMENTED**
- AI chat widget: **IMPLEMENTED**
- Native inference routing: **IMPLEMENTED**
- Provider-agnostic onboarding contract: **IMPLEMENTED**

---

# 9. تعليمات الاستئناف في أي محادثة جديدة

استخدم النص التالي:

> راجع `docs/BONDS_ASSISTANT_MASTER_PLAN.md` و`docs/bonds-assistant-roadmap.json` من مستودع `alzahrani6020/bonds-global-web`، تحقق من حالة `main` الحالية، ثم أكمل من أول عنصر غير منفذ حسب الأولوية. لا تعُد من الصفر، ولا تغيّر المبادئ الأمنية أو قرارات الفصل بين authorization والأداء إلا بدليل تقني واضح.

---

# 10. قاعدة تحديث هذا المستند

بعد كل PR متعلق بالمساعد:
1. تحديث `completed`.
2. تحديث `current_phase`.
3. تحديث `next`.
4. تسجيل PR/SHA.
5. تحديث أي قرار معماري تغير.
6. عدم حذف الاقتراحات القديمة؛ إن ألغيت توسم `rejected` مع السبب.
