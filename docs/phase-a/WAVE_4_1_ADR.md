# Wave 4.1 — Intent-First UX & UCP Integration

**Status:** Implemented  
**Date:** 2026-06-24  
**Owner:** BONDS Engineering  
**Scope:** Phase C — Wave 4.1 (Intent-First UX, Dynamic Forms, UCP-backed engine orchestration)

---

## 1. Context

Previous waves built a complete decision pipeline in isolation:

- **Wave 2A** — Intent Engine, Semantic Layer, Decision Context, Dynamic Form Engine, Auto-Population, Business Rules, Explainability, Confidence.
- **Wave 2B** — Adaptive Intelligence Layer (profiles, predictive input, decision timeline, digital twin, learning loop).
- **Wave 3** — Universal Calculation Platform (UCP) with 15+ registries, DAG-based calculation, safe expression evaluation, evidence, and scenarios.

Wave 4.1 connects these layers into a single user-facing flow: the user states a goal, the system detects intent, builds a dynamic form, auto-populates it, runs the calculation through UCP, and returns an explained, confidence-scored result.

---

## 2. Decision

1. **No new calculation engines.** All quantitative results continue to be produced by the Universal Calculation Platform (`lib/ucp`).
2. **Engine facades delegate to UCP.** The Intelligence Orchestrator’s `feasibility`, `valuation`, `financing`, and `risk` runners are now thin translators that invoke UCP and reshape its outputs.
3. **Introduce a UCP Bridge.** `lib/orchestrator/ucp-bridge.js` maps semantic form values to canonical UCP inputs and derives engine-shaped results, risk flags, and a primary `resultValue` from UCP outputs.
4. **Expose canonical orchestrator endpoints under `/api/v3/orchestrate`.**
   - `GET /api/v3/orchestrate/intents`
   - `POST /api/v3/orchestrate/form` (returns dynamic form + auto-populate)
   - `POST /api/v3/orchestrate` (runs full pipeline)
5. **Build an Intent-First entry page.** `wave4/index.html` hides sector selection by default and asks the user for a goal in natural language.
6. **Keep `/wave4/*` aliases** for backward compatibility with the prototype page during the pilot.

---

## 3. Architecture

```
User goal
   │
   ▼
┌─────────────────────┐
│   Intent Engine     │  lib/intent/intent-engine.js
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│   Semantic Layer    │  lib/semantic
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│ Decision Context    │  lib/context/decision-context-engine.js
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│  Dynamic Form       │  lib/forms/dynamic-form-engine.js
│  Auto-Population    │  lib/auto-populate/auto-populate-engine.js
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│    UCP Bridge       │  lib/orchestrator/ucp-bridge.js
│  (value mapping +   │
│   result derivation)│
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│ Universal Calculation│ lib/ucp
│     Platform         │
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│  Engine Facades     │  lib/orchestrator/intelligence-orchestrator.js
│  Confidence/Explain │  lib/confidence, lib/explainability
└─────────────────────┘
   │
   ▼
Result → `wave4/index.html` / API consumers
```

---

## 4. UCP Bridge Mapping

### 4.1 Semantic → UCP inputs

`ucp-bridge.js` normalizes heterogeneous semantic field names into the canonical UCP input registry:

| Semantic field(s) | UCP input |
|---|---|
| `annual_revenue` / `monthly_revenue` / `revenue` | `revenue` |
| `food_cost_percentage` | drives `cogs` |
| `labor_cost`, `rent`, `energy_cost`, `maintenance_cost` | `operating_expenses`, `fixed_costs`, `labor_cost` |
| `total_assets` / `asset_value` | `asset_value` |
| `total_liabilities` / `loan_amount` | `loan_amount`, `total_debt_service` |
| `interest_rate` | `interest_rate` |
| `machine_cost` / capex | `initial_investment` |

Defaults are conservative; the caller’s explicit `request.values` override auto-populated values.

### 4.2 UCP outputs → engine results

| Engine | Derived from UCP output |
|---|---|
| `valuation` | `asset_value` or `net_profit` |
| `financing` | `dscr`, `ltv` |
| `feasibility` | `net_profit` as NPV proxy, `roi` as IRR proxy, `payback_period` |
| `risk` | DSCR/LTV thresholds → grade A/B/C/D |
| `market` / `knowledge` / etc. | UCP confidence propagated |

---

## 5. API Surface

All routes live inside the consolidated `v3/api/index.js` serverless function.

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/api/v3/orchestrate/intents` | `handleWave4Intents` | List supported intents |
| POST | `/api/v3/orchestrate/form` | `handleWave4Intent` | Build dynamic form + auto-populate |
| POST | `/api/v3/orchestrate` | `handleWave4Run` | Run full orchestrator pipeline |

Rate-limit category: `compute`.

Response shape:

```json
{
  "intent": { "intent": "feasibility", "names": { "ar": "..." } },
  "form": { "sector": "restaurant", "fields": [...] },
  "autoPopulate": { "populated": [...], "overallConfidence": 72 },
  "ucp": { "outputs": {...}, "scenarios": [...], "confidence": 0.82 },
  "engineResults": { "feasibility": {...}, "risk": {...} },
  "confidence": { "score": 78, "grade": "B", "breakdown": [...] },
  "explanation": { "summary": "...", "language": "ar" },
  "trace": { "name": "intelligence-orchestrator", "steps": [...] }
}
```

---

## 6. Files Changed

- `lib/orchestrator/intelligence-orchestrator.js` — engine runners now consume `ucpResult`; added `buildIntentForm`.
- `lib/orchestrator/ucp-bridge.js` — new bridge with mapping, derivation, and runner factory.
- `v3/api/index.js` — added `/orchestrate/*` routes (and kept `/wave4/*` aliases); result unwrapped for direct UI consumption.
- `wave4/index.html` — new Intent-First entry page; calls `/orchestrate/form` and `/orchestrate`.
- `tests/orchestrator/ucp-bridge.test.js` — bridge unit tests.
- `tests/v3/orchestrate.test.js` — API routing / integration tests.
- `docs/ROUTES_MAP.md` — documented `/wave4/` and orchestrator endpoints.
- `docs/phase-a/WAVE_4_1_ADR.md` — this record.

---

## 7. Test & Audit Results

- `npm test`: **555 passed / 58 suites / 0 failures**
- `npm run audit`: **0 issues**

Known pre-existing issues remain unchanged:
- `clear-user-data` FK constraint on `sales_transactions`
- 6 API auth audit warnings in admin/valuation pages
- 48 residual `npm audit` vulnerabilities from `xlsx` and `undici` with no patch

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Semantic→UCP mapping drifts as forms evolve | Mapping is centralized in `ucp-bridge.js`; future iterations can be driven from UCP registry metadata. |
| UCP static defaults produce synthetic confidence | Bridge uses `preferStatic: true`; production can switch to Supabase-backed registries via the same `UniversalCalculationPlatform.create` call. |
| Prototype page bypasses existing calculators | `wave4/index.html` is additive; legacy calculator routes remain intact. |
| Rate-limit category `compute` may throttle heavy use | Already aligned with `/ucp/*`; can be tuned per tier later. |

---

## 9. Next Steps (Wave 4.2–4.4)

- **4.2 Live Data + Smart Override** — wire real-time market/indicators into auto-population and allow user overrides with confidence recalculation.
- **4.3 Explainability + Decision Timeline** — surface decision timeline and evidence provenance in the Intent-First UI.
- **4.4 Operational Dashboard + Pilot + UX Review** — add orchestrator observability dashboard, pilot telemetry, and accessibility/mobile pass.
