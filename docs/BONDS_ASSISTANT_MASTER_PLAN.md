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
- User Control Center: **IMPLEMENTED_BASE / USER-SCOPED / SESSION-PRIVACY-CONTROL** — adds `calculators/auth/assistant-control.html` over existing user-scoped capabilities. The user can disable structured Assistant session context, clear all session-scoped Assistant context boundaries, and review/mark Assistant notifications through the existing authenticated notifications API. The chat widget omits `assistantState` when context use is disabled. No token/provider/model/context-size/throughput/compute controls, parallel authorization API, or database migration were introduced.\n- Audit Search: **IMPLEMENTED_BASE / ADMIN-ONLY / READ-ONLY / PRIVACY-SANITIZED** — adds `GET /api/admin?action=assistant-audit-search` and `admin/assistant-audit-search.html` over the existing immutable `public.assistant_action_audit` table. It reuses `ai.operations.read`, supports bounded server-side filters and pagination, and returns an opaque `subject_ref` instead of raw user identifiers while omitting `session_id`, `metadata`, and idempotency material. It performs no writes, introduces no new authorization plane, and requires no database migration.\n- Operational Replay: **IMPLEMENTED_BASE / ADMIN-ONLY / EVIDENCE-RECONSTRUCTION / NO-EXECUTION** — adds `GET /api/admin?action=assistant-operational-replay` and `admin/assistant-operational-replay.html`. It reconstructs an ordered lifecycle timeline from existing immutable `assistant_action_audit` rows using `action_id` or `resource_id`, returns sanitized opaque identity context, derives terminal status/anomalies deterministically, and explicitly performs no capability execution, writes, token issuance, or authorization simulation. It reuses `ai.operations.read` and requires no database migration.\n- Cost Governance: **IMPLEMENTED_BASE / OBSERVABILITY-ONLY / SEPARATE-FROM-AUTHORIZATION** — adds `GET /api/admin?action=assistant-cost-governance` and `admin/assistant-cost-governance.html` over existing `admin_ai_operation_events`. It reports bounded-window request counts, recorded USD cost, token totals, latency, cost coverage, and breakdowns by feature/model. It has no authorization effect, does not block execution, does not limit tokens/compute, and does not alter provider routing or model selection. No database migration or parallel control plane was introduced.\n- Per-task Budget: **IMPLEMENTED_BASE / REQUEST-SCOPED / ADVISORY-ONLY** — reuses the existing `request_id` on `admin_ai_operation_events` and adds `GET /api/admin?action=assistant-task-budget`, embedded into Cost Governance. An admin can compare recorded task cost against an explicit USD budget and receive within/over/unpriced/not_found state, utilization, remaining budget and token totals. This is advisory only: no execution blocking, token limiting, model/provider change, compute limit, or authorization effect. No migration was introduced.\n- Latency-aware Routing: **IMPLEMENTED_BASE / SAME-PROVIDER / METHOD-SCOPED / CONSERVATIVE** — orders already-configured Bonds Native nodes using fresh EWMA latency observations for the same operation only. Circuit breaker/failover remain authoritative; routing does not force exploration of unmeasured nodes and only reorders when at least two current observations exist. It does not change provider/model/token/context/compute/throughput or authorization and requires no migration.\n- Streaming: **IMPLEMENTED_BASE / SSE-TRANSPORT / BACKWARD-COMPATIBLE / NOT-NATIVE-TOKEN-STREAMING** — the existing Assistant chat endpoint supports opt-in `text/event-stream` transport with bounded `status`, `final`, and `error` events while preserving the legacy JSON response path. The browser client negotiates SSE only for ordinary Assistant chat and automatically falls back to JSON. The native inference request itself still completes through the existing `/generate` JSON contract, so this stage does not claim token-by-token native streaming or lower native time-to-first-token. No provider/model/token/context/throughput/compute or authorization change and no migration.\n- Native token streaming runtime rollout: **DEFERRED** until the external Bonds Native runtime is upgraded and production-verified with a streaming generation contract.\n- Parallel Tool Execution: **MERGED / CI VERIFIED / PRODUCTION VERIFIED** عبر PR #482، Merge SHA `a8d2f695797659a1714bb8b8100f7e30164deba8`; post-merge CI وService Worker وDependency Security وProduction Release وProduction Authenticated Smoke ناجحة، وVercel READY لنفس SHA. لا توجد migration لهذه المرحلة.
- Critic / Verifier for Sensitive Tasks: **IMPLEMENTATION CANDIDATE / DETERMINISTIC / NO EXECUTION AUTHORITY** — يراجع structured actions الحساسة عبر policy/fingerprint والأدلة الاختيارية للتأكيد والموافقة البشرية دون نموذج ثانٍ أو multi-agent.
- العنصر التالي بعد دمج والتحقق الإنتاجي من Critic / Verifier: **Multi-model consensus only for critical tasks**؛ full multi-agent يبقى مؤجلًا.
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

---
## 2026-10-23 — Chat Orchestrator + Case Engine checkpoint

تمت إضافة طبقة تشغيل محادثية فوق البنية القائمة دون إنشاء مسار موازٍ:

- `lib/assistant/chat-orchestrator.js` لحسم Page/Session authority، تصنيف النية، اختيار الخدمة، واستدعاء Service Execution Layer عند وجود execution profile مسجل.
- `lib/assistant/case-engine.js` لحالات `discovery -> data_collection -> validation -> analysis -> review -> execution -> completed` مع Next Best Action مبني على المتطلبات المسجلة.
- الصفحة الرئيسية حالة رسمية `homepage/no_service_selected`.
- Page context لخدمة مسجلة يتغلب على session service context القديم، مع دعم `pathname + hash` لمسارات مثل `/services#analysis`.
- Human escalation يستخدم Agent Inbox القائم.
- الحساب/التحليل التشغيلي يمر عبر القدرة/المحرك المسجل؛ إذا فشل التنفيذ الحتمي لا يُستبدل بحساب من AI.
- الردود التشغيلية تحمل provenance وstructured UI envelope، والواجهة تعرض Markdown محدوداً عبر DOM آمن دون تنفيذ HTML من الرسالة.
- التخزين الدائم يعيد استخدام `assistant_workflow_state` وRPCs القائمة، ولا ينشئ authorization plane أو token architecture جديداً.
- Cost Governance الحالية تبقى observability-only ولا تُستخدم للحجب أو تقييد token/provider/model/compute.

الحالة النهائية: **MERGED + CI VERIFIED + PRODUCTION VERIFIED** عبر PR #462، Merge SHA `e2148f0cec5be44ca3516257cc1b612633cddb88`، مع Production Release وProduction Authenticated Smoke ناجحين.


---

## 2026-10-23 — Task Resume + Guest→Authenticated continuity checkpoint

- إعادة استخدام `assistant_workflow_state` وواجهات `/assistant/workflows/load|save` القائمة؛ لا مخزن جديد.
- إضافة lookup قراءة فقط `GET /assistant/workflows/resume?boundary=...` لاشتقاق workflow key canonical وتحميل حالة المستخدم نفسها.
- عند فتح الشات أو قبل الإرسال، إذا كان المستخدم مصادقاً عليه تُستأنف الحالة الدائمة لنفس Page/Service boundary.
- إذا لم توجد حالة دائمة وكانت هناك حالة Guest محلية ذات معنى، تُنقل عبر مسار `/assistant/workflows/save` القائم والمحكوم.
- إذا وجدت حالة دائمة وكانت حالة Guest أحدث، تُدمج حقول الاستمرارية الآمنة فقط؛ تبقى `pending_confirmation` من الخادم ولا تُنقل من Guest.
- لا تغيير في token/provider/model/context/throughput/compute ولا authorization plane جديد.
- الحالة الحالية: implementation candidate؛ تحتاج CI ثم الدمج والتحقق الإنتاجي قبل الإغلاق.

---
## 2026-10-23 — Latency-Aware Routing checkpoint

تم تنفيذ `latency_aware_routing` داخل `lib/ai/inference-router.js` دون إنشاء provider أو authorization plane جديد:

- ترتيب عقد Bonds Native المتاحة حسب EWMA لزمن الاستجابة المرصود مع فصل القياسات حسب العملية (`health` مستقل عن `generate`).
- لا يتم إجبار الاستكشاف؛ العقد غير المقاسة أو stale تبقى بترتيبها المهيأ، ولا يطبق ترتيب latency إلا عند وجود قياسين حاليين على الأقل لنفس العملية.
- circuit breaker وfailover الحاليان يظلان الحاكمين عند الأعطال.
- القياس لا يغير model/provider ولا يخفض tokens/context/compute/throughput.
- Assistant chat يفعّل هذا الترتيب صراحةً، بينما بقية مستهلكي Inference Router يحتفظون بالسلوك السابق ما لم يفعّلوه.
- response metadata تتضمن `native_node` و`failover_attempts` و`latency_routing` للتشخيص.
- لا توجد migration لهذه المرحلة.

الحالة: implementation candidate؛ لا تعتبر MERGED أو CI/PRODUCTION VERIFIED قبل إغلاق PR والتحقق من SHA الدمج.


---
## 2026-10-23 — Assistant Streaming checkpoint

- Added opt-in SSE transport on the existing Assistant chat path; legacy JSON remains unchanged for non-streaming clients.
- SSE events are limited to `status`, `final`, and `error`; no synthetic token `delta` events are emitted.
- The browser client requests SSE only for the ordinary Assistant chat route, parses the stream incrementally, and falls back to JSON when the response is not `text/event-stream`.
- The `inference` status explicitly reports `token_streaming:false`; the existing Bonds Native `/generate` endpoint still returns a complete JSON result.
- No change to provider, model, token architecture, context size, throughput, compute limits, authorization, or database schema.
- True native token streaming remains deferred until the external Bonds Native runtime can be upgraded and verified independently.

الحالة: implementation candidate؛ لا تعتبر MERGED أو CI/PRODUCTION VERIFIED قبل إغلاق PR والتحقق من SHA الدمج.


---

## 2026-10-23 — Parallel Tool Execution checkpoint

- تمت إضافة `lib/services/parallel-tool-execution.js` فوق `service-execution-router` القائم؛ لا Router أو Capability Plane أو Authorization Plane جديد.
- التنفيذ المتوازي متاح فقط لدفعة مهام تحمل `independent:true` صراحة.
- يتم فحص الدفعة كاملة قبل بدء أي تنفيذ: الخدمة موجودة، `capability_plan` فعّال، `primary_action` مسجل، والقدرة فعّالة.
- يسمح بالتوازي فقط للآثار التشغيلية المسجلة `none`, `database_read`, `network_read`, `compute`; أي write غير مصرح له بالتوازي يرفض قبل بدء الدفعة.
- كل مهمة تمر عبر `executeService` و`executeCapability` والحوكمة الحالية نفسها؛ لا تجاوز للـgovernance أو audit أو token broker.
- لا يعاد استخدام `x-bonds-service-token` الوارد بين مهام متوازية؛ كل مهمة تحصل على سياق توكن مستقل ويصدر لها broker token عند الحاجة وفق المسار القائم.
- فشل مهمة مستقلة لا يلغي المهام الشقيقة التي بدأت بعد نجاح preflight، وتعود النتيجة المجمعة بحالة كل مهمة.
- حجم الدفعة محدود تشغيليًا إلى 8 مهام مستقلة للحماية من fan-out غير المحدود؛ هذا ليس تخفيضًا أو تغييرًا في model/token/context/throughput/compute settings الخاصة بالاستدلال.
- نقطة API الجديدة `POST /assistant/services/execute-parallel` تحت Emergency/Read-only control plane القائم.
- لا يوجد تغيير provider/model/token/context/throughput/compute authorization، ولا توجد database migration لهذه المرحلة.

الحالة النهائية: **MERGED + CI VERIFIED + PRODUCTION VERIFIED** عبر PR #482، Merge SHA `a8d2f695797659a1714bb8b8100f7e30164deba8`. لا توجد migration لهذه المرحلة.


---

## 2026-10-23 — Sensitive Action Critic / Verifier checkpoint

- تمت إضافة `lib/assistant/sensitive-action-verifier.js` كمراجع حتمي للـstructured actions الحساسة؛ ليس agent جديدًا ولا نموذجًا ثانيًا.
- يقتصر النطاق على المخاطر `high` و`critical` ويعيد `verified_for_review` أو `rejected` مع checks محددة.
- يعيد استخدام `normalizeAction()` وسياسة Assistant القائمة و`actionFingerprint()`؛ لا policy plane أو authorization plane موازٍ.
- عند توفير confirmation evidence يتحقق من action ID وfingerprint ويرفض confirmation الملغاة أو المتغيرة.
- عند توفير Human Approval evidence يتحقق من fingerprint وrisk ويرفض `rejected` أو `cancelled`.
- حتى approval بحالة `approved` يظل دليل مراجعة فقط؛ `execution_authorized:false` و`auto_execute:false` و`authorization_source:false`.
- Human Approval يخزن نسخة sanitized من verifier evidence داخل `payload` الحالي؛ لا جدول أو migration جديدة.
- تمت إضافة `POST /assistant/sensitive-actions/verify` كمسار تقييم فقط؛ لا DB write ولا capability execution.
- `model_used:false` و`multi_agent:false` مثبتان في عقد النتيجة، ولا تغيير provider/model/token/context/throughput/compute.
- full multi-agent يبقى مؤجلًا وفق الخارطة.

الحالة النهائية: **MERGED + CI VERIFIED + PRODUCTION VERIFIED** عبر PR #486، Merge SHA `6ea6e453ed1e1e930d77da54ba85105573523ede`.


---

## 2026-10-23 — Critical Multi-model Consensus checkpoint

- تمت إضافة `lib/assistant/critical-multi-model-consensus.js` كمراجعة advisory للحالات `risk=critical` فقط.
- لا تعمل للحالات `high` أو الأقل؛ هذه تبقى تحت Critic/Verifier الحتمي وHuman Approval القائمين.
- تستخدم عقد Bonds Native Remote المهيأة داخل `InferenceRouter` الحالي؛ لا provider جديد ولا model routing بديل ولا architecture موازية.
- لا ترسل قيم `action.input` الخام إلى المراجعين؛ فقط metadata هيكلية وأسماء المفاتيح وaction fingerprint.
- لا تعتبر النتيجة Multi-Model إلا عند نجاح مراجعتين على الأقل بهويتي `model_sha256` مختلفتين فعليًا؛ replica لنفس النموذج لا يحتسب كنموذج ثانٍ.
- عدم توفر عقدتين/نموذجين مختلفين أو فشل المراجعات يعيد `not_available` دون اختلاق consensus.
- اختلاف النماذج يعاد صراحة كـ`no_consensus`؛ لا يوجد تصويت يخفي الخلاف.
- consensus يرفق كدليل داخل Human Approval للحالات الحرجة فقط، ويبقى `execution_authorized:false`, `auto_execute:false`, `authorization_source:false`.
- إعادة Human Approval بنفس idempotency key لا تعيد تشغيل المراجعين.
- لا تغيير provider/model/token/context/throughput/compute ولا database migration، وfull multi-agent يبقى مؤجلًا.

الحالة النهائية: **MERGED + CI VERIFIED + PRODUCTION VERIFIED** عبر PR #501، Merge SHA `c27e853a5180fc4be735c478b3ffab0815658811`; Production Release وProduction Authenticated Smoke ناجحان، وVercel READY لنفس SHA. لا توجد migration لهذه المرحلة.


---

## 2026-10-23 — Synthetic Production Journeys checkpoint

- تمت إضافة `lib/assistant/synthetic-production-journeys.js` كسجل وتشغيل لرحلات إنتاج اصطناعية authenticated بعد النشر.
- الرحلات الحالية محدودة ومتعمدة: Assistant readiness/introspection/emergency-mode، navigation planning، policy dry-run، workflow resume read، وقراءة execution profile لخدمة `cash_generation_analysis`.
- لا تحفظ نموذجًا، لا تنشئ طلب تمويل، لا تغيّر workflow business state، ولا تستدعي service execution؛ `writes_performed:false` و`business_records_created:false` و`execution_authorized:false` جزء من عقد النتيجة.
- runner يعاد استخدام جلسة E2E الإنتاجية الحالية ويعمل داخل `Production Authenticated Smoke` بعد قبول Assistant الأساسي.
- الفشل في أي invariant أو drift في execution profile يفشل smoke بدل إخفاء الانحراف.
- transient 429 يعاد مرة واحدة فقط مع Retry-After bounded؛ لا retry للكتابة لأنه لا توجد كتابة أعمال في هذه الرحلات.
- تمت إضافة اختبارات عقدية محلية لضمان بقاء الرحلات bounded وعدم استدعاء مسارات business-write.
- لا provider/model/token/context/throughput/compute أو authorization change، ولا database migration.

الحالة الحالية: **MERGED / CI VERIFIED / PRODUCTION VERIFIED**.

أدلة الإغلاق:
- تنفيذ المرحلة الأصلي: PR #508، Merge SHA `f9554f88253cd27089b0321ca54997f21a83a117`.
- فشل التحقق الإنتاجي الأول كشف خلل `workflow_resume_read`; PR #513 جرّب عزل ترتيب rate-limit لكنه لم يحسم الخلل إنتاجيًا.
- الإصلاح الجذري النهائي: PR #516، Merge SHA `247f388e7f4fe92d3dd17bdaebacc5d9bf140974`، لتطبيع composite RPC result في `loadWorkflowState`.
- Post-merge CI: run `39919002653` — SUCCESS.
- Service Worker: run `39919002732` — SUCCESS.
- Dependency Security: run `39919002650` — SUCCESS.
- Production Release: run `39919529225` — SUCCESS.
- Production Authenticated Smoke: run `39919709924` — SUCCESS.
- Synthetic Production Journeys: الخمس رحلات PASS، بما فيها `workflow_resume_read` و`service_execution_profile_read`.
- Vercel Production: deployment `dpl_AAz1fPHzQn4eRDEmHooM3nSWPy4M` — READY لنفس Merge SHA.
- لا توجد migration لهذه المرحلة.
- PR #509 أُغلق دون دمج باعتباره تنفيذًا مكررًا.
- العنصر التالي حسب خارطة Assistant: **Golden Conversations** (`golden_conversations`).

## Golden Conversations — Production Verified

- Implementation PR: #522.
- Merge SHA: `41e5a382895a4f78b36f94b48fc89f102336f617`.
- Post-merge CI: run `39921695505` — SUCCESS.
- Service Worker: run `39921695476` — SUCCESS.
- Dependency Security: run `39921695578` — SUCCESS.
- Production Release: run `39922242977` — SUCCESS.
- Production Authenticated Smoke: run `39922439691` — SUCCESS.
- Vercel Production: deployment `dpl_3a4SB5ZfQACPdvVTomZaY7Pcr5sh` — READY for the exact Merge SHA.
- No migration for this stage.
- Status: MERGED / CI VERIFIED / PRODUCTION VERIFIED.
- Next Assistant roadmap item: **Assistant Evaluations** (`assistant_evaluations`).


---

## 2026-10-23 — Assistant Evaluations checkpoint

- تمت إضافة `lib/assistant/assistant-evaluations.js` كطبقة تقييم حتمية فوق Golden Conversations المعتمدة؛ لا تنشئ planner أو runtime موازيًا.
- التقييم يقيس structural accuracy الكلية، ready-flow accuracy، denial-flow accuracy، ودقة اللغتين العربية والإنجليزية.
- جميع بوابات Golden v1 مطلوبة بنسبة 100%؛ أي drift معروف يفشل التقييم بدل تخفيف العتبات أو تطبيع الخطأ.
- corpus غير الصالح يرفض قبل التشغيل، مع إرجاع evidence من validator القائم.
- التقييم لا يستدعي provider/model، ولا ينفذ tools أو business writes، ولا يمنح execution authority؛ `execution_authorized:false` و`writes_performed:false` جزء من عقد النتيجة.
- تمت إضافة regression tests للفشل عند planner drift، corpus authority drift، وcontext-code drift.
- لا تغيير provider/model/token/context/throughput/compute أو authorization، ولا database migration.
- الحالة النهائية: **MERGED / CI VERIFIED / PRODUCTION VERIFIED**.

أدلة الإغلاق:
- Implementation PR: #527.
- Merge SHA: `8b45d942be4ecfcc15b6cbf3efc80a616e2489a8`.
- Post-merge CI: run `39948593154` — SUCCESS.
- Service Worker: run `39948593042` — SUCCESS.
- Dependency Security: run `39948593093` — SUCCESS.
- Production Release: run `39949138040` — SUCCESS.
- Production Authenticated Smoke: run `39949336163` — SUCCESS.
- Vercel Production: deployment `dpl_8opzr7t6w19h1v72xNAqU8x2ERX4` — READY لنفس Merge SHA.
- `/api/health`: `ok` على version `8b45d94`.
- `/api/readiness`: `ready` على version `8b45d94`.
- Migration: N/A.
- العنصر التالي: **Red Team Scenarios** (`red_team_scenarios`).


---

## Red Team Scenarios — Production Verified

- Implementation PR: #531.
- Merge SHA: `818ad1795215325a39584f5ce2bd84dfcd6a27db`.
- Post-merge CI: run `39951589185` — SUCCESS.
- Service Worker: run `39951589116` — SUCCESS.
- Dependency Security: run `39951589189` — SUCCESS.
- Production Release: run `39952247079` — SUCCESS.
- Production Authenticated Smoke: run `39952481837` — SUCCESS.
- Vercel Production: deployment `dpl_ZeDQosEhjbc74Gw3552X2JJmYcc7` — READY for the exact Merge SHA.
- Migration: N/A.
- No provider/model/token/context/throughput/compute/authorization semantics changed.
- Status: MERGED / CI VERIFIED / PRODUCTION VERIFIED.
- Next Assistant roadmap item: **End-to-End CI Journeys** (`end_to_end_ci_journeys`).


## 2026-11-01 — End-to-End CI Journeys checkpoint
- **STATUS: IMPLEMENTED / MERGED / CI VERIFIED / PRODUCTION VERIFIED**.
- PR #817 merged as `3020d30f2ca561032c37311c0bdeaa0234e5d39f`.
- Explicit release gate: `npm run test:assistant:e2e-ci`, wired as `Run Assistant End-to-End CI Journeys` before the broad Unit/Integration suite.
- Verified journeys cover: safe plan → idempotency claim → sanitized execution evidence → replay → immutable audit lifecycle; sensitive confirmation + approved human-review evidence while preserving `execution_authorized:false`, `auto_execute:false`, and `authorization_source:false`; and fail-closed payload/fingerprint drift plus idempotency key conflict.
- PR checks passed: CI `41340528582`, Dependency Security `41340528528`, Service Worker `41340528665`.
- Post-merge checks passed on exact merge SHA: CI `41341037773`, Dependency Security `41341037763`, Service Worker `41341037790`.
- Production Release #964 / run `41341426359` passed stage, smoke, current-main verification, promotion, exact Production SHA verification, and webhook method guard.
- Vercel deployment `dpl_7eUrcyQuKtQarVHK5iJkPrbRbjPR` is READY for exact SHA `3020d30f2ca561032c37311c0bdeaa0234e5d39f`.
- Production `/api/health` returned 200/`ok` version `3020d30`; `/api/readiness` returned 200/`ready` with Supabase, Native, Token Runtime, User Governance, Assistant, Assistant Chat, and Web Search healthy; runtime error scan returned zero errors.
- No migration, new runtime endpoint, authorization plane, provider/model/token/context/compute/throughput change, or production business-write path was introduced by this workstream.
- Next Assistant roadmap item: **Outcome Analytics** (`outcome_analytics`).


## 2026-11-01 — Outcome Analytics checkpoint
- **STATUS: IMPLEMENTED / MERGED / CI VERIFIED / PRODUCTION VERIFIED**.
- PR #819 merged as `1838681dee33a2fabf96506a2925a4e1a9b3a53e`.
- Outcome Analytics remains **read-only deterministic** and reuses the existing `assistant_action_audit` immutable evidence plus the existing Assistant Operations API/UI; no table, migration, endpoint, or authorization plane was added.
- Measurement is action-level: for each `action_id`, the latest terminal audit event inside the selected window determines `succeeded / failed / denied / uncertain / replayed`.
- Exposed metrics include distinct/measured/unmeasured actions, outcome coverage, outcome success rate, terminal outcome counts, and breakdown by `action_type`; when no terminal evidence exists, the result is explicitly `UNKNOWN`.
- PR checks passed on head `575b1edfbad05fa07c856aaf88c92b8ce86067cd`: CI `41343346219`, Dependency Security `41343346290`, Service Worker `41343346170`. An unrelated admin-module navigation timeout was verified transient by rerunning the same CI job on the unchanged SHA, which then passed.
- Post-merge checks passed on exact merge SHA: CI `41344171143`, Dependency Security `41344171142`, Service Worker `41344171154`, with Token Runtime Windows acceptance and the explicit Assistant E2E gate also passing. A second unrelated admin-module navigation timeout was likewise resolved by rerunning the failed job on the unchanged merge SHA.
- Production Release #968 / run `41345004817` passed stage, smoke, current-main verification, promotion, exact Production SHA verification, and webhook method guard.
- Vercel deployment `dpl_52SFgKmVLHkYwusQ2sAYAhzVuEGH` is READY for exact SHA `1838681dee33a2fabf96506a2925a4e1a9b3a53e`.
- Production `/api/health` returned 200/`ok` version `1838681`; `/api/readiness` returned 200/`ready` with Supabase, Native, Token Runtime, User Governance, Assistant, Assistant Chat, and Web Search healthy; runtime error scan returned zero errors.
- No raw user identifiers, raw audit metadata, execution authority, provider/model/token/context/compute/throughput change, or business-write path was introduced by this workstream.
- Next Assistant roadmap item: **Journey Analytics** (`journey_analytics`).


## 2026-11-01 — Journey Analytics checkpoint
- تمت إضافة Journey Analytics كطبقة **read-only deterministic** داخل لوحة Assistant Operations الحالية، فوق سجل `assistant_action_audit` immutable نفسه؛ لا جدول أو migration أو endpoint جديد.
- تعريف الرحلة داخليًا يعتمد على المفتاح المركب `boundary + session_id` الموجود أصلًا في سجل التدقيق، مع عدم عرض raw session IDs أو raw boundaries أو raw user identifiers.
- كل رحلة تجمع الإجراءات المميزة ثم تستخدم أحدث terminal audit event لكل `action_id` لتحديد الحالة: `completed / failed / denied / uncertain / incomplete`.
- تعرض الطبقة: إجمالي الرحلات، المكتملة، الفاشلة، المرفوضة، غير المؤكدة، غير المكتملة، completion rate، audit-incomplete drop-off proxy، outcome coverage، ومتوسط/وسيط زمن إكمال الرحلات المكتملة.
- `dropoff_proxy_rate` هو **مؤشر نقص دليل تدقيقي فقط** وليس إثباتًا أن المستخدم تخلّى عن الرحلة.
- لا execution authority، ولا business writes، ولا provider/model/token/context/compute/throughput change.
- الحالة النهائية: **IMPLEMENTED / MERGED / POST-MERGE CI VERIFIED / DEPLOYED / PRODUCTION VERIFIED**.
- Implementation PR: #823.
- Merge SHA: `10c92aa7f908e05ef51e23e153235fa96db62a3b`.
- Post-merge CI: `41347911188` — SUCCESS.
- Post-merge Dependency Security: `41347911240` — SUCCESS.
- Post-merge Service Worker: `41347911184` — SUCCESS.
- Production Release: `41348378455` — SUCCESS.
- Vercel Production deployment: `dpl_DSwArxWjk2FoHEHXHpZ5TxG7PVoY` — READY for exact SHA `10c92aa7f908e05ef51e23e153235fa96db62a3b`.
- Production Authenticated Smoke: `41348527170` — SUCCESS, including `planner-telemetry`.
- Production `/api/health`: HTTP 200 / `ok`, version `10c92aa`.
- Production `/api/readiness`: HTTP 200 / `ready`; Supabase, Native, Token Runtime, User Governance, Assistant, Assistant Chat, and Web Search = `ok`.
- Runtime error scan: zero errors in the verified post-release window.
- Next Assistant roadmap item: **Conversion Metrics** (`conversion_metrics`).
