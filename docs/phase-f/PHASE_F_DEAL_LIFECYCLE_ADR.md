# ADR — Phase F: Deal Lifecycle (from preparation to close)

- **Status**: Accepted — F.0/F.1/F.2 deployed; F.3 implemented in this change
- **Date**: 2026-11-12
- **Scope**: Clients (deal owners), advisors/admins, counterparties (investors, lenders, buyers)

## 1. Context

A competitive review against Esnad, Chrome Advisory, Ithmar and GII concluded that Bonds is strong *before* a deal (feasibility, valuation, readiness, memoranda) but weak *inside* the deal cycle: shared deal rooms, NDA-gated data rooms, due diligence, investor/lender management and closing.

The recommendation was not to expand horizontally but to close the start-to-close deal gap and connect existing capabilities (UCP, Investment Intelligence, Enterprise Lifecycle, ECC) to one deal workspace.

## 2. Existing foundation (F.0 — already in production)

Delivered by PR #989 and must not be duplicated:

| Layer | Asset |
|-------|-------|
| Schema | `20261112003000_deal_workspace_foundation.sql` — `bonds_deals`, `bonds_deal_parties`, `bonds_deal_tasks`, `bonds_deal_due_diligence_items`, `bonds_deal_documents` (owner-only RLS) |
| Domain | `lib/deals/deal-domain.js` — normalizers and enums |
| API | `v3/api/deals.js` via `/api/v3/deals/*` inside the single v3 function |
| UI | `/my-bonds/deals/` and `/en/my-bonds/deals/` + `components/deal-workspace.js` |

Limitations of F.0: owner-only access, no link to projects or lifecycle gates, no audit trail, documents are metadata only.

## 3. Decision (F.1 — this change)

Extend F.0 **additively**. No new deal tables, no new Vercel functions, no change to already-applied migrations.

### 3.1 Schema — `20261112100000_deal_workspace_members_lifecycle.sql`

- `bonds_deals` gains nullable `project_id`, `lifecycle_instance_id`, `funding_case_id` (all `on delete set null`).
- `bonds_deal_members`: shared access by email invitation.
  - `side`: `advisor` | `counterparty` | `external_expert`.
  - `member_role`: `deal_manager` | `analyst` | `viewer` | `legal` | `auditor` | `investor_rep`.
  - Counterparties are limited to `viewer` / `investor_rep` / `legal`; `deal_manager` must be an advisor (DB check constraints).
  - `status`: `invited` → `active` → `revoked` (never deleted).
  - `nda_status`, `nda_signed_at`, `nda_reference`, `access_expires_at`.
- `bonds_deal_events`: append-only audit trail (trigger rejects update/delete).
- `bonds_deal_access_side(deal_id)` SECURITY DEFINER helper for member read policies without RLS recursion.

### 3.2 Access model (enforced in the API — service-role client)

| Capability | Owner | deal_manager | analyst | legal / auditor / viewer | Counterparty |
|-----------|:-----:|:-----:|:-----:|:-----:|:-----:|
| Read workspace | ✅ | ✅ | ✅ | ✅ | Documents only, after signed NDA, never `restricted` |
| Add parties/tasks/DD/documents | ✅ | ✅ | ✅ | — | — |
| Invite / revoke / record NDA | ✅ | ✅ (not self) | — | — | — |
| Audit trail | ✅ | ✅ | ✅ | legal/auditor | — |
| Edit deal header, link project | ✅ | — | — | — | — |

- Invitations bind to a user only when the signed-in email is **confirmed**.
- Expired or revoked members get `404` (no existence leak).
- Counterparties never see the deal owner id, metadata, other members, parties, tasks or DD findings.

### 3.3 Lifecycle integration

`lib/enterprise-lifecycle/integrations/deal-context-adapter.js` reads the open deal linked to a project and feeds existing guards in `project-investment-lifecycle.json`:

| Guard | Evidence |
|-------|----------|
| `guard_deal_room_active` | Deal `active` + at least one active counterparty |
| `guard_nda_signed` | At least one counterparty with `nda_status = signed` |
| `guard_vdr_access` | At least one document `received` / `reviewed` / `approved` |
| `guard_due_diligence_complete` | ≥ 95% items `complete`/`not_applicable`, no `blocked`, no open `critical` rating |

No guard definitions were changed.

### 3.4 ECC

`aggregateProjectStatus` returns `deal` (visible only to the owner and non-counterparty team members) and `dealVisible`. `deriveNextBestAction` guides: open a deal → invite the first counterparty → record NDA → close due diligence. The command center shows a deal card linking to `/my-bonds/deals/`.

### 3.5 API additions (`/api/v3/deals`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/deals` | Adds `shared_deals` (existing `deals` unchanged) |
| GET | `/deals/:id` | Adds `access`, `members`; member-filtered view for non-owners |
| GET/POST | `/deals/:id/members` | List / invite |
| PATCH | `/deals/:id/members/:mid` | Role, expiry, revoke |
| POST | `/deals/:id/members/:mid/nda` | Record NDA status |
| GET | `/deals/:id/events` | Audit trail |
| POST | `/deals/:id/link` | Link project / funding case (owner only) |
| POST | `/deals` | Optional `project_id` links on creation |

## 4. Rollout safety

- Code tolerates the migration not yet being applied (falls back to legacy columns; member queries degrade to empty).
- Existing tests in `tests/deals/deal-workspace-foundation.test.js` remain green.
- New coverage: `tests/deals/deal-lifecycle-gaps.test.js`.

## 5. F.2 Secure data room and operational due diligence

F.2 extends the same Deal Workspace; it does not introduce a parallel deal system.

### 5.1 Private storage and versions

- Private Supabase Storage bucket: `deal-data-room`.
- Maximum object size: 50 MB.
- MIME allow-list for PDF, Office documents, text/CSV, JPEG/PNG/WebP.
- Uploads use server-authorized signed upload URLs. The service-role key never reaches the browser.
- Every physical upload is a version row in `bonds_deal_document_versions`; the logical document remains in `bonds_deal_documents`.
- Download URLs are generated only after deal access is re-authorized and expire after 60 seconds.
- Object paths are scoped by `deal_id/document_id/version` and include a random nonce.

### 5.2 Document visibility

`bonds_deal_documents.visibility` is one of:

- `team` — advisory team only (default).
- `counterparty` — available to signed-NDA counterparties unless confidentiality is `restricted`.
- `selected` — requires an active `bonds_deal_document_grants` row for that member.

`restricted` confidentiality always overrides counterparty grants.

### 5.3 Information requests

`bonds_deal_document_requests` tracks requested documents, assigned counterparty, due date and status.
A counterparty may upload only a request assigned to its active membership and only after NDA signature.
The received file becomes a normal versioned data-room document.

### 5.4 Auditability

`bonds_deal_document_access_log` is append-only and records authorization-sensitive events including signed upload creation, upload confirmation, signed download creation, request creation, grant changes and due-diligence updates.

### 5.5 Due-diligence workflow

Existing `bonds_deal_due_diligence_items` gains assignment, due date, evidence-document link, remediation and resolution note.
The team can progress items through `not_started → in_progress / blocked → complete`; existing lifecycle guard rules remain unchanged, so blocked or critical items continue to prevent due-diligence completion.

### 5.6 API additions

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/deals/:id/requests` | List/create information requests |
| PATCH | `/deals/:id/requests/:rid` | Update request status/details |
| POST | `/deals/:id/requests/:rid/upload-url` | Authorized requested-document upload |
| PATCH | `/deals/:id/documents/:did` | Update document visibility/status |
| POST | `/deals/:id/documents/:did/grant` | Grant/revoke selected-member access |
| POST | `/deals/:id/documents/:did/upload-url` | Create signed version upload |
| POST | `/deals/:id/documents/:did/confirm-upload` | Verify object and commit version |
| POST | `/deals/:id/documents/:did/download-url` | 60-second signed download |
| PATCH | `/deals/:id/due-diligence/:itemId` | Operational DD update |

## 6. F.3 Investor & lender pipeline

F.3 extends the existing Deal Workspace and reuses `bonds_deal_parties` as the canonical identity for investors, lenders and buyers.

- `bonds_deal_pipeline_entries` stores outreach state, relationship ownership and next action without duplicating party identity.
- `bonds_deal_offers` stores IOIs, term sheets and revised term sheets for side-by-side decision comparison.
- Equity economics (valuation/equity %) and debt economics (interest/tenor/fees) remain distinct fields so comparisons do not collapse unlike instruments.
- Creating an IOI or term sheet advances the related pipeline entry to `ioi_received` or `term_sheet_received`.
- Counterparties never receive the internal pipeline or competing offers through the API. Advisory team access follows existing Deal Workspace permissions.
- The UI is embedded in `/my-bonds/deals/` and its English mirror; no parallel deal or financing system is introduced.

### F.3 API additions

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/deals/:id/pipeline` | Add an existing investor/lender/buyer party to outreach pipeline |
| PATCH | `/deals/:id/pipeline/:entryId` | Update outreach state / next action |
| POST | `/deals/:id/offers` | Record IOI / term sheet / revised term sheet |
| PATCH | `/deals/:id/offers/:offerId` | Update review/shortlist/accept/reject state |

## 7. Not in scope (next phase)

- **F.4 Closing management**: conditions precedent checklist, signing, funds-received evidence feeding `guard_term_sheet_signed`, `guard_cap_table_approved`, `guard_funds_received`.
- Dynamic PDF watermarking on download (access is logged now; content stamping is a later hardening layer).
- Email notifications for invitations/requests (reuse existing notification templates).

## 8. Regulatory note

Bonds provides workflow and records only. It does not arrange, market or place securities; any such activity remains with licensed parties under applicable CMA / SAMA rules.
