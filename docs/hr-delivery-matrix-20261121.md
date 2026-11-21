# BONDS Global HR — source-grounded delivery matrix (2026-11-21)

**Source of truth:** `my-bonds/crm/company-hr.js` at the parent HR integration branch (`daabb901bcc59c70f091f61d93404b5e906aa720`), its eight `supabase/migrations/*hr*.sql` migrations and HR self-service/policy controllers. This is a code inventory, **not** acceptance of runtime behavior or production data.

## Reduce overlap before adding modules

The 84 candidate capabilities discussed are **feature ideas, not 84 implemented or independent modules**. Keep one primary owner for each workflow; link related records instead of creating duplicate forms or duplicate sources of truth.

| Domain | Existing module IDs in main HR controller | Implementation type in controller | Gap / acceptance objective | Priority |
| --- | --- | --- | --- | --- |
| Employee core | `employees` | dedicated `hr_saas_employees` | real authenticated create/readback, search beyond 250 with server-side pagination, safe employee profile | P0/P1 |
| Identity/organization | `departments` | generic `hr_saas_records` | dedicated departments/positions structure, referential integrity and manager assignment | P1 |
| Recruitment/onboarding | `recruitment` | generic records | requisition -> approval -> candidate -> offer -> hire with traceable transitions | P2 |
| Contracts | `contracts` | dedicated `hr_saas_employment_contracts` | end-to-end activation, amendments, expiry, termination and permissions | P1 |
| Time and shifts | `attendance` dedicated; `shifts` generic | mixed | approved shift assignments, attendance correction, overtime approval, audit | P1 |
| Leave | `leaves` dedicated; `leave_balances` dedicated | dedicated tables | accrual policy -> request -> approval -> ledger -> reconciliation | P1 |
| Payroll | `payroll` and `payroll_runs` dedicated; `allowances`, `deductions`, `benefits`, `loans`, `settlements` generic | mixed | protected pay inputs -> period -> review -> approval -> statement; no inferred bank payout | P1 |
| Employee claims | `claims` | dedicated `hr_saas_entitlements` | submitted -> approved -> settlement with no unauthorized payment side effect | P1 |
| Talent | `performance`, `training` | generic records | structured evaluation and course workflows; avoid separate duplicate employee truth | P2 |
| Documents and assets | `documents`, `assets` | generic records | document metadata/storage access rules, expiry alerts, asset custody return | P2 |
| Employee lifecycle | `lifecycle` | generic records | transfer/promotion/termination with explicit effective dates and history | P1 |
| Self-service | `employee_requests` | dedicated table | authenticated requester, manager approval, evidence and notification | P1 |
| Governance | `governance` generic; `audit` read-only audit table | mixed | policy versioning, audit actor and change history | P0/P2 |

## Mandatory acceptance gates before production

1. Verify production backup **and restore into an isolated database**, compare schema, then dry-run all eight HR migrations. Do not apply migrations to production on assumption.
2. Sign in with two genuinely independent company identities; confirm cross-tenant reads/writes are denied by the database, not merely hidden in the UI.
3. Verify employee create -> readback -> edit -> readback after refresh, in Arabic and English, with an authenticated browser.
4. Verify attendance, leave, contract, payroll and entitlement workflow transitions and accounting boundaries with controlled test fixtures.
5. Run CI, compare the deployed commit SHA to the intended source, and inspect the real production URL; Preview READY alone is insufficient.

## Current change set in PR #1190

- Employee search by number, name, department and job title, with employment-status filter, executed in a tenant-scoped Supabase query.
- Server-side pagination uses deterministic ordering, exact matching count and 50 rows per page; the UI distinguishes page rows from total matches.
- Filters reset when switching company; no schema, RLS, billing, or payroll changes.
- Non-directory employee selectors and other modules still use their original 250-item ceiling; runtime authenticated acceptance is **not** claimed.

## Next engineering iteration (separate PR)

Verify server-side employee pagination with authenticated tests beyond 250 records, including tenant isolation, query correctness and page consistency; then expand paginated employee selection to other HR modules. Follow by dedicated organization records and integrated employee lifecycle state machine. No unverified production writes.

## Workflow actions delivered in follow-up PR

The HR UI now exposes contract activation/closure, pending leave decisions, payroll period review/approval/return, and claim submission/decision. These update existing tables under workspace-scoped, status-conditional writes. Existing database contract/payroll/claim triggers remain authoritative. **Not accepted as deployed or verified with real OAuth sessions.**

**Known blocking gaps:** (1) dedicated departments and positions with tenant-scoped foreign keys, (2) attendance approval status and secure correction process, (3) server-side leave decision immutability, (4) authenticated save/readback from UI and independent two-tenant isolation, (5) clean isolated migration restore and production deployment. The current Staging database was observed to have two HR workspaces with one owner and zero employees, contracts, attendance rows, leave requests, or payroll periods; it cannot evidence genuine two-owner end-to-end acceptance.

**Do not merge to main or apply database migrations based on static UI tests alone.**
