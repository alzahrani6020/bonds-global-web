# ADR — Phase F: Deal Lifecycle (from preparation to close)

- **Status**: Accepted — F.0 deployed, F.1 implemented in this change
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

## 5. Not in scope (next phases)

- **F.2 Secure data room**: real uploads to a private Supabase bucket, short-lived signed URLs, per-document access log, watermarking.
- **F.3 Investor & lender pipeline**: outreach status, indications of interest, term-sheet comparison.
- **F.4 Closing management**: conditions precedent checklist, signing, funds-received evidence feeding `guard_term_sheet_signed`, `guard_cap_table_approved`, `guard_funds_received`.
- Email notifications for invitations (reuse existing notification templates).

## 6. Regulatory note

Bonds provides workflow and records only. It does not arrange, market or place securities; any such activity remains with licensed parties under applicable CMA / SAMA rules.
