# BONDS Company Programs — implementation evidence and blocked gates

## User acceptance (unchanged)
All of SCC380 must appear AND OPERATE inside the BONDS Company Programs section, linked to actual BONDS company workspaces. Preserve every source module, field, task, contract, transaction, form, file, workflow, user permission, report, integration and record. Enable one/many/all products per workspace, with Arabic, English and mobile parity. Do not launch empty product pages.

## Verified source and destination evidence
- Makkin GitHub source `alzahrani6020/scc380`: source extraction is in `docs/makkin-source-inventory-20261115.json` with source blob SHAs.
- BONDS production Supabase `bonds-global`: 12 `crm_app_*` tables were found in read-only inspection; at inspection time, 1 actual CRM workspace, 0 members, 0 CRM deals, 0 CRM activities. This is a count of queried tables, not a business migration snapshot.
- BONDS existing CRM user experience: `/my-bonds/crm/`, backed by `crm_app_workspaces`, `crm_app_members`, and RLS function `crm_private.workspace_role`.
- Existing BONDS company-program header contains only CRM destinations and My Bonds; not eleven operational programs.

## What this branch truly implements
- An additive draft schema to associate *real existing BONDS CRM workspace IDs* with independently grantable commercial product entitlements. No entitlement automatically created.
- A service-only optional mapping from a BONDS workspace to a verified SCC380 tenant; no mapping automatically created, and no Makkin credentials in the browser.
- A read-only authenticated API `GET /api/company-programs?workspace_id=<uuid>` which verifies workspace owner/member status server-side, returns eleven product names and granted rights. This API is NOT a Makkin functional proxy.
- Contract tests (source only) for product registry and workspace authorization rules. No tests were executed against this branch yet.
- Source-level route/model/field/module inventory to drive a no-loss reconciliation.

## Required before merge, DB changes, rollout or monetization
- [ ] Verify public Supabase database migration in isolated staging; check dependencies, SQL validation, rollback and backup. **Never run draft DDL on production as a shortcut.**
- [ ] Verify every Makkin endpoint, operation, job, storage path and page from source, including controller routes omitted from sidebar and field-level validation from DTOs.
- [ ] Build complete mapping for every source route, model, operation, dependency, field and task, including cross-module services (government, security, alerts, analytics, AI, branch, templates).
- [ ] Implement trusted BONDS session to Makkin authorization exchange with server-side workspace membership, verified tenant mapping, per-app entitlement and role checks on both systems; no broad tenant super-admin token sent to a browser.
- [ ] Implement eleven fully operational BONDS applications and workflows, not placeholder links or embedded unauthenticated Makkin frames.
- [ ] Preserve existing CRM (admin and customer) without mixing data; map all other BONDS workspace types after verifying their production ownership contracts, not by guessing IDs.
- [ ] Test real workflow outcomes including create/edit/approve/search/export/payroll/journal/contract/tenant isolation; dual-account and dual-workspace E2E.
- [ ] Authenticate and run all database, app, RTL/LTR, mobile, negative access, backend, and deployment gates and verify actual production SHA.

**STATUS: PARTIAL / PRODUCTION BLOCKED.** PR must remain DRAFT until every original acceptance case passes. No claim that Makkin was transferred in this change.
