# Wave 4.2 — Trusted Data Fabric & Enterprise Data Platform

**Status:** Implemented  
**Date:** 2026-06-27  
**Owner:** BONDS Engineering  
**Scope:** Phase C — Wave 4.2

---

## 1. Context

Wave 4.1 wired the Intent Engine, Dynamic Forms, and UCP into a single user-facing flow. Wave 4.2 upgrades the platform from "application using live data" into a **Trusted Enterprise Decision Platform** where every value is trusted, traceable, explainable, auditable, versioned, evidence-backed, and confidence-scored.

---

## 2. Decision

1. **Build a new enterprise layer `lib/fabric/`** that sits between external data sources and the rest of BONDS.
2. **No connector communicates directly with UCP.** All data flows: Connector → Trusted Data Fabric → Auto-Populate → Orchestrator → UCP.
3. **Reuse the existing V3 Data Acquisition pipeline** (`v3/engine/data-acquisition`) by wrapping its outputs as database-backed connectors instead of rewriting ingestion.
4. **Every value must carry provenance, evidence, freshness, quality, and confidence.** These are computed by dedicated engines and stored in Supabase.
5. **Smart overrides are first-class events:** original value, new value, reason, impact analysis, and full audit trail.
6. **Marketplace Foundation and Plugin SDK are architecture-first:** tables, manifests, validation, and API; no UI.

---

## 3. Architecture

```
External Sources
   │
   ▼
Connectors (lib/fabric/connectors/*)
   │
   ▼
Connector Registry  ←  lib/fabric/connector-registry.js
   │
   ▼
Trusted Data Fabric  ←  lib/fabric/trusted-data-fabric.js
   │
   ├── Source Registry       (data_sources + fabric_* tables)
   ├── Source Ranking Engine
   ├── Freshness Engine
   ├── Data Quality Engine
   ├── Consensus Engine
   ├── Conflict Resolution Engine
   ├── Provenance Layer
   └── Smart Override / Decision Impact
   │
   ▼
Verified Auto-Populate  ←  lib/auto-populate/auto-populate-engine.js
   │
   ▼
Orchestrator → UCP Bridge → UCP
```

---

## 4. New Components

| File | Responsibility |
|---|---|
| `lib/fabric/connector.js` | `BaseConnector` interface: manifest, auth, health, retry, rate limit, cache, evidence/confidence mapping |
| `lib/fabric/connector-registry.js` | Register, discover, dispatch, and health-check connectors |
| `lib/fabric/source-registry.js` | CRUD + discovery over the Source Registry |
| `lib/fabric/source-ranking-engine.js` | Dynamic trust/reliability/freshness/coverage/accuracy scoring |
| `lib/fabric/freshness-engine.js` | Age, expiry, refresh policy, recommendations |
| `lib/fabric/data-quality-engine.js` | 8-dimensional quality scoring |
| `lib/fabric/consensus-engine.js` | Multi-source fusion with outlier detection |
| `lib/fabric/conflict-resolution-engine.js` | Conflict explanation and resolution |
| `lib/fabric/provenance.js` | Lineage record builder and persistence |
| `lib/fabric/trusted-data-fabric.js` | Pipeline orchestrator |
| `lib/fabric/smart-override.js` | Override with diff, impact, audit |
| `lib/fabric/decision-impact-engine.js` | Detect affected assets/projects/reports/certificates |
| `lib/fabric/observability.js` | Event logging |
| `lib/fabric/monitoring.js` | Dashboard summary aggregation |
| `lib/fabric/marketplace-foundation.js` | Catalog registry (architecture only) |
| `lib/fabric/plugin-sdk.js` | Plugin manifest validation |
| `lib/fabric/security.js` | Secrets/encryption/authorization abstraction |
| `lib/fabric/api-contract.js` | API contract metadata registry |
| `lib/fabric/connectors/database-connector.js` | Reads normalized metrics from Supabase |
| `lib/fabric/connectors/manual-connector.js` | Reads manual overrides |

---

## 5. Database Changes

Migration: `supabase/migrations/20260722000000_wave4_2_trusted_data_fabric.sql`

- Extended `data_sources` with connector metadata, countries, industries, operations, license, owner, cost, trust anchor, refresh policy, status, version.
- New tables:
  - `fabric_connector_definitions`
  - `fabric_source_rankings`
  - `fabric_provenance`
  - `fabric_consensus`
  - `fabric_conflicts`
  - `fabric_data_quality`
  - `fabric_refresh_policies`
  - `fabric_observability_events`
  - `fabric_decision_impacts`
  - `fabric_marketplace_items`
  - `fabric_plugins`
  - `fabric_api_contracts`

---

## 6. Integration Points

- `lib/auto-populate/auto-populate-engine.js` now has a `trusted_data_fabric` source adapter and exports `setFabric()`.
- `lib/orchestrator/intelligence-orchestrator.js` creates a `TrustedDataFabric` instance and injects it before auto-population.
- Auto-populated values carry `verification` and `evidence` metadata into the orchestrator result.
- `v3/api/index.js` exposes `/fabric/*` endpoints.

---

## 7. API Surface

All routes are inside the consolidated `v3/api/index.js` function.

| Method | Path | Purpose |
|---|---|---|
| GET | `/fabric/connectors` | List connectors |
| GET | `/fabric/connectors/health` | Health all connectors |
| GET | `/fabric/connectors/:code/health` | Health one connector |
| POST | `/fabric/connectors/:code/fetch` | Fetch via connector |
| GET | `/fabric/sources` | Source registry |
| GET | `/fabric/sources/:code/rank` | Source rank |
| POST | `/fabric/resolve` | Resolve metric via full pipeline |
| GET | `/fabric/quality` | Quality summary |
| GET | `/fabric/provenance/:id` | Provenance chain |
| POST | `/fabric/override` | Smart override |
| GET | `/fabric/impact` | Decision impact analysis |
| GET | `/fabric/monitoring/summary` | Monitoring summary |
| GET | `/fabric/marketplace` | Marketplace catalog |
| GET | `/fabric/plugins` | Plugin list |
| POST | `/fabric/plugins/validate` | Validate plugin manifest |

Rate-limit category: `compute`.

---

## 8. Tests

- `tests/fabric/trusted-data-fabric.test.js` — engines + fabric pipeline + connector registry
- `tests/v3/fabric.test.js` — `/fabric/*` API routing

Full suite result after Wave 4.2:
- `npm test`: **572 passed / 60 suites / 0 failures**
- `npm run audit`: **0 issues**
- `npm run audit:og`: **all pages pass**

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Many new tables | Each table maps directly to a charter deliverable and is documented here. |
| Performance of multi-source resolution | Consensus results can be cached; connectors read pre-normalized tables. |
| Direct connector → UCP bypass | Architectural rule enforced: connectors only feed the fabric. |
| Secret exposure | `FabricSecurity` reads from env or a pluggable secret provider; no secrets in code. |

---

## 10. Next Steps

- Populate `data_sources` with connector metadata for active feeds.
- Backfill `fabric_source_rankings` and `fabric_data_quality` from ingestion history.
- Build admin dashboards on top of `/fabric/monitoring/summary`.
- Implement concrete HTTP/API connectors (government, central bank, stock exchange, maps) as subclasses of `BaseConnector`.
