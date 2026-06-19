# Database Audit — Bonds Global Enterprise Upgrade

## 1. Schema Overview

Current migrations define ~45 tables across:
- Auth/Identity: `profiles`, `admin_roles`, `advisory_roles`, `city_roles`, `recovery_roles`
- Subscriptions/Billing: `subscriptions`, `moyasar_invoices`, `bank_transfer_requests`
- Advisory: `advisory_clients`, `advisory_projects`, `advisory_feasibility_studies`, `advisory_financial_models`, `advisory_documents`, `advisory_notes`, `advisory_activity_logs`
- Recovery: `recovery_assets`, `recovery_plans`, `recovery_plan_stages`, `recovery_investor_offers`, `recovery_investors`, etc.
- City Intelligence: `cities`, `districts`, `city_indicator_values`, `city_competitors`, `city_projects`, `city_reports`
- AI Advisor: `ai_advisor_reports`
- Analytics: `usage_logs`, `page_views`, `page_sessions`, `contact_messages`
- Restaurant/Ingredients: `ingredients`, `ingredient_prices`, `recipes`, `recipe_ingredients`

## 2. Critical Findings

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| DB-01 | **Critical** | Duplicate indexes on `subscriptions` | `idx_subscriptions_stripe_sub`, `idx_subscriptions_stripe_sub_id`, `idx_subscriptions_stripe_subscription_id` |
| DB-02 | **Critical** | Missing table definitions for referenced indexes | `webhook_events`, `menu_engineering_scores`, `menu_ingredients`, `menu_items`, `platforms`, `promo_campaigns`, `sales_transactions` are referenced in indexes but not in current migrations |
| DB-03 | **High** | `profiles.email` is not guaranteed unique at DB level | `add_profile_email_phone.sql` adds columns, no unique constraint |
| DB-04 | **High** | No foreign key from `profiles` to `auth.users(id)` | Profiles use `id` as PK but no explicit FK constraint |
| DB-05 | **High** | `advisory_clients.email` has no unique constraint | Duplicate clients possible |
| DB-06 | **High** | `recovery_assets` lacks FK to `advisory_clients` or owner | Asset ownership is implicit |
| DB-07 | **High** | Audit columns missing `updated_by` on most tables | Only a few tables track who last modified |
| DB-08 | **High** | No soft-delete / archiving strategy | Hard deletes cause data loss and broken history |
| DB-09 | **Medium** | Missing indexes on date columns used for reporting | `subscriptions.current_period_start`, `moyasar_invoices.paid_at`, `advisory_projects.created_at` |
| DB-10 | **Medium** | `advisory_projects.status` enum values differ from recovery/workflow needs | `lead`, `active`, `on_hold`, `completed`, `cancelled` — no approval stage |
| DB-11 | **Medium** | `ai_advisor_reports.summary` is `jsonb` without schema validation | Could store inconsistent shapes |
| DB-12 | **Medium** | No partitioning for high-volume tables | `usage_logs`, `page_views`, `page_sessions` will grow unbounded |
| DB-13 | **Medium** | `public.is_advisory_user()` grants broad modify rights | Any advisory user can modify all clients/projects |
| DB-14 | **Low** | Inconsistent naming: `created_at` vs `transaction_date`, `actor_id` vs `created_by` | `advisory_activity_logs.actor_id` vs others |

## 3. Data Quality Risks

- Duplicate profiles possible because uniqueness is only enforced in application code.
- Orphan `advisory_projects` if client deleted (mitigated by `ON DELETE CASCADE`).
- Orphan documents in Storage if DB record deleted.
- Missing mandatory fields: many columns are nullable that should be required (e.g., `advisory_clients.name` is NOT NULL, good; but `advisory_clients.status` defaults to `active` without check at insert).
- Inconsistent country codes: some tables use `country`, others `country_code`.

## 4. Recommendations

1. **Clean duplicate indexes** and remove references to non-existent tables.
2. **Add unique constraints** on `profiles.email`, `advisory_clients.email`, `recovery_assets` identifier if applicable.
3. **Add `updated_by` columns and triggers** to all transactional tables.
4. **Introduce soft deletes** (`deleted_at`) on clients, projects, assets, studies.
5. **Add missing FKs** from `profiles` to `auth.users`, and from owner columns to `auth.users`.
6. **Partition** `usage_logs`, `page_views`, `page_sessions` by month.
7. **Create composite indexes** for common admin list queries: `(status, created_at DESC)`, `(created_by, created_at DESC)`.
8. **Strengthen RLS** so users only see records they own unless they have explicit manager/admin role.
9. **Create a data-quality migrations file** that fixes existing duplicates before adding unique constraints.
