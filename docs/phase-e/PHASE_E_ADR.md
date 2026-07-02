# Phase E — Enterprise Executive Command Center (ECC)

## Architecture Decision Record

> **Status:** Approved  
> **Date:** 2026-07-02  
> **Scope:** Build a project-centric command layer that turns BONDS from a toolkit into an Enterprise AI Operating System.

---

## 1. Context

BONDS has built powerful engines across Phases A-D:

- Universal Calculation Platform (UCP)
- Trusted Data Fabric
- Enterprise Intelligence Layer
- Investment Intelligence Suite
- Enterprise Lifecycle Engine
- Digital Twin, Context Memory, Confidence, Explainability

However, users still navigate between calculators, reports, admin modules, and standalone pages. There is no single place where a user sees **their project**, its health, next action, and AI guidance.

The strategic goal is to make BONDS an **Enterprise AI Operating System for investment lifecycle management**. The first step is a Minimum Viable Command Center focused on one project at a time.

## 2. Decision

Build **Phase E.0: Project Command Center MVP** with these constraints:

- **No new calculation engines.** All numbers come from UCP and existing engines.
- **No new dashboards per module.** Everything appears inside the Project Command Center.
- **Metadata-driven status.** The aggregator reads from existing tables and engines.
- **AI narrates only.** The AI Chief Advisor explains, recommends, and answers questions; it does not decide transitions or change numbers.
- **Single project home.** `v3/project/index.html?id=PROJECT_ID` becomes the default destination for a project.

## 3. Module Structure

```
lib/ecc/
  project-status-aggregator.js   # Aggregates all project intelligence
  index.js                       # Public API

v3/api/ecc.js                    # ECC router
v3/project/index.html            # Project Command Center UI
v3/project/project-command-center.js
v3/components/ai-chat-widget.js  # Enhanced for project context

lib/digital-twin/digital-twin.js # Auto-fetch dependencies by projectId
lib/ai/prompts.js                # ecc_advisor prompt template
```

## 4. API Surface

New routes under `/api/v3/ecc/*`, consolidated in `v3/api/index.js`:

- `POST /ecc/project-status` — unified project status aggregator
- `POST /ecc/advisor` — AI Chief Advisor context-aware chat

## 5. Integration Points

| Existing Engine | ECC Integration |
|---|---|
| Investment Intelligence | Readiness score, memorandum, AI review |
| Enterprise Intelligence | Recommendations, blind spots, decision graph |
| Enterprise Lifecycle | Current stage, allowed transitions, timeline, tasks, approvals |
| Digital Twin | Snapshot of project + market + indicators |
| Confidence Engine | Aggregate confidence across sources |
| AI Orchestrator | AI Chief Advisor replies |
| UCP | Source of all financial numbers |

## 6. Out of Scope (Future Phases)

- Smart Notifications system
- Executive Search / vector RAG
- Full Role Awareness for founder/CEO/investor/bank/government
- Project Radar with live feeds
- Full Action Center with assignments/delegation
- Multi-project portfolio views

## 7. Consequences

### Positive
- Users finally have a single project home.
- All existing engines become services behind one command layer.
- Low risk because nothing is reimplemented; only aggregated.
- Foundation for D.2/D.3/D.4 investor-facing features.

### Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Aggregator performance | Promise.all parallel fetches; caching in future phase |
| AI hallucination | Strict prompt guardrails + rule-based fallback |
| RLS blocks multi-user view | Document as future role-based RLS work |

## 8. Compliance

- No new calculation engine.
- No duplicate financial tables.
- All numbers sourced from UCP/existing engines.
- Evidence + Confidence attached to aggregated status.
- AI only narrates; transitions remain governed by Lifecycle Engine.
