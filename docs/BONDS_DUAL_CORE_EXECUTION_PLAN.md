# BONDS Dual-Core Execution Plan

## Phase 0 — Persistent Project Memory

الهدف: منع فقدان السياق أو إعادة العمل بعد محادثة جديدة أو إعادة تشغيل الجهاز.

### P0.1
- Project bootstrap
- Master architecture
- Decision register
- Invariants
- Machine-readable roadmap
- Current-state contract

### P0.2
- Persistent checkpoint library
- Atomic local checkpoint file
- Resume validation
- Corruption detection
- Tests

### P0.3
- Local SQLite checkpoint store
- Remote checkpoint metadata
- Recovery precedence rules
- Resume-after-reboot flow

معيار الإغلاق:
- محادثة/عامل جديد يستطيع تحديد آخر نقطة بدقة.
- restart لا يعيد completed work.
- تضارب state/Git يكتشف ويفشل بأمان.

## Phase 1 — Dual-Core Foundation

- Dynamic Intelligence Bus
- Shared event taxonomy
- Evolution state machine
- Runtime Capability Profiler
- Resource Scheduler
- Core A/Core B priority arbitration

## Phase 2 — Learning Foundation

- Assistant outcome events
- Gap/defect detection
- Learning proposal engine
- evidence aggregation
- proposal risk classification

## Phase 3 — Candidate Engineering

- System Map
- Impact Analyzer
- Candidate Manager
- BondsNative code-provider adapter
- Patch Engine
- focused test selection
- Autonomous Repair Loop
- stuck-loop detector
- Engineering Memory

## Phase 4 — Approval & Integration

- APPROVED_TARGET
- partial approvals
- dependency checks
- SHA-bound approval
- integration resolver
- assistant/capability registry sync

## Phase 5 — CI / Release

- GitHub CI failure intake
- automatic rebase
- merge simulation
- staged release
- production verification
- known-good releases
- rollback orchestration

## Phase 6 — Self-Training

- dataset registry
- de-identification
- training queue
- model registry
- candidate model benchmark
- model promotion/rollback

## Phase 7 — Control Center

- Assistant
- Learning
- Training
- Evolution
- Capabilities
- Models
- Approvals
- Releases
- Health
- Audit

## التنفيذ حسب العتاد

لا تسقط أي مرحلة بسبب العتاد.
المهام غير الممكنة حاليًا تسجل `WAITING_FOR_CAPACITY`.
