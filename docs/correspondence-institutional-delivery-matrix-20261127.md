# BONDS Global — Correspondence & Institutional Relations Delivery Matrix

Updated: 2026-11-27. This is a scope and evidence register, **not an acceptance certificate**. Each item must retain its original acceptance criteria and user-reported regressions.

| Domain | Requirement | Current evidence | State | Release gate |
| --- | --- | --- | --- | --- |
| UI | Retain all old editing features and make mobile usable | PR #1264/1266 restored toolbar and fresh assets; signed-in end-to-end still unverified | PARTIAL | Real browser acceptance for every existing action |
| Documents | Create, save, reopen, approve, issue, PDF and archive | Existing governed correspondence API and persisted tables | PARTIAL | Two user/role flows and data read-back |
| Directory | Organizations, government, factories, hospitals, universities, schools, individuals, branches and contacts | Existing CRM workspace/company/contact tables but no complete unified directory | PARTIAL | Tenant-specific CRUD, import review, dedupe, source tracking |
| Email | Show Zoho inbox/sent/drafts with provider branding | Zoho account visible in user screenshot; no proven BONDS OAuth binding | UNKNOWN | Account OAuth, read-only inbox tests, explicit role authority |
| Mail sending | Separate identity/mailbox per tenant | Existing shared Resend/SMTP helper, not tenant-bound | BLOCKED | Server-side mailbox ownership, provider account id and OAuth secrets secured |
| Bulk dispatch | Separate message per recipient; no other addresses or directory leakage | New pure preflight module and security tests in this PR, **not connected to live sending** | IN PROGRESS | Authorized tenant scoped contact lookup, persistent idempotent queue, provider acceptance and recipient privacy |
| Tenancy | Isolation across companies and memberships | CRM RLS policies present; correspondence_documents has RLS enabled without public pg_policies rows | UNKNOWN | Prove API, SQL/RLS, attachments and logs isolated for two companies |
| Records | Inbound and outbound histories, attachments, replies, messages and external portals | Partial correspondence registers exist | PARTIAL | Real message threading, sender verification and per-tenant retention |
| Workflow | Reviews, delegated signatures, stamping, issuance, tasks, SLA | Existing workflow engine; no complete acceptance of all roles | PARTIAL | Lifecycle tests and immutable issued artifact verification |
| CRM/HR | Reuse canonical entities, employees and roles; no duplicate memberships | Existing CRM and HR modules | PARTIAL | Referential integrity and role isolation |
| Banking/investment | Bank partners, offers, deals, due diligence, contracts, data rooms | Proposed only | NOT STARTED | Contract/business owner and permissions acceptance |
| Automation & AI | Drafts, translations, search, summaries, followups | Proposed only | NOT STARTED | Human approval, privacy and audit testing |
| Monitoring | Provider health, failure queue, delivery evidence and retry | Generic delivery status exists | PARTIAL | Failed/accepted/delivered separated by verifiable provider signals |
| Operations | Backups, retention, incident response, deployment and rollback | Platform CI exists; this scope unverified | PARTIAL | Restore and rollback evidence |

## Non-negotiable acceptance

1. No database/table/recipient directory is ever embedded in outgoing email.
2. Every dispatch has exactly one destination and no CC/BCC, with server-authorized tenant mailbox.
3. No sending from the platform-level default mailbox for another company's correspondence.
4. Do not create users, memberships, or change production database by adding UI features.
5. Inbound message reading requires tenant-scoped OAuth/mailbox permissions; the brand logo is not proof of the integration.
6. Maintain old UI features, A4 formatting and existing official archived artifacts.
7. Preserve immutable signed/issued documents; do not edit stored official originals to pass tests.
8. No success claim until actual accepted read/send/reply/reopen workflows and independent two-company isolation pass.
9. Background mail delivery must use persistent idempotent jobs and explicit approval, not this preflight helper alone.
10. Unauthorized, missing tenant, inactive contact and unknown mailbox must fail closed.

## Phase 1 actual code

- `lib/api/correspondence-tenant-dispatch.js` — pure, fail-closed *preflight only*. It **does not** send or fetch contacts.
- `tests/security/correspondence-tenant-dispatch.test.js` — separation, duplicate, forbidden headers, company mismatch tests.
- No schema migration, provider connection or live dispatch in this phase.

## Explicit release blockers

- Confirm multi-company identity model (CRM `workspace_id` versus correspondence `company_id`) before joins.
- Verify Zoho OAuth account mapping (one or multiple mailboxes for each company), secure token storage, provider rate limits.
- Implement and test server-side authorization and DB-backed idempotency queue. A client-supplied authorization string is never sufficient.
- Test full lifecycle on isolated data then production account with an explicitly permitted test recipient.
