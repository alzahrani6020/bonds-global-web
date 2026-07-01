# Wave 4.3 — Enterprise Intelligence Layer

**Status:** Implemented  
**Date:** 2026-06-24  
**Owner:** BONDS Engineering  
**Scope:** Phase C — Wave 4.3

---

## 1. Context

Wave 4.1 made BONDS intent-first and Wave 4.2 made every value trusted. Wave 4.3 turns the platform into an **Enterprise Intelligence System** where multiple specialized engines run together, detect blind spots, build a decision graph, and synthesize a single ranked set of actions — all while preserving UCP as the single source of financial calculation truth.

---

## 2. Decision

1. **Create a unified `lib/enterprise-intelligence/` layer** that catalogs, dispatches, and wraps every BONDS engine.
2. **No new financial calculation engines.** Valuation, financing, feasibility, market, and risk metrics continue to come from the UCP bridge.
3. **Wrap standalone engines** (valuation, risk, opportunity, scenario, recommendation) into a single canonical `{ output, confidence, evidence[], engine, status }` contract.
4. **Add meta-engines** that operate on the outputs of other engines:
   - `BlindSpotEngine` — detects missing engines, low confidence, contradictions, missing inputs, and weak fabric sources.
   - `DecisionGraphEngine` — builds a graph of the decision pipeline, finds the critical path, bottlenecks, and next action.
   - `RecommendationSynthesizer` — merges base recommendations, mitigations, and engine insights into ranked actions.
5. **Feed engines through the Trusted Data Fabric** while allowing the layer to run standalone.
6. **Expose all capabilities through `/api/v3/intelligence/*`** inside the consolidated V3 router to respect the Vercel Hobby function limit.

---

## 3. Architecture

```
User Request
   │
   ▼
Enterprise Intelligence Runner  ←  lib/enterprise-intelligence/runner.js
   │
   ├── Registry — intent → engine list   (registry.js)
   ├── UCP Bridge (when needed)          (lib/orchestrator/ucp-bridge.js)
   ├── Trusted Data Fabric (optional)    (lib/fabric/)
   │
   ▼
Engine Adapter                        (engine-adapter.js)
   │
   ├── Valuation Engine                 (valuation/valuation-engine.js)
   ├── Risk Intelligence Engine         (valuation/risk-intelligence-engine.js)
   ├── Opportunity Scoring Engine       (v3/engine/OpportunityScoringEngine.js)
   ├── Scenario Engine                  (v3/engine/ScenarioEngine.js)
   ├── Adaptive Recommendation Engine   (lib/recommendation/adaptive-recommendation.js)
   ├── UCP-derived engines              (feasibility, financing, market)
   │
   ▼
Meta-Engines
   ├── Blind Spot Engine                (blind-spot-engine.js)
   ├── Decision Graph Engine            (decision-graph-engine.js)
   └── Recommendation Synthesizer       (recommendation-synthesizer.js)
   │
   ▼
Unified Result
   { engines, confidence, evidence[], recommendation, blindSpots, decisionGraph, trace }
```

---

## 4. New Components

| File | Responsibility |
|---|---|
| `lib/enterprise-intelligence/registry.js` | Catalog of engines; intent-to-engine resolution |
| `lib/enterprise-intelligence/runner.js` | Dispatch, UCP/fabric wiring, confidence/evidence aggregation, persistence |
| `lib/enterprise-intelligence/engine-adapter.js` | Canonical wrapper for every standalone engine |
| `lib/enterprise-intelligence/blind-spot-engine.js` | Detect gaps, contradictions, low confidence, missing inputs |
| `lib/enterprise-intelligence/decision-graph-engine.js` | Decision graph, critical path, bottleneck, next action |
| `lib/enterprise-intelligence/recommendation-synthesizer.js` | Ranked action synthesis across engines |
| `lib/enterprise-intelligence/index.js` | Public API |
| `v3/api/intelligence.js` | `/api/v3/intelligence/*` route handler |
| `supabase/migrations/20260723000000_enterprise_intelligence_layer.sql` | `enterprise_intelligence_runs`, `_graphs`, `_recommendations` tables + RLS |

---

## 5. Database Changes

Migration: `supabase/migrations/20260723000000_enterprise_intelligence_layer.sql`

- `enterprise_intelligence_runs` — audit trail of every intelligence run (request, inputs, full result).
- `enterprise_intelligence_graphs` — persisted decision graph snapshots.
- `enterprise_intelligence_recommendations` — persisted synthesized recommendations.
- RLS policies isolate runs to their owning `user_id`.

---

## 6. API Contract

### POST `/api/v3/intelligence/run`

Request body:
```json
{
  "intent": "feasibility",
  "sector": "restaurant",
  "country": "SA",
  "city": "riyadh",
  "values": {
    "annual_revenue": 2000000,
    "operating_expenses": 1200000,
    "loan_amount": 500000
  },
  "engines": ["valuation", "risk", "feasibility", "blind_spot", "decision_graph", "recommendation_synthesizer"]
}
```

Response:
```json
{
  "engines": { "valuation": { ... }, "risk": { ... }, ... },
  "confidence": 78,
  "evidence": [ ... ],
  "recommendation": { "actions": [ ... ], "top": { ... } },
  "blindSpots": { "blindSpots": [ ... ], "count": 2 },
  "decisionGraph": { "nodes": [ ... ], "edges": [ ... ], "criticalPath": [ ... ], "bottleneck": { ... } },
  "trace": { "engines": [ ... ], "timestamp": "2026-06-24T..." }
}
```

### GET `/api/v3/intelligence/engines`

Returns the list of registered engines with metadata.

### POST `/api/v3/intelligence/adapt`

Runs a single engine adapter directly:
```json
{ "engine": "blind_spot", "intent": "feasibility", "engineResults": { ... } }
```

### POST `/api/v3/intelligence/synthesize`

Runs the recommendation synthesizer on provided engine outputs.

---

## 7. Engine Registry Defaults

| Intent | Default engines |
|---|---|
| `value_asset` / `buy_asset` / `sell_asset` / `revalue` | valuation, risk, financing/market, recommendation, meta-engines |
| `feasibility` / `investment` | valuation, risk, feasibility, scenario, recommendation, meta-engines |
| `expansion` / `market_analysis` | market, opportunity, recommendation, meta-engines |
| `request_financing` | risk, financing, valuation, recommendation, meta-engines |
| `risk_analysis` | risk, meta-engines |
| `compare_scenarios` | scenario, valuation, risk, meta-engines |

---

## 8. Confidence & Evidence Rules

- Every engine returns a `confidence` 0–100.
- Evidence is normalized to `{ engine, source, evidence_type, evidence_code, value, confidence, reason, timestamp, metadata }`.
- Aggregate confidence is a weighted average using per-engine `confidenceWeight` from the registry.
- UCP-derived engines inherit UCP confidence; standalone engines compute their own.
- The `BlindSpotEngine` confidence is high when few/weak blind spots are found.
- The `DecisionGraphEngine` confidence is the average node confidence.

---

## 9. Guardrails

- **All financial calculations go through UCP.** The Enterprise Intelligence Layer only wraps and interprets UCP results; it does not introduce new calculation logic.
- **No new Vercel functions.** All `/intelligence/*` endpoints are routed through `v3/api/index.js`.
- **No secrets in frontend.** The layer is server-only.
- **Persistence is best-effort.** A Supabase insert failure does not fail the API response.
