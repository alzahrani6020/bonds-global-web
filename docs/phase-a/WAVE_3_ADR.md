# Wave 3 — Universal Calculation Platform (UCP)

## Architectural Decision Record

**Status:** Implemented and aligned with Wave 3 Governance  
**Date:** 2026-06-24  
**Scope:** Phase B, Wave 3  
**Reference:** `docs/BONDS_CONSTITUTION.md`

---

## 1. Goal

Replace all sector-specific calculation engines with a single, template-driven, registry-based calculation engine — the **Universal Calculation Platform (UCP)**. No new standalone calculation engines are allowed; every new sector must be modelled as UCP metadata.

---

## 2. Governance principles

The implementation follows the Wave 3 governance charter:

| Principle | How it is enforced |
|---|---|
| **Everything is Metadata** | Fields, sections, templates, formulas, rules, validations, scenarios, weights, policies, reports, certificates, display logic, dependencies, decision paths, country and industry configuration live in registries. |
| **Universal Asset Model (UAM)** | `ucp_asset_models` + `ucp_asset_instances` represent any asset with the same attribute groups. No sector-specific asset tables in Core Engine. |
| **Registry-Driven Platform** | All engines load definitions from registries; static defaults guarantee offline operation. |
| **Template is Blueprint** | `ucp_templates` only describe fields, sections, reports, workflow and required registries. No calculation logic inside templates. |
| **Calculation Graph (DAG)** | `CalculationGraph` builds a Directed Acyclic Graph from formulas/outputs, computes topological order and parallel levels, and supports impact analysis. |
| **Dependency Intelligence** | `ucp_dependencies` stores explicit dependencies and infers them from formula variables. |
| **Configuration First** | `ucp_configurations` overrides sector/country/policy values without code changes. |
| **Version Everything** | `ucp_versions` + effective dates + approval status on every registry item. `isActive()` filter is applied before use. |
| **Explainable Calculation** | Every run collects evidence (formula, rule, policy, input, assumption) in `ucp_evidence`. |
| **Zero Sector Logic** | Core Engine has no `if sector == ...`; all sector behaviour comes from registries, weights and policies. |
| **Plugin Architecture** | `ucp_plugins` registers future extensions (sectors, valuation methods, reports, certificates) without Core changes. |
| **Governance** | Registries carry `approval_status`, `owner` and `review_cycle`. Production use defaults to `approved`/`active` only. |

---

## 3. Decisions

### 3.1 All calculations go through UCP

- New sectors are added by creating rows in `ucp_templates` and the required registry rows, not by writing a new engine.
- Existing calculators remain operational via backward-compatibility adapters.

### 3.2 Registries are externalised

| Registry | Table | Loader |
|---|---|---|
| Input Definition | `ucp_input_definitions` | `lib/ucp/input-output-registry.js` |
| Output Definition | `ucp_output_definitions` | `lib/ucp/input-output-registry.js` |
| Mathematical Formula | `formula_registry` (Wave 1) | `lib/ucp/formula-registry.js` |
| Business Formula | `ucp_business_formula_registry` | `lib/ucp/business-formula-registry.js` |
| Business Rule | `business_rules_registry` (Wave 1) | `lib/ucp/rule-registry.js` |
| Validation | `ucp_validation_registry` | `lib/ucp/validation-registry.js` |
| Scenario | `ucp_scenario_registry` | `lib/ucp/scenario-registry.js` |
| Weight | `ucp_weight_registry` | `lib/ucp/weight-registry.js` |
| Policy | `ucp_policy_registry` | `lib/ucp/policy-registry.js` |
| Template | `ucp_templates` | `lib/ucp/template-engine.js` |
| Dependency | `ucp_dependencies` | `lib/ucp/dependency-registry.js` |
| Version | `ucp_versions` | `lib/ucp/version-registry.js` |
| Configuration | `ucp_configurations` | `lib/ucp/configuration-layer.js` |
| Plugin | `ucp_plugins` | `lib/ucp/plugin-loader.js` |
| Evidence | `ucp_evidence` | `lib/ucp/evidence-registry.js` |
| Universal Asset Model | `ucp_asset_models` / `ucp_asset_instances` | `lib/ucp/universal-asset-model.js` |

Static defaults are provided for every registry so the platform works when Supabase is unavailable.

### 3.3 Safe expression evaluation

- `lib/ucp/expression-evaluator.js` implements a hand-written tokenizer, parser and evaluator.
- No `eval()` or `new Function()`.
- Supported operators: `+ - * / % ^ > >= < <= == != && || !` and parentheses.
- Supported functions: `min`, `max`, `sqrt`, `pow`, `abs`, `round`, `floor`, `ceil`.
- Formulas are resolved in dependency order; circular dependencies throw.

### 3.4 Calculation Graph

- `lib/ucp/calculation-graph.js` builds a DAG from inputs, formulas, business formulas and outputs.
- It computes topological order and parallel execution levels.
- Node failures are recorded; execution continues unless `failureStrategy === 'throw'`.
- `impactedNodes()` returns downstream elements for a changed input.

### 3.5 Template resolution

Templates are resolved by `(sector, country)` with precedence:

1. Exact country match for the sector, highest approved version.
2. Sector-only template, highest approved version.
3. No match → error.

### 3.6 Backward-compatibility adapters

- `lib/ucp/adapters.js` maps legacy calculator inputs to UCP inputs and UCP outputs back to legacy shapes.
- Supported adapters: `break-even`, `loan`, `cash-flow`, `pricing`.
- Legacy calculators remain untouched; they can call `/api/v3/ucp/calculate` with `legacyAdapter`.

### 3.7 API exposure

- `POST /api/v3/ucp/calculate` — run a UCP calculation.
- `GET /api/v3/ucp/templates` — list/resolve templates.
- Rate-limit category: `compute`.

### 3.8 Run persistence is best-effort

- Every successful calculation is stored in `ucp_calculation_runs`.
- Explainability evidence is stored in `ucp_evidence`.
- Persistence failure does **not** fail the calculation response.

---

## 4. Migration strategy

1. **Coexistence**: UCP and legacy calculators run side-by-side.
2. **Adapter coverage**: Existing calculators are wrapped by UCP adapters.
3. **Template expansion**: Add UCP templates for every sector currently handled by standalone calculators.
4. **Regression gates**: existing tests must keep passing; new UCP tests assert identical numeric results for adapter-mapped inputs.
5. **Deprecation**: standalone engines are marked deprecated; removal only after full migration.

---

## 5. Quality gates

- Zero regressions in existing test suites.
- UCP tests cover expression evaluation, all registries, templates, graph execution, adapters and UAM.
- No `eval()` or code generation in the expression engine.
- All registry-backed calculations produce deterministic, reproducible outputs.
- `npm test` and `npm run audit` pass with zero issues.

---

## 6. Files added / changed

### New files
- `lib/ucp/index.js`
- `lib/ucp/expression-evaluator.js`
- `lib/ucp/formula-registry.js`
- `lib/ucp/business-formula-registry.js`
- `lib/ucp/validation-registry.js`
- `lib/ucp/rule-registry.js`
- `lib/ucp/scenario-registry.js`
- `lib/ucp/weight-registry.js`
- `lib/ucp/policy-registry.js`
- `lib/ucp/template-engine.js`
- `lib/ucp/input-output-registry.js`
- `lib/ucp/dependency-registry.js`
- `lib/ucp/calculation-graph.js`
- `lib/ucp/version-registry.js`
- `lib/ucp/configuration-layer.js`
- `lib/ucp/evidence-registry.js`
- `lib/ucp/plugin-loader.js`
- `lib/ucp/universal-asset-model.js`
- `lib/ucp/adapters.js`
- `lib/ucp/config-engine.js`
- `supabase/migrations/20260721000000_wave3_universal_calculation_platform.sql`
- `supabase/migrations/20260721100000_wave3_governance_enhancements.sql`
- `tests/ucp/*.test.js` (18 suites)
- `docs/phase-a/WAVE_3_ADR.md`

### Modified files
- `v3/api/index.js` — added `/ucp/calculate` and `/ucp/templates` routes.
- `docs/phase-a/EXECUTION_PROGRAM.md` — Wave 3 marked Done.
