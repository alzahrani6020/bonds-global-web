# Master Data Snapshot Retention and Database Maintenance Runbook

Status: Active repository-hygiene control for Bonds V3 master-data snapshots and high-impact database maintenance scripts.

## Scope

This runbook governs:

- `v3/master-data/backup/*` snapshots created by `v3/scripts/generate-master-data.js`;
- `v3/scripts/link-old-city-data.js`;
- `v3/scripts/clean-old-taxonomy.js`;
- `v3/scripts/clean-old-seed.js`;
- `v3/scripts/clean-old-models.js`.

It does not authorize execution of any database-writing script and does not replace the database backup controls in `BACKUP_STRATEGY.md`.

## Roles

The existing backup strategy defines these repository-level roles:

- **Platform owner** — accountable owner; approves retention-policy exceptions and any final deletion decision.
- **Senior Database Architect** — operational custodian; validates database context, restore/recovery capability, execution prerequisites, and post-change verification.
- **Senior Security Engineer** — validates backup access/encryption implications when material is moved outside Git or contains sensitive data.

No individual person is inferred by this document. Assignment of these roles is an operational responsibility outside the repository.

## Master-data snapshot policy

### Purpose

`v3/scripts/generate-master-data.js` creates a timestamped directory under `v3/master-data/backup/` before rewriting curated master-data CSVs. The snapshot is therefore a **pre-generation rollback/audit artifact**, not a database dump.

The currently retained snapshot is:

`v3/master-data/backup/1781397639938/`

It contains ten CSV files:

- `sectors.csv`
- `sub-sectors.csv`
- `activities.csv`
- `activity-details.csv`
- `project-models.csv`
- `financial-assumptions.csv`
- `project-model-assumptions.csv`
- `risk-factors.csv`
- `project-model-risks.csv`
- `regulatory-requirements.csv`

### Classification

**KEEP — source-level rollback/audit snapshot**

### Retention period

**No automatic expiry.** Retain each committed master-data snapshot until it is explicitly superseded and passes the deletion gate below.

This is intentionally different from the 90-day off-site retention documented for manual database dumps in `BACKUP_STRATEGY.md`: these CSV snapshots preserve source-level master-data state and are not equivalent to a PostgreSQL backup.

### Supersession and deletion trigger

A snapshot may become a **DELETE-CANDIDATE** only after all of the following are verified:

1. a newer committed snapshot or another immutable source reconstructs the same required historical state;
2. the current master-data generation workflow is reproducible from a clean checkout;
3. the Senior Database Architect confirms the snapshot is not required for rollback, reconciliation, migration investigation, or audit;
4. the Platform owner approves retirement;
5. no legal, compliance, incident-response, or release record requires preservation;
6. deletion is isolated to a dedicated PR with a documented rollback method.

Age alone is never sufficient to delete a snapshot.

### Restore procedure

For source-level rollback:

1. create a temporary branch from the exact target commit;
2. compare the snapshot CSVs against the corresponding current files in `v3/master-data/`;
3. restore only explicitly approved files; do not bulk-copy blindly;
4. review the diff for taxonomy/model removals or identifier changes;
5. run repository CI;
6. if database reconciliation is required, use a separately approved database change plan. Restoring CSV files in Git does **not** itself restore database state.

## Maintenance-script classification

None of the four scripts below is exposed through root or `v3/package.json` scripts. Their presence in source control is not evidence that they are approved for routine use.

| Script | Classification | Database effect | Routine execution |
| --- | --- | --- | --- |
| `v3/scripts/link-old-city-data.js` | **HISTORICAL — controlled migration/reconciliation** | Upserts old-city indicator and market data into matched new-city records. | Not approved. |
| `v3/scripts/clean-old-taxonomy.js` | **HISTORICAL — controlled maintenance** | Deactivates sub-sectors, activities, and linked project models absent from current CSVs. | Not approved. |
| `v3/scripts/clean-old-seed.js` | **HISTORICAL — controlled maintenance** | Deactivates sectors and dependent sub-sectors, activities, and project models absent from the master CSV. | Not approved. |
| `v3/scripts/clean-old-models.js` | **HISTORICAL — controlled maintenance** | Deactivates active project models absent from `project-models.csv`. | Not approved. |

These classifications mean **retain for audit/recovery context; execute only through an explicitly reviewed maintenance change**. They do not mean the scripts are known to be safe against the current production schema.

## Execution preflight

Before running any listed script against any shared or production-like database, verify all items below.

### 1. Environment identity

Record:

- target environment;
- Supabase/project identifier;
- database host/database name without exposing credentials;
- current application deployment/commit;
- exact script commit SHA.

If the target cannot be proven, **STOP**.

### 2. Schema compatibility

Verify that every referenced table, column, conflict key, and relationship still exists and has the expected semantics.

At minimum inspect the script SQL and current migrations/schema for the affected objects.

If compatibility is uncertain, **STOP**.

### 3. Input/master-data integrity

For cleanup scripts:

- identify the exact CSV commit used as the source of truth;
- validate expected row/code counts;
- inspect the candidate rows that would be deactivated before executing writes.

The current scripts do not provide a built-in dry-run mode. A read-only preview query or equivalent review step is therefore mandatory before execution.

### 4. Backup and rollback

Before writes:

- confirm a usable database restore point according to `BACKUP_STRATEGY.md`;
- export or otherwise preserve the rows expected to change when practical;
- define rollback SQL or PITR/restoration procedure;
- record who is authorized to trigger rollback.

No write should proceed solely because the script is idempotent or uses `ON CONFLICT`.

### 5. Approval

Required approvals:

- Senior Database Architect: technical execution and rollback readiness;
- Platform owner: production/shared-environment execution.

Security review is additionally required when backup/export handling introduces new storage or access paths.

## Execution controls

When an approved execution occurs:

1. execute from the reviewed commit SHA;
2. use least-privilege credentials sufficient for the required tables only where feasible;
3. capture pre-change candidate counts;
4. execute once;
5. capture affected-row counts and script output;
6. do not rerun automatically after partial failure;
7. compare actual affected rows against the approved candidate set.

A mismatch between expected and actual scope is a rollback/STOP condition.

## Post-change verification

After any execution, verify independently:

- affected records have the intended active/published state;
- no unrelated sectors, activities, cities, models, indicators, or market rows changed;
- application smoke tests for impacted data paths pass;
- runtime/database errors are absent in the verification window;
- rollback remains possible until the change is accepted.

Record the evidence in the issue or PR that authorized execution.

## Script retirement gate

A listed script may move from **HISTORICAL** to **DELETE-CANDIDATE** only when:

- the migration/maintenance purpose is formally retired;
- no external runbook or automation depends on its path;
- its audit value is no longer required;
- equivalent supported tooling exists where needed;
- the Platform owner and Senior Database Architect approve retirement;
- deletion is performed in a dedicated reversible PR.

Until then, retain the scripts in source control and do not expose them as casual package scripts.

## Current decision

- `v3/master-data/backup/1781397639938/`: **KEEP; no automatic expiry**.
- `link-old-city-data.js`: **HISTORICAL — controlled migration/reconciliation**.
- `clean-old-taxonomy.js`: **HISTORICAL — controlled maintenance**.
- `clean-old-seed.js`: **HISTORICAL — controlled maintenance**.
- `clean-old-models.js`: **HISTORICAL — controlled maintenance**.

No deletion or database execution is authorized by this policy.
