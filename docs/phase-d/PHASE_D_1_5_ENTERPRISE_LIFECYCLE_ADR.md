# Phase D.1.5 — Enterprise Lifecycle Engine

## Architecture Decision Record

> **Status:** Approved  
> **Date:** 2026-07-02  
> **Scope:** Build a single, registry-driven Enterprise Lifecycle backbone for all current and future investment stages.

---

## 1. Context

Phase D.1 added Investment Intelligence capabilities (readiness, memorandum, story, AI review, versioning). However, there was no unified workflow governing:

- Which stage runs first.
- When a project may advance.
- Who approves advancement.
- What evidence and confidence are required.
- How to roll back or branch.

Without this backbone, D.2 (Investor-Facing Documents), D.3 (Investor Ecosystem & Deal Flow), and D.4 (Execution & Monitoring) would each re-implement their own stage logic, leading to duplication and drift.

## 2. Decision

Build a generic **Enterprise Lifecycle Engine** that is:

- **Registry-driven**: workflows, stages, transitions, gates, tasks, and approvals are metadata.
- **Entity-agnostic**: supports projects, assets, reports, certificates, and future entities.
- **UCP/Fabric-backed**: all financial thresholds and data completeness checks delegate to existing engines.
- **Evidence + Confidence**: every gate, transition, and approval carries evidence and a confidence score.
- **Backward compatible**: existing Investment Intelligence APIs remain untouched and become consumers.

## 3. Module Structure

```
lib/enterprise-lifecycle/
  lifecycle-engine.js            # orchestrator
  lifecycle-registry.js          # workflow + stage definitions
  state-machine.js               # single-state enforcement
  transition-engine.js           # gate + approval + side-effects
  gate-engine.js                 # pluggable guard evaluators
  workflow-graph.js              # paths, critical path, blocked paths
  task-engine.js                 # stage task generation
  approval-engine.js             # single/multi/sequential/parallel/committee
  event-bus.js                   # lifecycle events
  timeline-engine.js             # unified timeline builder
  audit-logger.js                # decision checkpoints
  integrations/                  # adapters to UCP, Fabric, Investment Intelligence, etc.
  definitions/                   # static workflow JSON files
```

## 4. Database Schema

A single migration (`20260725000000_enterprise_lifecycle_engine.sql`) creates:

- `enterprise_lifecycle_workflows`
- `enterprise_lifecycle_stages`
- `enterprise_lifecycle_instances`
- `enterprise_lifecycle_transitions`
- `enterprise_lifecycle_gate_evaluations`
- `enterprise_lifecycle_approvals`
- `enterprise_lifecycle_tasks`
- `enterprise_lifecycle_events`
- `enterprise_lifecycle_timeline`

All tables include RLS, comments, indexes, and `updated_at` triggers.

## 5. API Surface

New routes under `/api/v3/enterprise-lifecycle/*` are consolidated in `v3/api/index.js` (no new Vercel function):

- `GET  /definitions`
- `GET  /definitions/:entityType`
- `POST /instances`
- `GET  /instances/:id` / `/state` / `/history` / `/timeline` / `/tasks`
- `POST /instances/:id/transition`
- `POST /instances/:id/validate`
- `POST /instances/:id/gates/:gateId/evaluate`
- `GET/POST /instances/:id/approvals`
- `POST /instances/:id/approvals/:approvalId/decision`
- `POST /instances/:id/events`

## 6. Integration Points

| Existing Engine | Lifecycle Integration |
|---|---|
| Investment Intelligence | Readiness/memorandum/review results become stage gate evidence. |
| UCP | Financial threshold guards run via UCP. |
| Trusted Data Fabric | Data completeness/freshness guards use Fabric. |
| Confidence Engine | Gate scores are combined into transition confidence. |
| Explainability Engine | Transition rationale is generated for every move. |
| Decision Memory | Every transition is recorded as a decision. |
| Digital Twin | Major transitions snapshot entity state. |
| Decision Timeline | Lifecycle events are mirrored to the existing timeline. |

## 7. Consequences

### Positive
- A single source of truth for lifecycle logic.
- Future D.2/D.3/D.4 modules are consumers, not owners, of stage logic.
- No hard-coded transitions or sector-specific workflows.
- Full auditability and explainability of every stage change.

### Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Adoption by existing pages | Existing APIs are unchanged; UI migration is optional and incremental. |
| Performance of adapter chain | Adapters are optional and fail gracefully; no adapter blocks the transition. |
| Supabase function limit | All routes reuse the single `v3/api/index.js` handler. |

## 8. Compliance

- No new calculation engine created.
- No duplicate financial tables.
- All numbers sourced from UCP/Fabric.
- Evidence + Confidence attached to every gate/transition/approval.
- AI only narrates; guards decide.
