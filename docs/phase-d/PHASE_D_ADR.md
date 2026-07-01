# Phase D.1 — Investment Intelligence Suite (BIIS)

**Status:** Implemented  
**Date:** 2026-06-24  
**Scope:** Phase D — Foundation + Core Intelligence

---

## 1. Context

BONDS already produces valuations, feasibility studies, financing structures, and risk assessments through UCP, Fabric, and the Enterprise Intelligence Layer. Phase D turns those outputs into **investment-ready documents** without building a traditional document editor or re-entering data.

---

## 2. Decision

1. Build a new `lib/investment-intelligence/` layer for Phase D.
2. All numbers come from UCP via `lib/orchestrator/ucp-bridge.js`.
3. Project data is read from canonical tables `bonds_projects`, `bonds_assets`, `bonds_valuations`, `bonds_financing`.
4. New tables are BIIS-specific only (`investment_memoranda`, versions, readiness scores, AI reviews).
5. AI is used only for narrative and review, never for calculation.
6. Documents are generated as interactive HTML first; PDF/Print uses existing frontend tools.

---

## 3. Architecture

```
bonds_projects / bonds_assets / bonds_valuations / bonds_financing
        │
        ▼
project-resolver.js ──► UCP Bridge ──► UCP outputs
        │
        ▼
Investment Readiness Engine
Investment Memorandum Engine
Investment Story Engine  ──► AI Orchestrator (narrative)
AI Investment Review Engine ──► AI Orchestrator (review)
Versioning Engine
Document Generator (HTML)
        │
        ▼
v3/api/investment-intelligence.js
admin/investment-intelligence/index.html
```

---

## 4. Components

| File | Responsibility |
|---|---|
| `lib/investment-intelligence/project-resolver.js` | Fetch canonical project data and run UCP |
| `lib/investment-intelligence/investment-readiness-engine.js` | Data-completeness/readiness score |
| `lib/investment-intelligence/investment-memorandum-engine.js` | Build all IM sections from platform data |
| `lib/investment-intelligence/investment-story-engine.js` | Generate the seven investor "whys" |
| `lib/investment-intelligence/ai-investment-review.js` | AI review before approval |
| `lib/investment-intelligence/versioning-engine.js` | Version create/list/compare |
| `lib/investment-intelligence/document-generator.js` | HTML renderer |
| `lib/investment-intelligence/index.js` | Public API |
| `v3/api/investment-intelligence.js` | API router |
| `admin/investment-intelligence/index.html` | Admin module UI |

---

## 5. Database Changes

Migration: `supabase/migrations/20260724000000_phase_d_investment_intelligence_core.sql`

- `investment_memoranda` — generated memoranda/teaser/one-pager/CIM.
- `investment_memoranda_versions` — content history.
- `investment_readiness_scores` — readiness analysis.
- `ai_investment_reviews` — AI review verdicts.

All tables link to `bonds_projects` and `auth.users` with RLS.

---

## 6. Quality Gates

- ✅ No new calculation engine.
- ✅ No duplicate financial data tables.
- ✅ All financial numbers from UCP.
- ✅ Evidence + Confidence attached to every document.
- ✅ AI does not invent numbers.
- ✅ Versioning from first save.
- ✅ Routes consolidated in `v3/api/index.js`.
