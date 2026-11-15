# BONDS Company Programs — implementation evidence and blocked gates

## User acceptance (unchanged)
All of SCC380 must appear AND OPERATE inside the BONDS Company Programs section, linked to actual BONDS company workspaces. Preserve every source module, field, task, contract, transaction, form, file, workflow, user permission, report, integration and record. Enable one/many/all products per workspace, with Arabic, English and mobile parity. Do not launch empty product pages.

## Verified source and destination evidence
- Makkin GitHub source `alzahrani6020/scc380`: source extraction is in `docs/makkin-source-inventory-20261115.json` with source blob SHAs.
- BONDS production Supabase `bonds-global`: both `companies/company_members` and `crm_app_workspaces/crm_app_members` exist as distinct real workspace/ownership models. Read-only counts at inspection: `companies` 0, `company_members` 0, CRM workspaces 1, CRM members 0, CRM deals 0, CRM activities 0. Neither type may be silently substituted for the other.
- BONDS existing CRM user experience: `/my-bonds/crm/`, backed by `crm_app_workspaces`, `crm_app_members`, and RLS function `crm_private.workspace_role`.
- Existing BONDS company-program header contains only CRM destinations and My Bonds; not eleven operational programs.

## What this branch truly implements
- An additive draft source-aware workspace mapping (`company_program_workspaces`) with foreign keys to either existing `companies` or existing `crm_app_workspaces`, plus separate independently grantable entitlements. No workspace, mapping or entitlement automatically created.
- A service-only optional mapping from the verified source-aware BONDS workspace link to a verified SCC380 tenant; no mapping automatically created, and no Makkin credentials in the browser.
- A read-only authenticated API `GET /api/company-programs?workspace_type=crm|company&workspace_id=<uuid>` which verifies owner/member status in the correct authoritative source and returns eleven products and entitlements. This API is NOT a Makkin functional proxy.
- Previously executed in GitHub CI: 605 Jest suites / 4,464 tests and isolated PostgreSQL entitlement checks PASS for the earlier catalog revision. Each new commit still requires fresh verification.
- Explicit SCC user links and BONDS authenticated `integration-status` require active subscriptions plus separately verified SCC tenant and user mapping. Never infer correspondence from matching emails alone.
- `POST /api/company-programs?action=probe-mapping` verifies a pre-provisioned mapping using a 40-second Ed25519 proof and the SCC companion endpoint in draft PR #197. It requires confirmed email and workspace membership and never grants subscriptions, tokens, or runtime program permissions. It fails closed if cryptographic keys/endpoint are absent.
- SCC draft PR #197 validates mapping proofs against its own tenant/user database and Redis nonce store without relaxing Render PostgreSQL networking. It is **not** SSO or an operational proxy. Both draft PRs remain blocked from release.
- Source-level route/model/field/module inventory to drive a no-loss reconciliation.

## Required before merge, DB changes, rollout or monetization
- [ ] Verify public Supabase database migration in isolated staging; check dependencies, SQL validation, rollback and backup. **Never run draft DDL on production as a shortcut.**
- [ ] Verify every Makkin endpoint, operation, job, storage path and page from source, including controller routes omitted from sidebar and field-level validation from DTOs.
- [ ] Build complete mapping for every source route, model, operation, dependency, field and task, including cross-module services (government, security, alerts, analytics, AI, branch, templates).
- [ ] Implement trusted BONDS session to Makkin authorization exchange with server-side workspace membership, verified tenant mapping, per-app entitlement and role checks on both systems; no broad tenant super-admin token sent to a browser.
- [ ] Implement eleven fully operational BONDS applications and workflows, not placeholder links or embedded unauthenticated Makkin frames.
- [ ] Preserve existing CRM (admin and customer) without mixing data; verify membership contracts of any additional BONDS workspace types before extending the registry; never alias unrelated company and CRM workspace IDs.
- [ ] Test real workflow outcomes including create/edit/approve/search/export/payroll/journal/contract/tenant isolation; dual-account and dual-workspace E2E.
- [ ] Authenticate and run all database, app, RTL/LTR, mobile, negative access, backend, and deployment gates and verify actual production SHA.

**STATUS: PARTIAL / PRODUCTION BLOCKED.** PR must remain DRAFT until every original acceptance case passes. No claim that Makkin was transferred in this change.
