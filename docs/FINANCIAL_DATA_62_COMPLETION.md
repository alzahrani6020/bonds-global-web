# Financial Data 62-Proposal Closure Matrix

Status vocabulary is intentionally limited to `DONE` and `NOT REQUIRED WITH VERIFIED EQUIVALENT` for the closure candidate. Production verification remains a separate release gate.

| # | Status | Evidence | Component |
|---:|---|---|---|
| 1 | DONE | Actual GitHub/Supabase/Vercel audit performed before changes | PROJECT_BOOTSTRAP + live systems |
| 2 | DONE | Governed dataset carries user/client/project context and portfolio API | financial_datasets; /services/intake/portfolio |
| 3 | DONE | File, manual and mixed intake with explicit conflict handling | v3/api/services.js |
| 4 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Existing parser supports PDF/XLSX/XLS/CSV and is reused | lib/api/document-parser* |
| 5 | DONE | User/client/project, file metadata, SHA-256 version | financial_datasets |
| 6 | DONE | Conservative document classifier with unknown fallback | lib/finance/financial-data-intake.js |
| 7 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Parser remains independent from financial engines | lib/api/document-parser*; lib/finance/engines/* |
| 8 | DONE | Requirements are derived from service primary action | requirementsFor / extractFinancialFields |
| 9 | DONE | Central financial field dictionary and exact aliases | FIELD_DICTIONARY |
| 10 | DONE | Numeric/sign/unit/currency/period/item normalization | financial-data-intake.js |
| 11 | DONE | Missing or ambiguous values are never invented; remain missing/unresolved | validateDataset / conflict handling |
| 12 | DONE | Multiple periods are explicit; cash-flow periods supported structurally | multi_period + periods |
| 13 | DONE | Field/file provenance stored and returned with execution evidence | field_provenance / evidence_pack |
| 14 | DONE | Per-field confidence persisted | field_confidence |
| 15 | DONE | Review/approval required before validated execution path | /services/intake/approve |
| 16 | DONE | Manual corrections append original/previous/corrected values and timestamp | overrides |
| 17 | DONE | Validation layer with fail-closed quality gate | validateDataset |
| 18 | DONE | Accounting equation reconciliation plus existing reconciliation substrate | validateDataset; finance_reconciliation_items |
| 19 | DONE | Cross-statement cash and net-income consistency checks | validateDataset |
| 20 | DONE | Multiple source values become conflict, never silent selection | resolveCandidates + mixed intake |
| 21 | DONE | complete/partial/conflicting/unverified/verified statuses | quality_status |
| 22 | DONE | PASS / FAIL_CLOSED gate | validation.quality_gate |
| 23 | DONE | Material tolerance rules at 0.5% with absolute floor | reconciliation checks |
| 24 | DONE | Validated financial dataset persists reviewed values and validation | financial_datasets |
| 25 | DONE | Execution input snapshot captured with hash/version/time | input_snapshot |
| 26 | DONE | Same compatible dataset can execute multiple financial services | /services/execute dataset compatibility validation |
| 27 | DONE | Input → engine → service dependency graph persisted | dependency_graph |
| 28 | DONE | Deterministic engine metrics persisted from execution | derived_metrics |
| 29 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Existing unified service execution gateway reused | /api/v3/services/execute |
| 30 | DONE | Missing inputs return required fields and block execution | engine required_inputs + FAIL_CLOSED |
| 31 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Existing financial engines are deterministic | lib/finance/engines/* |
| 32 | NOT REQUIRED WITH VERIFIED EQUIVALENT | AI is outside deterministic arithmetic path by architecture invariant | Dual Core invariants + service router |
| 33 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Existing result envelope/gateway composer reused | lib/finance/shared/result-envelope.js |
| 34 | DONE | Input snapshot, provenance, dependency graph, validation and evidence accompany result | evidence_pack / decision_record |
| 35 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Existing governed rules registry reused | business_rules_registry |
| 36 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Existing deterministic risk engine provides factors/score/band | risk-engine.js |
| 37 | DONE | Parent dataset/version/hash retained as historical baseline | evidence_pack.historical_baseline |
| 38 | DONE | Changed fields with previous/current/absolute/% delta recorded | evidence_pack.change_detection |
| 39 | DONE | Prior executions become STALE on input change; re-execution clears stale | execution_history / is_stale |
| 40 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Existing scenario forecast + Monte Carlo + stress cases reused | scenario-engine.js / simulation-engine.js |
| 41 | DONE | One-factor sensitivity added to existing simulation engine; service activated | simulation-engine.js; sensitivity_analysis profile |
| 42 | DONE | Benchmarking is explicitly not applied without verified source provenance | decision_record.benchmarking policy |
| 43 | DONE | Evidence bundle persisted per dataset/execution | evidence_pack |
| 44 | DONE | Latest deterministic decision/result record persisted | decision_record |
| 45 | DONE | File/dataset/parser/mapping/engine/analysis versions retained | version columns + source_file_version |
| 46 | DONE | Parent versions and execution history remain; deletion is soft | parent_dataset_id / deleted_at |
| 47 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Owner-only RLS is stricter than broad role sharing; client/project context is retained | financial_datasets RLS |
| 48 | DONE | Retention timestamp PATCH and owner soft DELETE controls | /services/intake/datasets/:id |
| 49 | NOT REQUIRED WITH VERIFIED EQUIVALENT | Existing private client-documents storage + auth/ownership/type/size/path/parser containment controls reused | client-documents; services.js |
| 50 | DONE | Normalized input SHA-256 duplicate detection | input_hash / duplicate_of_id |
| 51 | DONE | Portfolio aggregation over governed datasets by project/client/service | /services/intake/portfolio |
| 52 | DONE | Draft → reviewed/approved-equivalent governed transition | approval_status + intake approval |
| 53 | DONE | PDF/XLSX/executive-summary exports read same approved result | dataset export endpoint |
| 54 | DONE | Owner-authenticated API-ready dataset endpoint | GET /services/intake/datasets/:id |
| 55 | DONE | Acceptance suite encoded in production smoke | scripts/post-deploy-smoke.js |
| 56 | DONE | Real CSV production E2E retained | tests/fixtures/debt-to-equity.csv |
| 57 | DONE | Manual ground truth compares D/E, liquidity gap and gross margin | post-deploy smoke |
| 58 | DONE | Extraction accuracy/missing/wrong-mapping/manual-correction rates computed | post-deploy smoke |
| 59 | DONE | Critical missing/unresolved values block approval/execution | FAIL_CLOSED acceptance |
| 60 | DONE | Completion implemented as extensions to phases A–E, not a replacement system | PR #549 |
| 61 | DONE | No unrelated new engine/upload/parser/gateway architecture introduced | PR #549 diff |
| 62 | DONE | Target flow remains Documents → Parser → Extraction → Normalization → Validation → Dataset → Metrics → Gateway → Engines → Result → Assistant → Audit/Evidence | existing architecture + PR #549 |

## Acceptance scenarios

1. Debt/equity real CSV: 200000 / 100000 = 2.
2. Liquidity gap via the same dataset gateway.
3. Gross margin deterministic ground truth.
4. Dataset correction marks previous execution STALE.
5. File/manual conflict remains unresolved and is not silently selected.
6. Missing critical value fails closed before execution.
7. New dataset version preserves the parent/history.

Production smoke additionally verifies PDF/XLSX/summary exports and reports extraction quality metrics.

## Migration ledger

- `20261023153813_financial_data_intelligence_completion`
- `20261023154031_activate_sensitivity_analysis`

Both were applied non-destructively to the active `bonds-global` Supabase project and repository filenames were aligned to the live migration ledger.
