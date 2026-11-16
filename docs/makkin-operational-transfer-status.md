# Makkin to BONDS operational transfer — controlled recovery

## Acceptance target (unchanged)
All eleven programs must be fully operational in actual BONDS company workspaces, with every SCC380 task, form, contract, field, workflow, report, permission, attachment, integration and accounting transaction preserved. One, several or all programs can be subscribed independently. Verify multi-tenant isolation and Arabic/English/mobile behavior before any release.

## Protected reference
- BONDS baseline main commit at branch creation: dea2b14e792b840542d1f42b95d4b02e1d702fee
- Source recovery branch: work/company-programs-real-workspace-integration-20261115, commit 15646ff0d09ab951d9953ce5a864c165c535e971 (PR #1111; unmerged draft)
- SCC companion identity proof: PR #197 (draft; unmerged)
- Do not modify existing letterhead, header, production visual design or customer records.

## Work recovered into this branch
- Source inventories and zero-loss route/field reconciliation matrices, preserved byte-for-byte by Git blob SHA.
- Standalone eleven-program catalog and entitlement time-window logic.
- Read-operation allowlist and stage-only write-operation validator; these do not constitute implemented application workflows.
- Identity mapping readiness policy and signed identity proof helper with isolated unit tests.
- Strict parity gate (expected to FAIL until real route, field and E2E evidence exists).

## Explicit release blockers
- No operating program UI/API wiring has been migrated in this recovery change.
- No Supabase migration applied; production and staging unchanged.
- No authenticated SCC operational session exchange verified.
- Source routes (74), models (108), fields (1966), API modules (33) need one-by-one reconciliation, including omitted controller operations.
- Functional transactions, files, approvals, multi-company and accounting acceptance not completed.
- Prior source branch CI failed (admin module page and Windows Token Runtime service). These are not considered resolved.
- No CI or real-user end-to-end run was executed for this new branch as part of the recovery step.

## Conditions before merge/release
1. Complete each source-to-destination route/field/workflow mapping; preserve test evidence.
2. Implement and authenticate workspace memberships, entitlement checks, SCC scoped token exchange and tenant-specific permissions.
3. Complete every actual program UI/API/data operation; run positive and negative tests with two independent companies and multiple users.
4. Verify transactions, document lifecycle, logs, accounting postings and permissions with a staging database and deterministic rollback.
5. Pass all original tests, actual authenticated browser tests and canonical production visual regression.
6. Verify exact deployment SHA only after release approval.

**STATUS: PARTIAL — DO NOT MERGE OR DEPLOY.**
