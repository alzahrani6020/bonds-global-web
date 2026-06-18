# Bonds Global — Supabase Database ERD

> Generated from `supabase/migrations/`, `v3/supabase/migrations/`, and `templates/supabase-schema.sql`.

## Overview

- **Tables / entities documented:** 64
- **Extensions:** `pgcrypto`, `uuid-ossp`

## Entity Relationship Diagram

```mermaid
erDiagram
    profiles {
        uuid id
        text restaurant_name
        text email
        text phone
        text country
        text language
        text tier
        text status
        text stripe_customer_id
        text stripe_subscription_id
        timestamptz created_at
        timestamptz updated_at
        text city
        text business_type
        text bio
        text needs
        integer employee_count
        integer branch_count
        text governorate
        text city_code
        text city_name
    }
    subscriptions {
        uuid id
        uuid user_id
        text plan
        text status
        text stripe_customer_id
        text stripe_subscription_id
        timestamptz current_period_end
        timestamptz created_at
        timestamptz updated_at
    }
    moyasar_invoices {
        uuid id
        text invoice_id
        uuid user_id
        text tier
        integer amount
        text currency
        text status
        text url
        jsonb metadata
        timestamptz paid_at
        timestamptz created_at
        timestamptz updated_at
    }
    bank_transfer_requests {
        uuid id
        text name
        text email
        text phone
        text tier
        integer amount_sar
        text status
        text notes
        timestamptz created_at
        timestamptz updated_at
    }
    webhook_events {
        uuid id
        text stripe_event_id
        text event_type
        jsonb payload
        boolean processed
        timestamptz created_at
    }
    admin_roles {
        uuid id
        uuid user_id
        text role
        uuid granted_by
        timestamptz created_at
        timestamptz updated_at
    }
    site_settings {
        text key
        text value
        timestamptz updated_at
    }
    usage_exceptions {
        uuid id
        uuid user_id
        text calculator
    }
    contact_messages {
        uuid id
        text name
        text email
        text phone
        text sector
        text service
        text message
        boolean read
        text source
        timestamptz created_at
        timestamptz updated_at
    }
    usage_logs {
        uuid id
        uuid user_id
        text calculator
        text country
        jsonb inputs
        jsonb results
        text scenario_type
        text source
        timestamptz created_at
    }
    page_views {
        uuid id
        uuid user_id
        text page
        text section
        text url
        text referrer
        text lang
        text screen
        text source
        timestamptz created_at
    }
    page_sessions {
        uuid id
        uuid user_id
        text page
        text section
        int duration_seconds
        text url
        text referrer
        text lang
        text screen
        text source
        timestamptz started_at
        timestamptz created_at
    }
    scenarios {
        uuid id
        uuid user_id
        text name
        text country
        jsonb inputs
    }
    health_scores {
        uuid id
        uuid user_id
        uuid scenario_id
        text country
        integer score
        jsonb breakdown
    }
    invoice_corrections {
        uuid id
        uuid user_id
        text country
        text platform_id
        numeric(5,2) estimated_fee
        numeric(5,2) actual_fee
        numeric(5,2) difference
        text notes
        date invoice_date
        timestamptz created_at
    }
    projects {
        uuid id
        uuid user_id
        text sector
        text sector_label
        text sector_risk
        text activity
        numeric capital
        numeric revenue
        numeric monthly_profit
        numeric annual_profit
        numeric roi_months
        numeric break_even_revenue
        integer score
        text verdict
        text summary
        jsonb recommendations
        timestamptz created_at
        timestamptz updated_at
    }
    ingredients {
        uuid id
        uuid user_id
        text name
        text name_en
        text unit
    }
    ingredient_prices {
        uuid id
        uuid ingredient_id
        numeric(10,2) price
        timestamptz changed_at
    }
    recipes {
        uuid id
        uuid user_id
        text name
        text name_en
        text country
        numeric(10,2) selling_price
        numeric(10,2) target_profit
        numeric(5,2) waste_buffer_pct
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    recipe_ingredients {
        uuid id
        uuid recipe_id
        uuid ingredient_id
        numeric(10,3) quantity
        text unit
        timestamptz created_at
    }
    vat_transactions {
        uuid id
        uuid user_id
        text transaction_type
        text platform_id
        numeric(12,2) amount_before_vat
        numeric(12,2) vat_amount
        numeric(5,2) vat_rate
        text invoice_number
        date transaction_date
        timestamptz created_at
    }
    platforms {
        uuid id
        uuid user_id
        text code
    }
    menu_items {
        uuid id
        uuid user_id
        text name
        text name_en
        text category
    }
    menu_item_ingredients {
        uuid id
        uuid menu_item_id
        uuid ingredient_id
        decimal(10, 4) quantity_needed
    }
    menu_platform_prices {
        uuid id
        uuid menu_item_id
        uuid platform_id
        decimal(10, 2) platform_price
    }
    sales_transactions {
        uuid id
        uuid user_id
        uuid menu_item_id
        uuid platform_id
        integer quantity
        decimal(10, 2) unit_price
        decimal(12, 2) total_revenue
        decimal(12, 2) commission_deduction
        decimal(12, 2) service_fee_deduction
        decimal(12, 2) net_revenue
        date transaction_date
        timestamptz created_at
    }
    menu_engineering_scores {
        uuid id
        uuid user_id
        uuid menu_item_id
        uuid platform_id
    }
    promo_campaigns {
        uuid id
        uuid user_id
        text name
        uuid platform_id
        uuid menu_item_id
    }
    economic_sectors {
        uuid id
        text code
        text name_ar
        text name_en
        text description
        text icon_url
        text risk_category
        boolean is_active
        integer sort_order
        timestamptz created_at
        timestamptz updated_at
    }
    economic_sub_sectors {
        uuid id
        uuid sector_id
        text code
        text name_ar
        text name_en
        text description
        boolean is_active
        integer sort_order
        timestamptz created_at
        timestamptz updated_at
    }
    economic_activities {
        uuid id
        uuid sector_id
        uuid sub_sector_id
        text code
        text name_ar
        text name_en
        text description
        boolean is_active
        integer sort_order
        timestamptz created_at
        timestamptz updated_at
    }
    economic_activity_details {
        uuid id
        uuid activity_id
        text code
        text name_ar
        text name_en
        text description
        int sort_order
        boolean is_active
        timestamptz created_at
    }
    project_models {
        uuid id
        uuid sector_id
        uuid sub_sector_id
        uuid activity_id
        text code
        text name_ar
        text name_en
        text description
        text model_type
        text size_category
        text default_currency
        uuid activity_detail_id
        numeric(5,2) roi_min
        numeric(5,2) roi_avg
        numeric(5,2) roi_max
        numeric(5,2) irr_min
        numeric(5,2) irr_avg
        numeric(5,2) irr_max
        numeric(14,2) npv_min
        numeric(14,2) npv_avg
        numeric(14,2) npv_max
        int payback_months_min
        int payback_months_avg
        int payback_months_max
        numeric(14,2) break_even_revenue_min
        numeric(14,2) break_even_revenue_avg
        numeric(14,2) break_even_revenue_max
        numeric(14,2) land_cost_min
        numeric(14,2) land_cost_avg
        numeric(14,2) land_cost_max
        numeric(12,2) construction_cost_per_sqm
        numeric(14,2) equipment_cost_min
        numeric(14,2) equipment_cost_avg
        numeric(14,2) equipment_cost_max
        numeric(14,2) monthly_operation_cost_min
        numeric(14,2) monthly_operation_cost_avg
        numeric(14,2) monthly_operation_cost_max
    }
    financial_assumptions {
        uuid id
        text code
        text name_ar
        text name_en
        text category
        text unit_type
        numeric(14,4) default_value
        numeric(14,4) min_value
        numeric(14,4) max_value
        text description
        text source
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    project_model_assumptions {
        uuid id
        uuid project_model_id
        uuid assumption_id
        numeric(14,4) value
        text override_notes
        boolean is_locked
        timestamptz created_at
        timestamptz updated_at
    }
    regulatory_requirements {
        uuid id
        uuid sector_id
        uuid sub_sector_id
        uuid activity_id
        uuid activity_detail_id
        uuid project_model_id
        text requirement_name_ar
        text requirement_name_en
        text issuing_authority
        numeric(14,2) estimated_cost
        boolean mandatory
        int sort_order
        timestamptz created_at
    }
    cities {
        uuid id
        text code
        text name_ar
        text name_en
        text region
        text country_code
        integer population
        numeric(6,3) population_growth_rate
        numeric(14,2) avg_household_income
        numeric(6,2) purchasing_power_index
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
        numeric(10, 7) lat
        numeric(10, 7) lng
        text region_code
        numeric(14,2) gdp_city
        numeric(5,2) growth_rate
        numeric(5,2) unemployment_rate
        int establishments_count
        numeric(5,2) inflation_rate
        numeric(5,2) business_ease_index
    }
    risk_factors {
        uuid id
        text code
        text name_ar
        text name_en
        text category
        numeric(4,2) weight
        integer default_score
        text description
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    project_model_risks {
        uuid id
        uuid project_model_id
        uuid risk_factor_id
        integer score
        text notes
        timestamptz created_at
        timestamptz updated_at
    }
    city_risk_adjustments {
        uuid id
        uuid city_id
        uuid risk_factor_id
        integer adjustment
    }
    city_market_data {
        uuid id
        uuid city_id
        uuid activity_id
        integer competitors_count
        numeric(6,2) avg_market_share
        numeric(5,2) opportunity_score
        integer opportunity_rank
        jsonb opportunity_breakdown
        numeric(14,2) market_size
        numeric(5,2) annual_growth_rate
        numeric(12,2) per_capita_spending
        text expected_demand
        numeric(5,2) profit_margin_min
        numeric(5,2) profit_margin_avg
        numeric(5,2) profit_margin_max
        numeric(5,2) risk_score
        int confidence
        integer specialists_count
        integer saudization_rate
        numeric warehouse_rent_per_sqm
        numeric factory_rent_per_sqm
        numeric construction_cost_per_sqm
        numeric equipment_cost_min
        numeric equipment_cost_avg
        numeric equipment_cost_max
        numeric monthly_operation_cost_min
        numeric monthly_operation_cost_avg
        numeric monthly_operation_cost_max
    }
    city_indicators {
        uuid id
        uuid city_id
        int year
        numeric(14,2) gdp_city
        numeric(5,2) growth_rate
        numeric(5,2) unemployment_rate
        int establishments_count
        numeric(5,2) inflation_rate
        numeric(5,2) business_ease_index
        numeric(12,2) avg_rent_per_sqm
        numeric(12,2) avg_land_price_per_sqm
        numeric(12,2) warehouse_rent_per_sqm
        numeric(12,2) factory_rent_per_sqm
        int new_licenses_count
        numeric(14,2) investment_volume
        numeric(5,2) saturation_index
        int overall_confidence
        jsonb metadata
        timestamptz updated_at
    }
    normalized_metrics {
        uuid id
        text metric_code
        uuid city_id
        uuid activity_id
        int year
        numeric value
        text value_text
        text source_id
        text source_name
        text source_url
        int confidence
        text confidence_reason
        timestamptz fetched_at
        date valid_from
        date valid_until
        boolean is_override
        jsonb metadata
        timestamptz created_at
    }
    metric_definitions {
        text code
        text category
        text name_ar
        text name_en
        text unit
        text data_type
        text default_confidence_method
        text description
        int sort_order
        boolean is_active
        timestamptz created_at
    }
    country_benchmarks {
        uuid id
        text country_code
        text metric_code
        numeric benchmark_value
        int year
        text source
        timestamptz created_at
        timestamptz updated_at
    }
    official_country_data {
        uuid id
        text country_code
        integer year
        text metric_code
        numeric value
        text value_text
        text source
        text source_url
        integer confidence
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }
    city_competitor_calibration {
        uuid id
        uuid city_id
        uuid activity_id
        text metric_code
        int year
        numeric raw_value
        numeric calibrated_value
        numeric factor
        text source
        text notes
        timestamptz created_at
        timestamptz updated_at
    }
    companies {
        uuid id
        text name
        text type
        uuid owner_user_id
        text subscription_tier
        jsonb settings
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    company_members {
        uuid id
        uuid company_id
        uuid user_id
        text role
        timestamptz joined_at
    }
    user_projects {
        uuid id
        uuid user_id
        uuid company_id
        uuid project_model_id
        uuid city_id
        text name
        text status
    }
    reports {
        uuid id
        uuid project_id
        text type
        text format
        text file_url
        text status
        timestamptz created_at
        timestamptz updated_at
    }
    project_scenarios {
        uuid id
        uuid user_id
        uuid project_id
        text name
        text description
        text project_model_code
        text city_code
        jsonb baseline_assumptions
        jsonb shocks
        jsonb results
        boolean is_saved
        timestamptz created_at
        timestamptz updated_at
    }
    alert_rules {
        uuid id
        text name
        text description
        text metric_code
        text entity_type
        uuid city_id
        uuid activity_id
        text threshold_type
        numeric threshold_value
        text severity
        boolean is_active
        boolean check_previous_year
        timestamptz created_at
        timestamptz updated_at
    }
    alerts {
        uuid id
        uuid rule_id
        uuid city_id
        uuid activity_id
        text metric_code
        numeric old_value
        numeric new_value
        numeric change_value
        numeric change_percent
        text severity
        text message
        boolean is_read
        boolean sent_email
        boolean sent_webhook
        timestamptz created_at
        text insight
        timestamptz detected_at
    }
    data_source_runs {
        uuid id
        text source_id
        text run_type
        text status
        timestamptz started_at
        timestamptz finished_at
        int records_fetched
        int records_valid
        int records_imported
        jsonb errors
        jsonb metadata
    }
    raw_data {
        uuid id
        uuid run_id
        text source_id
        text external_id
        jsonb raw_payload
        timestamptz fetched_at
    }
    data_source_quality {
        uuid id
        text source_id
        uuid city_id
        uuid activity_id
        int year
        text metric_code
        boolean success
        int count
        int confidence
        text source_method
        text failure_reason
        int attempts
        int successes
        timestamptz last_attempted_at
        timestamptz last_success_at
        timestamptz created_at
        timestamptz updated_at
    }
    http_cache {
        text key
        jsonb value
        timestamptz expires_at
        timestamptz created_at
    }
    ml_models {
        uuid id
        text metric_code
        text feature_key
        text country_code
        numeric slope
        numeric intercept
        numeric r_squared
        int sample_count
        jsonb feature_stats
        timestamptz trained_at
        text model_type
        jsonb weights
        jsonb feature_means
        jsonb feature_stds
        numeric target_mean
        numeric rmse
        numeric mape
    }
    metric_feedback {
        uuid id
        text metric_code
        uuid city_id
        uuid activity_id
        int year
        numeric estimated_value
        text estimated_value_text
        numeric actual_value
        text actual_value_text
        uuid project_id
        text source
        int confidence
        text notes
        timestamptz created_at
        timestamptz updated_at
    }
    data_feedback {
        uuid id
        uuid city_id
        uuid activity_id
        integer year
        text metric_code
        numeric current_value
        numeric suggested_value
        text reason
        text source_url
        text status
        uuid reviewed_by
        timestamptz reviewed_at
        timestamptz created_at
        timestamptz updated_at
    }
    confidence_log {
        uuid id
        uuid city_id
        uuid activity_id
        integer year
        text metric_code
        integer old_confidence
        integer new_confidence
        text reason
        text source
        timestamptz created_at
    }
    ingredients ||--o{ auth.users : "references"
    platforms ||--o{ auth.users : "references"
    menu_items ||--o{ auth.users : "references"
    menu_item_ingredients ||--o{ menu_items : "references"
    menu_item_ingredients ||--o{ ingredients : "references"
    menu_platform_prices ||--o{ menu_items : "references"
    menu_platform_prices ||--o{ platforms : "references"
    sales_transactions ||--o{ auth.users : "references"
    sales_transactions ||--o{ menu_items : "references"
    sales_transactions ||--o{ platforms : "references"
    menu_engineering_scores ||--o{ auth.users : "references"
    menu_engineering_scores ||--o{ menu_items : "references"
    menu_engineering_scores ||--o{ platforms : "references"
    promo_campaigns ||--o{ auth.users : "references"
    promo_campaigns ||--o{ platforms : "references"
    promo_campaigns ||--o{ menu_items : "references"
    admin_roles ||--o| auth.users : "references"
    admin_roles ||--o{ auth.users : "references"
    usage_logs ||--o{ auth.users : "references"
    moyasar_invoices ||--o{ auth.users : "references"
    usage_exceptions ||--o{ auth.users : "references"
    page_views ||--o{ auth.users : "references"
    page_sessions ||--o{ auth.users : "references"
    projects ||--o{ auth.users : "references"
    subscriptions ||--o{ auth.users : "references"
    economic_sub_sectors ||--o{ economic_sectors : "references"
    economic_activities ||--o{ economic_sectors : "references"
    economic_activities ||--o{ economic_sub_sectors : "references"
    project_models ||--o{ economic_sectors : "references"
    project_models ||--o{ economic_sub_sectors : "references"
    project_models ||--o{ economic_activities : "references"
    project_model_assumptions ||--o{ project_models : "references"
    project_model_assumptions ||--o{ financial_assumptions : "references"
    city_market_data ||--o{ cities : "references"
    city_market_data ||--o{ economic_activities : "references"
    project_model_risks ||--o{ project_models : "references"
    project_model_risks ||--o{ risk_factors : "references"
    city_risk_adjustments ||--o{ cities : "references"
    city_risk_adjustments ||--o{ risk_factors : "references"
    companies ||--o{ auth.users : "references"
    company_members ||--o{ companies : "references"
    company_members ||--o{ auth.users : "references"
    user_projects ||--o{ auth.users : "references"
    user_projects ||--o{ companies : "references"
    user_projects ||--o{ project_models : "references"
    user_projects ||--o{ cities : "references"
    reports ||--o{ user_projects : "references"
    economic_activity_details ||--o{ economic_activities : "references"
    regulatory_requirements ||--o{ economic_sectors : "references"
    regulatory_requirements ||--o{ economic_sub_sectors : "references"
    regulatory_requirements ||--o{ economic_activities : "references"
    regulatory_requirements ||--o{ economic_activity_details : "references"
    regulatory_requirements ||--o{ project_models : "references"
    raw_data ||--o{ data_source_runs : "references"
    normalized_metrics ||--o{ metric_definitions : "references"
    normalized_metrics ||--o{ cities : "references"
    normalized_metrics ||--o{ economic_activities : "references"
    city_indicators ||--o{ cities : "references"
    project_scenarios ||--o{ auth.users : "references"
    project_scenarios ||--o{ user_projects : "references"
    alert_rules ||--o{ cities : "references"
    alert_rules ||--o{ economic_activities : "references"
    alerts ||--o{ alert_rules : "references"
    alerts ||--o{ cities : "references"
    alerts ||--o{ economic_activities : "references"
    metric_feedback ||--o{ metric_definitions : "references"
    metric_feedback ||--o{ cities : "references"
    metric_feedback ||--o{ economic_activities : "references"
    metric_feedback ||--o{ user_projects : "references"
    data_feedback ||--o{ cities : "references"
    data_feedback ||--o{ economic_activities : "references"
    confidence_log ||--o{ cities : "references"
    confidence_log ||--o{ economic_activities : "references"
    data_source_quality ||--o{ cities : "references"
    data_source_quality ||--o{ economic_activities : "references"
    city_competitor_calibration ||--o{ cities : "references"
    city_competitor_calibration ||--o{ economic_activities : "references"
    profiles ||--o| auth.users : "references"
    scenarios ||--o{ auth.users : "references"
    health_scores ||--o{ auth.users : "references"
    health_scores ||--o{ scenarios : "references"
    invoice_corrections ||--o{ auth.users : "references"
    ingredient_prices ||--o{ ingredients : "references"
    recipes ||--o{ auth.users : "references"
    recipe_ingredients ||--o{ recipes : "references"
    recipe_ingredients ||--o{ ingredients : "references"
    vat_transactions ||--o{ auth.users : "references"
```

## Auth (Supabase built-in)

### `auth.users`

| Column | Type / Definition |
|--------|-------------------|

**RLS:** not enabled

## Users & Profiles

### `profiles`
*User profiles extending Supabase Auth*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid references auth.users on delete cascade primary key |
| `restaurant_name` | text |
| `email` | text |
| `phone` | text |
| `country` | text |
| `language` | text default 'ar' |
| `tier` | text default 'free' check (tier in ('free','pro','enterprise')) |
| `status` | text default 'active' check (status in ('active','inactive','trialing','past_due')) |
| `stripe_customer_id` | text |
| `stripe_subscription_id` | text |
| `created_at` | timestamptz default now() |
| `updated_at` | timestamptz default now() |
| `city` | text |
| `business_type` | text |
| `bio` | text |
| `needs` | text |
| `employee_count` | integer |
| `branch_count` | integer |
| `governorate` | text |
| `city_code` | text |
| `city_name` | text |

**Indexes:** `idx_profiles_stripe_customer (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL`

**RLS Policies:**
- `Users can read own profile` — FOR select
  - USING: `auth.uid() = id`
- `Users can insert own profile` — FOR INSERT TO authenticated
  - WITH CHECK: `auth.uid() = id`
- `Users can update own profile` — FOR update
  - USING: `auth.uid() = id`
- `Users can delete own profile` — FOR DELETE TO authenticated
  - USING: `auth.uid() = id`

**RLS:** enabled

## Billing & Subscriptions

### `subscriptions`
*Stripe-linked subscription records*

**Definition 1** (supabase\migrations\20260611000000_v2_core_tables.sql)

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `plan` | TEXT NOT NULL DEFAULT 'free' |
| `status` | TEXT NOT NULL DEFAULT 'inactive' |
| `stripe_customer_id` | TEXT |
| `stripe_subscription_id` | TEXT |
| `current_period_end` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Table-level constraints:** `UNIQUE (user_id)`

**Definition 2** (v3\supabase\migrations\20260613000000_v3_subscriptions.sql)

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `stripe_customer_id` | text |
| `stripe_subscription_id` | text UNIQUE |
| `status` | text NOT NULL DEFAULT 'incomplete' |
| `tier` | text NOT NULL DEFAULT 'free' |
| `current_period_start` | timestamptz |
| `current_period_end` | timestamptz |
| `created_at` | timestamptz NOT NULL DEFAULT now() |
| `updated_at` | timestamptz NOT NULL DEFAULT now() |

**Definition 3** (templates\supabase-schema.sql)

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `user_id` | uuid references auth.users on delete cascade not null |
| `tier` | text not null check (tier in ('free','pro','enterprise')) |
| `status` | text not null default 'inactive' check (status in ('active','inactive','trialing','past_due','cancelled')) |
| `stripe_subscription_id` | text |
| `stripe_price_id` | text |
| `current_period_start` | timestamptz |
| `current_period_end` | timestamptz |
| `cancel_at_period_end` | boolean default false |
| `created_at` | timestamptz default now() |
| `updated_at` | timestamptz default now() |

**Table-level constraints:** `unique(user_id)`

**Indexes:** `UNIQUE idx_subscriptions_user (user_id)`, `idx_subscriptions_stripe_sub (stripe_subscription_id)`, `idx_subscriptions_user_id (user_id)`, `idx_subscriptions_stripe_sub_id (stripe_subscription_id)`, `idx_subscriptions_stripe_subscription_id (stripe_subscription_id)`, `idx_subscriptions_user (user_id)`

**RLS Policies:**
- `Users can view own subscription` — FOR SELECT TO authenticated
  - USING: `auth.uid() = user_id`
- `Users can read own subscription` — FOR select
  - USING: `auth.uid() = user_id`
- `Service role can manage subscriptions` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `moyasar_invoices`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid DEFAULT gen_random_uuid() PRIMARY KEY |
| `invoice_id` | text NOT NULL UNIQUE |
| `user_id` | uuid REFERENCES auth.users NOT NULL |
| `tier` | text NOT NULL CHECK (tier IN ('pro', 'enterprise')) |
| `amount` | integer NOT NULL |
| `currency` | text NOT NULL DEFAULT 'SAR' |
| `status` | text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending', 'paid', 'failed', 'expired')) |
| `url` | text |
| `metadata` | jsonb DEFAULT '{}' |
| `paid_at` | timestamptz |
| `created_at` | timestamptz DEFAULT now() |
| `updated_at` | timestamptz DEFAULT now() |

**Indexes:** `idx_moyasar_invoices_user_id (user_id)`, `idx_moyasar_invoices_status (status)`

**RLS Policies:**
- `Users can view own moyasar invoices` — FOR SELECT
  - USING: `auth.uid() = user_id`
- `Service role can manage all moyasar invoices` — FOR ALL
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `bank_transfer_requests`
*طلبات التحويل البنكي المباشر*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid DEFAULT gen_random_uuid() PRIMARY KEY |
| `name` | text NOT NULL |
| `email` | text NOT NULL |
| `phone` | text |
| `tier` | text NOT NULL CHECK (tier IN ('pro', 'enterprise')) |
| `amount_sar` | integer NOT NULL |
| `status` | text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')) |
| `notes` | text |
| `created_at` | timestamptz DEFAULT now() |
| `updated_at` | timestamptz DEFAULT now() |

**RLS Policies:**
- `Anyone can submit bank transfer` — FOR INSERT
  - WITH CHECK: `true`
- `Service role can manage bank transfers` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`
- `Block public reads on bank transfers` — FOR SELECT
  - USING: `false`

**RLS:** enabled

### `webhook_events`
*Incoming Stripe webhook audit log*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `stripe_event_id` | text unique not null |
| `event_type` | text not null |
| `payload` | jsonb not null |
| `processed` | boolean default false |
| `created_at` | timestamptz default now() |

**Indexes:** `UNIQUE idx_webhook_stripe_event (stripe_event_id)`, `idx_webhook_processed (processed, created_at)`, `idx_webhook_events_stripe (stripe_event_id)`

**RLS:** enabled

## Admin & Settings

### `admin_roles`
*Admin role assignments for dashboard RBAC*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid DEFAULT gen_random_uuid() PRIMARY KEY |
| `user_id` | uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE |
| `role` | text NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'support', 'viewer')) |
| `granted_by` | uuid REFERENCES auth.users |
| `created_at` | timestamptz DEFAULT now() |
| `updated_at` | timestamptz DEFAULT now() |

**RLS:** enabled

### `site_settings`
*إعدادات الموقع العامة*

| Column | Type / Definition |
|--------|-------------------|
| `key` | text PRIMARY KEY |
| `value` | text NOT NULL |
| `updated_at` | timestamptz DEFAULT now() |

**RLS Policies:**
- `Service role can manage site_settings` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`
- `Anyone can read site_settings` — FOR SELECT
  - USING: `true`

**RLS:** enabled

### `usage_exceptions`
*استثناءات استخدام لعملاء محددين*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid DEFAULT gen_random_uuid() PRIMARY KEY |
| `user_id` | uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL |
| `calculator` | text NOT NULL DEFAULT 'all' |

**RLS Policies:**
- `Service role can manage usage_exceptions` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`
- `Block public access to exceptions` — FOR SELECT
  - USING: `false`

**RLS:** enabled

### `contact_messages`
*Contact form submissions*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid DEFAULT gen_random_uuid() PRIMARY KEY |
| `name` | text NOT NULL |
| `email` | text NOT NULL |
| `phone` | text |
| `sector` | text |
| `service` | text |
| `message` | text NOT NULL |
| `read` | boolean DEFAULT false |
| `source` | text DEFAULT 'website' |
| `created_at` | timestamptz DEFAULT now() |
| `updated_at` | timestamptz DEFAULT now() |

**RLS Policies:**
- `Service role can read contact messages` — FOR SELECT
  - USING: `false`
- `Anyone can submit contact message` — FOR INSERT
  - WITH CHECK: `true`

**RLS:** enabled

## Analytics & Tracking

### `usage_logs`
*Calculator usage analytics*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid DEFAULT gen_random_uuid() PRIMARY KEY |
| `user_id` | uuid REFERENCES auth.users ON DELETE SET NULL |
| `calculator` | text NOT NULL |
| `country` | text |
| `inputs` | jsonb |
| `results` | jsonb |
| `scenario_type` | text |
| `source` | text DEFAULT 'web' |
| `created_at` | timestamptz DEFAULT now() |

**Indexes:** `idx_usage_logs_calculator (calculator)`, `idx_usage_logs_country (country)`, `idx_usage_logs_created_at (created_at DESC)`

**RLS Policies:**
- `Service role can read usage logs` — FOR SELECT
  - USING: `false`
- `Anyone can log usage` — FOR INSERT
  - WITH CHECK: `true`

**RLS:** enabled

### `page_views`
*Page view tracking by section and page*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid DEFAULT gen_random_uuid() PRIMARY KEY |
| `user_id` | uuid REFERENCES auth.users ON DELETE SET NULL |
| `page` | text |
| `section` | text |
| `url` | text |
| `referrer` | text |
| `lang` | text |
| `screen` | text |
| `source` | text DEFAULT 'web' |
| `created_at` | timestamptz DEFAULT now() |

**Indexes:** `idx_page_views_created (created_at)`, `idx_page_views_page (page)`, `idx_page_views_section (section)`, `idx_page_views_user_id (user_id)`

**RLS Policies:**
- `Allow anonymous page view inserts` — FOR INSERT
  - WITH CHECK: `true`

**RLS:** enabled

### `page_sessions`
*Session duration tracking per page*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid DEFAULT gen_random_uuid() PRIMARY KEY |
| `user_id` | uuid REFERENCES auth.users ON DELETE SET NULL |
| `page` | text |
| `section` | text |
| `duration_seconds` | int |
| `url` | text |
| `referrer` | text |
| `lang` | text |
| `screen` | text |
| `source` | text DEFAULT 'web' |
| `started_at` | timestamptz |
| `created_at` | timestamptz DEFAULT now() |

**Indexes:** `idx_page_sessions_started (started_at)`, `idx_page_sessions_page (page)`, `idx_page_sessions_user_id (user_id)`

**RLS Policies:**
- `Allow anonymous session inserts` — FOR INSERT
  - WITH CHECK: `true`

**RLS:** enabled

## Scenarios & Calculators (V1/V2)

### `scenarios`
*Saved restaurant calculator scenarios*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `user_id` | uuid references auth.users on delete cascade not null |
| `name` | text not null |
| `country` | text not null |
| `inputs` | jsonb not null |

**Indexes:** `idx_scenarios_user (user_id)`, `idx_scenarios_country (country)`

**RLS Policies:**
- `Users can CRUD own scenarios` — FOR all
  - USING: `auth.uid() = user_id`
- `Public scenarios are readable` — FOR select
  - USING: `is_public = true`

**RLS:** enabled

### `health_scores`
*Restaurant health score history*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `user_id` | uuid references auth.users on delete cascade not null |
| `scenario_id` | uuid references public.scenarios on delete set null |
| `country` | text not null |
| `score` | integer not null check (score >= 0 and score <= 100) |
| `breakdown` | jsonb not null |

**Indexes:** `idx_health_scores_user (user_id)`, `idx_health_scores_created (created_at desc)`

**RLS Policies:**
- `Users can read own health scores` — FOR select
  - USING: `auth.uid() = user_id`
- `Users can insert own health scores` — FOR insert
  - WITH CHECK: `auth.uid() = user_id`

**RLS:** enabled

### `invoice_corrections`
*User-verified actual platform fees vs estimates*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `user_id` | uuid references auth.users on delete cascade not null |
| `country` | text not null |
| `platform_id` | text not null |
| `estimated_fee` | numeric(5,2) not null |
| `actual_fee` | numeric(5,2) not null |
| `difference` | numeric(5,2) generated always as (actual_fee - estimated_fee) stored |
| `notes` | text |
| `invoice_date` | date |
| `created_at` | timestamptz default now() |

**Table-level constraints:** `unique(user_id, country, platform_id)`

**Indexes:** `idx_corrections_user (user_id)`

**RLS Policies:**
- `Users can CRUD own corrections` — FOR all
  - USING: `auth.uid() = user_id`

**RLS:** enabled

### `projects`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `sector` | TEXT NOT NULL |
| `sector_label` | TEXT |
| `sector_risk` | TEXT |
| `activity` | TEXT NOT NULL |
| `capital` | NUMERIC NOT NULL DEFAULT 0 |
| `revenue` | NUMERIC NOT NULL DEFAULT 0 |
| `monthly_profit` | NUMERIC |
| `annual_profit` | NUMERIC |
| `roi_months` | NUMERIC |
| `break_even_revenue` | NUMERIC |
| `score` | INTEGER |
| `verdict` | TEXT |
| `summary` | TEXT |
| `recommendations` | JSONB |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Indexes:** `idx_projects_user_id (user_id)`

**RLS Policies:**
- `Users can view own projects` — FOR SELECT TO authenticated
  - USING: `auth.uid() = user_id`
- `Users can insert own projects` — FOR INSERT TO authenticated
  - WITH CHECK: `auth.uid() = user_id`
- `Users can update own projects` — FOR UPDATE TO authenticated
  - USING: `auth.uid() = user_id`
- `Users can delete own projects` — FOR DELETE TO authenticated
  - USING: `auth.uid() = user_id`

**RLS:** enabled

## Recipe & Menu Engineering

### `ingredients`
*User ingredient inventory for recipe costing*

**Definition 1** (supabase\migrations\20260530120000_menu_engineering_schema.sql)

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT uuid_generate_v4() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `name` | TEXT NOT NULL |
| `name_en` | TEXT |
| `unit` | TEXT NOT NULL DEFAULT 'kg' |

**Definition 2** (templates\supabase-schema.sql)

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `user_id` | uuid references auth.users on delete cascade not null |
| `name` | text not null |
| `name_en` | text |
| `category` | text default 'other' |
| `unit` | text not null |
| `current_price` | numeric(10,2) not null default 0 |
| `vat_included` | boolean default true |
| `supplier` | text |
| `country` | text |
| `created_at` | timestamptz default now() |
| `updated_at` | timestamptz default now() |

**Indexes:** `idx_ingredients_user (user_id)`, `idx_ingredients_name_user (user_id, name)`

**RLS Policies:**
- `Users can CRUD their own ingredients` — FOR ALL
  - USING: `auth.uid() = user_id`
- `Users can CRUD own ingredients` — FOR all
  - USING: `auth.uid() = user_id`

**RLS:** enabled

### `ingredient_prices`
*Ingredient price change history*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `ingredient_id` | uuid references public.ingredients on delete cascade not null |
| `price` | numeric(10,2) not null |
| `changed_at` | timestamptz default now() |

**Indexes:** `idx_ingredient_prices_ingredient (ingredient_id)`

**RLS Policies:**
- `Users can read own ingredient prices` — FOR select
  - USING: `exists (select 1 from public.ingredients i where i.id = ingredient_id and i.user_id = auth.uid())`

**RLS:** enabled

### `recipes`
*User recipe/dish definitions*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `user_id` | uuid references auth.users on delete cascade not null |
| `name` | text not null |
| `name_en` | text |
| `country` | text |
| `selling_price` | numeric(10,2) |
| `target_profit` | numeric(10,2) default 0 |
| `waste_buffer_pct` | numeric(5,2) default 5 |
| `is_active` | boolean default true |
| `created_at` | timestamptz default now() |
| `updated_at` | timestamptz default now() |

**Indexes:** `idx_recipes_user (user_id)`

**RLS Policies:**
- `Users can CRUD own recipes` — FOR all
  - USING: `auth.uid() = user_id`

**RLS:** enabled

### `recipe_ingredients`
*Links recipes to ingredients with quantities*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `recipe_id` | uuid references public.recipes on delete cascade not null |
| `ingredient_id` | uuid references public.ingredients on delete cascade not null |
| `quantity` | numeric(10,3) not null default 0 |
| `unit` | text not null |
| `created_at` | timestamptz default now() |

**Table-level constraints:** `unique(recipe_id, ingredient_id)`

**Indexes:** `idx_recipe_ingredients_recipe (recipe_id)`

**RLS Policies:**
- `Users can CRUD own recipe ingredients` — FOR all
  - USING: `exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())`

**RLS:** enabled

### `vat_transactions`
*VAT input/output tracking for tax reconciliation*

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid default gen_random_uuid() primary key |
| `user_id` | uuid references auth.users on delete cascade not null |
| `transaction_type` | text not null check (transaction_type in ('output_sale','input_purchase')) |
| `platform_id` | text |
| `amount_before_vat` | numeric(12,2) not null |
| `vat_amount` | numeric(12,2) not null |
| `vat_rate` | numeric(5,2) default 15 |
| `invoice_number` | text |
| `transaction_date` | date default now() |
| `created_at` | timestamptz default now() |

**Indexes:** `idx_vat_transactions_user (user_id)`, `idx_vat_transactions_date (transaction_date desc)`

**RLS Policies:**
- `Users can CRUD own vat transactions` — FOR all
  - USING: `auth.uid() = user_id`

**RLS:** enabled

### `platforms`
*منصات التوصيل لكل مستخدم*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT uuid_generate_v4() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `code` | TEXT NOT NULL |

**Indexes:** `idx_platforms_user (user_id)`

**RLS Policies:**
- `Users can CRUD their own platforms` — FOR ALL
  - USING: `auth.uid() = user_id`

**RLS:** enabled

### `menu_items`
*المنتجات والوجبات في المنيو*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT uuid_generate_v4() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `name` | TEXT NOT NULL |
| `name_en` | TEXT |
| `category` | TEXT DEFAULT 'main' |

**Indexes:** `idx_menu_items_user (user_id)`

**RLS Policies:**
- `Users can CRUD their own menu_items` — FOR ALL
  - USING: `auth.uid() = user_id`

**RLS:** enabled

### `menu_item_ingredients`
*كميات المكونات لكل وجبة*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT uuid_generate_v4() |
| `menu_item_id` | UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE |
| `ingredient_id` | UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE |
| `quantity_needed` | DECIMAL(10, 4) NOT NULL DEFAULT 1 |

**RLS Policies:**
- `Users can CRUD their own menu_item_ingredients` — FOR ALL
  - USING: `EXISTS (SELECT 1 FROM menu_items WHERE id = menu_item_ingredients.menu_item_id AND user_id = auth.uid())`

**RLS:** enabled

### `menu_platform_prices`
*سعر كل وجبة في كل منصة*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT uuid_generate_v4() |
| `menu_item_id` | UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE |
| `platform_id` | UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE |
| `platform_price` | DECIMAL(10, 2) NOT NULL |

**RLS Policies:**
- `Users can CRUD their own menu_platform_prices` — FOR ALL
  - USING: `EXISTS (SELECT 1 FROM menu_items WHERE id = menu_platform_prices.menu_item_id AND user_id = auth.uid())`

**RLS:** enabled

### `sales_transactions`
*المبيعات اليومية لكل وجبة ومنصة*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT uuid_generate_v4() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `menu_item_id` | UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE |
| `platform_id` | UUID REFERENCES platforms(id) ON DELETE SET NULL |
| `quantity` | INTEGER NOT NULL DEFAULT 1 |
| `unit_price` | DECIMAL(10, 2) NOT NULL |
| `total_revenue` | DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED |
| `commission_deduction` | DECIMAL(12, 2) DEFAULT 0 |
| `service_fee_deduction` | DECIMAL(12, 2) DEFAULT 0 |
| `net_revenue` | DECIMAL(12, 2) DEFAULT 0 |
| `transaction_date` | DATE NOT NULL DEFAULT CURRENT_DATE |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() |

**Indexes:** `idx_sales_user_date (user_id, transaction_date)`, `idx_sales_menu_platform (menu_item_id, platform_id)`, `idx_sales_user_menu_platform (user_id, menu_item_id, platform_id)`, `idx_sales_date (transaction_date)`

**RLS Policies:**
- `Users can CRUD their own sales` — FOR ALL
  - USING: `auth.uid() = user_id`

**RLS:** enabled

### `menu_engineering_scores`
*نتائج تصنيف هندسة المنيو*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT uuid_generate_v4() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `menu_item_id` | UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE |
| `platform_id` | UUID REFERENCES platforms(id) ON DELETE SET NULL |

**Indexes:** `idx_engineering_user (user_id)`, `idx_engineering_category (category)`

**RLS Policies:**
- `Users can CRUD their own engineering scores` — FOR ALL
  - USING: `auth.uid() = user_id`

**RLS:** enabled

### `promo_campaigns`
*محاكاة حملات الخصم*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT uuid_generate_v4() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `name` | TEXT NOT NULL |
| `platform_id` | UUID REFERENCES platforms(id) ON DELETE SET NULL |
| `menu_item_id` | UUID REFERENCES menu_items(id) ON DELETE SET NULL |

**Indexes:** `idx_promo_user (user_id)`

**RLS Policies:**
- `Users can CRUD their own promos` — FOR ALL
  - USING: `auth.uid() = user_id`

**RLS:** enabled

## V3 Master Data

### `economic_sectors`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `code` | TEXT UNIQUE NOT NULL |
| `name_ar` | TEXT NOT NULL |
| `name_en` | TEXT NOT NULL |
| `description` | TEXT |
| `icon_url` | TEXT |
| `risk_category` | TEXT CHECK (risk_category IN ('low', 'medium', 'high', 'volatile')) |
| `is_active` | BOOLEAN NOT NULL DEFAULT true |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**RLS Policies:**
- `Public read economic_sectors` — FOR SELECT TO PUBLIC
  - USING: `true`

**RLS:** enabled

### `economic_sub_sectors`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `sector_id` | UUID NOT NULL REFERENCES public.economic_sectors(id) ON DELETE CASCADE |
| `code` | TEXT UNIQUE NOT NULL |
| `name_ar` | TEXT NOT NULL |
| `name_en` | TEXT NOT NULL |
| `description` | TEXT |
| `is_active` | BOOLEAN NOT NULL DEFAULT true |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Indexes:** `idx_economic_sub_sectors_sector_id (sector_id)`

**RLS Policies:**
- `Public read economic_sub_sectors` — FOR SELECT TO PUBLIC
  - USING: `true`

**RLS:** enabled

### `economic_activities`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `sector_id` | UUID NOT NULL REFERENCES public.economic_sectors(id) ON DELETE CASCADE |
| `sub_sector_id` | UUID NOT NULL REFERENCES public.economic_sub_sectors(id) ON DELETE CASCADE |
| `code` | TEXT UNIQUE NOT NULL |
| `name_ar` | TEXT NOT NULL |
| `name_en` | TEXT NOT NULL |
| `description` | TEXT |
| `is_active` | BOOLEAN NOT NULL DEFAULT true |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Indexes:** `idx_economic_activities_sector_id (sector_id)`, `idx_economic_activities_sub_sector_id (sub_sector_id)`

**RLS Policies:**
- `Public read economic_activities` — FOR SELECT TO PUBLIC
  - USING: `true`

**RLS:** enabled

### `economic_activity_details`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `activity_id` | uuid NOT NULL REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `code` | text NOT NULL UNIQUE |
| `name_ar` | text NOT NULL |
| `name_en` | text |
| `description` | text |
| `sort_order` | int NOT NULL DEFAULT 0 |
| `is_active` | boolean NOT NULL DEFAULT true |
| `created_at` | timestamptz NOT NULL DEFAULT now() |

**Indexes:** `idx_economic_activity_details_activity_id (activity_id)`

**RLS Policies:**
- `Public can read activity details` — FOR SELECT TO anon, authenticated, service_role
  - USING: `is_active = true`
- `Service role can manage activity details` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `project_models`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `sector_id` | UUID NOT NULL REFERENCES public.economic_sectors(id) ON DELETE CASCADE |
| `sub_sector_id` | UUID NOT NULL REFERENCES public.economic_sub_sectors(id) ON DELETE CASCADE |
| `activity_id` | UUID NOT NULL REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `code` | TEXT UNIQUE NOT NULL |
| `name_ar` | TEXT NOT NULL |
| `name_en` | TEXT NOT NULL |
| `description` | TEXT |
| `model_type` | TEXT NOT NULL DEFAULT 'greenfield' CHECK (model_type IN ('greenfield', 'franchise', 'existing', 'expansion')) |
| `size_category` | TEXT NOT NULL DEFAULT 'medium' CHECK (size_category IN ('small', 'medium', 'large', 'mega')) |
| `default_currency` | TEXT NOT NULL DEFAULT 'SAR' |
| `activity_detail_id` | uuid |
| `roi_min` | numeric(5,2) |
| `roi_avg` | numeric(5,2) |
| `roi_max` | numeric(5,2) |
| `irr_min` | numeric(5,2) |
| `irr_avg` | numeric(5,2) |
| `irr_max` | numeric(5,2) |
| `npv_min` | numeric(14,2) |
| `npv_avg` | numeric(14,2) |
| `npv_max` | numeric(14,2) |
| `payback_months_min` | int |
| `payback_months_avg` | int |
| `payback_months_max` | int |
| `break_even_revenue_min` | numeric(14,2) |
| `break_even_revenue_avg` | numeric(14,2) |
| `break_even_revenue_max` | numeric(14,2) |
| `land_cost_min` | numeric(14,2) |
| `land_cost_avg` | numeric(14,2) |
| `land_cost_max` | numeric(14,2) |
| `construction_cost_per_sqm` | numeric(12,2) |
| `equipment_cost_min` | numeric(14,2) |
| `equipment_cost_avg` | numeric(14,2) |
| `equipment_cost_max` | numeric(14,2) |
| `monthly_operation_cost_min` | numeric(14,2) |
| `monthly_operation_cost_avg` | numeric(14,2) |
| `monthly_operation_cost_max` | numeric(14,2) |

**Indexes:** `idx_project_models_sector_id (sector_id)`, `idx_project_models_activity_id (activity_id)`, `idx_project_models_published (is_published, is_active)`

**RLS Policies:**
- `Public read project_models` — FOR SELECT TO PUBLIC
  - USING: `is_published = true AND is_active = true`

**RLS:** enabled

### `financial_assumptions`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `code` | TEXT UNIQUE NOT NULL |
| `name_ar` | TEXT NOT NULL |
| `name_en` | TEXT NOT NULL |
| `category` | TEXT NOT NULL CHECK (category IN (
    'revenue', 'cogs', 'opex', 'capex', 'tax', 'depreciation',
    'working_capital', 'financing', 'hr', 'utilities', 'rent'
  )) |
| `unit_type` | TEXT NOT NULL CHECK (unit_type IN (
    'percentage', 'fixed_amount', 'ratio', 'count', 'days', 'months', 'per_unit'
  )) |
| `default_value` | NUMERIC(14,4) NOT NULL |
| `min_value` | NUMERIC(14,4) |
| `max_value` | NUMERIC(14,4) |
| `description` | TEXT |
| `source` | TEXT |
| `is_active` | BOOLEAN NOT NULL DEFAULT true |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**RLS Policies:**
- `Public read financial_assumptions` — FOR SELECT TO PUBLIC
  - USING: `is_active = true`

**RLS:** enabled

### `project_model_assumptions`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `project_model_id` | UUID NOT NULL REFERENCES public.project_models(id) ON DELETE CASCADE |
| `assumption_id` | UUID NOT NULL REFERENCES public.financial_assumptions(id) ON DELETE CASCADE |
| `value` | NUMERIC(14,4) NOT NULL |
| `override_notes` | TEXT |
| `is_locked` | BOOLEAN NOT NULL DEFAULT false |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Table-level constraints:** `UNIQUE (project_model_id, assumption_id)`

**Indexes:** `idx_project_model_assumptions_model_id (project_model_id)`

**RLS Policies:**
- `Public read project_model_assumptions` — FOR SELECT TO PUBLIC
  - USING: `true`

**RLS:** enabled

### `regulatory_requirements`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `sector_id` | uuid REFERENCES public.economic_sectors(id) ON DELETE CASCADE |
| `sub_sector_id` | uuid REFERENCES public.economic_sub_sectors(id) ON DELETE CASCADE |
| `activity_id` | uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `activity_detail_id` | uuid REFERENCES public.economic_activity_details(id) ON DELETE CASCADE |
| `project_model_id` | uuid REFERENCES public.project_models(id) ON DELETE CASCADE |
| `requirement_name_ar` | text NOT NULL |
| `requirement_name_en` | text |
| `issuing_authority` | text |
| `estimated_cost` | numeric(14,2) |
| `mandatory` | boolean NOT NULL DEFAULT true |
| `sort_order` | int NOT NULL DEFAULT 0 |
| `created_at` | timestamptz NOT NULL DEFAULT now() |

**Indexes:** `idx_regulatory_requirements_sector_id (sector_id)`, `idx_regulatory_requirements_activity_id (activity_id)`, `idx_regulatory_requirements_activity_detail_id (activity_detail_id)`, `idx_regulatory_requirements_project_model_id (project_model_id)`

**RLS Policies:**
- `Public can read regulatory requirements` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Service role can manage regulatory requirements` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `cities`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `code` | TEXT UNIQUE NOT NULL |
| `name_ar` | TEXT NOT NULL |
| `name_en` | TEXT NOT NULL |
| `region` | TEXT |
| `country_code` | TEXT NOT NULL DEFAULT 'SA' |
| `population` | INTEGER |
| `population_growth_rate` | NUMERIC(6,3) |
| `avg_household_income` | NUMERIC(14,2) |
| `purchasing_power_index` | NUMERIC(6,2) |
| `is_active` | BOOLEAN NOT NULL DEFAULT true |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `lat` | NUMERIC(10, 7) |
| `lng` | NUMERIC(10, 7) |
| `region_code` | text |
| `gdp_city` | numeric(14,2) |
| `growth_rate` | numeric(5,2) |
| `unemployment_rate` | numeric(5,2) |
| `establishments_count` | int |
| `inflation_rate` | numeric(5,2) |
| `business_ease_index` | numeric(5,2) |

**RLS Policies:**
- `Public read cities` — FOR SELECT TO PUBLIC
  - USING: `is_active = true`

**RLS:** enabled

### `risk_factors`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `code` | TEXT UNIQUE NOT NULL |
| `name_ar` | TEXT NOT NULL |
| `name_en` | TEXT NOT NULL |
| `category` | TEXT NOT NULL CHECK (category IN (
    'market', 'financial', 'operational', 'legal', 'environmental', 'geopolitical'
  )) |
| `weight` | NUMERIC(4,2) NOT NULL DEFAULT 1.0 |
| `default_score` | INTEGER NOT NULL DEFAULT 50 CHECK (default_score BETWEEN 0 AND 100) |
| `description` | TEXT |
| `is_active` | BOOLEAN NOT NULL DEFAULT true |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**RLS Policies:**
- `Public read risk_factors` — FOR SELECT TO PUBLIC
  - USING: `is_active = true`

**RLS:** enabled

### `project_model_risks`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `project_model_id` | UUID NOT NULL REFERENCES public.project_models(id) ON DELETE CASCADE |
| `risk_factor_id` | UUID NOT NULL REFERENCES public.risk_factors(id) ON DELETE CASCADE |
| `score` | INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100) |
| `notes` | TEXT |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Table-level constraints:** `UNIQUE (project_model_id, risk_factor_id)`

**Indexes:** `idx_project_model_risks_model_id (project_model_id)`

**RLS Policies:**
- `Public read project_model_risks` — FOR SELECT TO PUBLIC
  - USING: `true`

**RLS:** enabled

### `city_risk_adjustments`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `city_id` | UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE |
| `risk_factor_id` | UUID NOT NULL REFERENCES public.risk_factors(id) ON DELETE CASCADE |
| `adjustment` | INTEGER NOT NULL DEFAULT 0 |

**RLS Policies:**
- `Public read city_risk_adjustments` — FOR SELECT TO PUBLIC
  - USING: `true`

**RLS:** enabled

## V3 Market Intelligence

### `city_market_data`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `city_id` | UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | UUID NOT NULL REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `competitors_count` | INTEGER |
| `avg_market_share` | NUMERIC(6,2) |
| `opportunity_score` | NUMERIC(5,2) |
| `opportunity_rank` | INTEGER |
| `opportunity_breakdown` | JSONB DEFAULT '{}'::jsonb |
| `market_size` | numeric(14,2) |
| `annual_growth_rate` | numeric(5,2) |
| `per_capita_spending` | numeric(12,2) |
| `expected_demand` | text CHECK (expected_demand IN ('low', 'medium', 'high')) |
| `profit_margin_min` | numeric(5,2) |
| `profit_margin_avg` | numeric(5,2) |
| `profit_margin_max` | numeric(5,2) |
| `risk_score` | numeric(5,2) |
| `confidence` | int CHECK (confidence BETWEEN 0 AND 100) |
| `specialists_count` | INTEGER |
| `saudization_rate` | INTEGER CHECK (saudization_rate BETWEEN 0 AND 100) |
| `warehouse_rent_per_sqm` | numeric |
| `factory_rent_per_sqm` | numeric |
| `construction_cost_per_sqm` | numeric |
| `equipment_cost_min` | numeric |
| `equipment_cost_avg` | numeric |
| `equipment_cost_max` | numeric |
| `monthly_operation_cost_min` | numeric |
| `monthly_operation_cost_avg` | numeric |
| `monthly_operation_cost_max` | numeric |

**Indexes:** `idx_city_market_data_city_activity_year (city_id, activity_id, data_year)`, `idx_city_market_data_opportunity_score (opportunity_score DESC)`, `idx_city_market_data_opportunity_rank (opportunity_rank ASC)`

**RLS Policies:**
- `Public read city_market_data` — FOR SELECT TO PUBLIC
  - USING: `true`

**RLS:** enabled

### `city_indicators`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `city_id` | uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE |
| `year` | int NOT NULL |
| `gdp_city` | numeric(14,2) |
| `growth_rate` | numeric(5,2) |
| `unemployment_rate` | numeric(5,2) |
| `establishments_count` | int |
| `inflation_rate` | numeric(5,2) |
| `business_ease_index` | numeric(5,2) |
| `avg_rent_per_sqm` | numeric(12,2) |
| `avg_land_price_per_sqm` | numeric(12,2) |
| `warehouse_rent_per_sqm` | numeric(12,2) |
| `factory_rent_per_sqm` | numeric(12,2) |
| `new_licenses_count` | int |
| `investment_volume` | numeric(14,2) |
| `saturation_index` | numeric(5,2) |
| `overall_confidence` | int CHECK (overall_confidence BETWEEN 0 AND 100) |
| `metadata` | jsonb NOT NULL DEFAULT '{}' |
| `updated_at` | timestamptz NOT NULL DEFAULT now() |

**Table-level constraints:** `UNIQUE(city_id, year)`

**Indexes:** `idx_city_indicators_city_id (city_id)`, `idx_city_indicators_year (year)`

**RLS Policies:**
- `Public can read city indicators` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Service role can manage city indicators` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `normalized_metrics`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `metric_code` | text NOT NULL REFERENCES public.metric_definitions(code) ON DELETE RESTRICT |
| `city_id` | uuid REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `year` | int NOT NULL |
| `value` | numeric |
| `value_text` | text |
| `source_id` | text NOT NULL |
| `source_name` | text |
| `source_url` | text |
| `confidence` | int NOT NULL CHECK (confidence BETWEEN 0 AND 100) |
| `confidence_reason` | text |
| `fetched_at` | timestamptz NOT NULL DEFAULT now() |
| `valid_from` | date |
| `valid_until` | date |
| `is_override` | boolean NOT NULL DEFAULT false |
| `metadata` | jsonb NOT NULL DEFAULT '{}' |
| `created_at` | timestamptz NOT NULL DEFAULT now() |

**Table-level constraints:** `UNIQUE(metric_code, city_id, activity_id, year, source_id)`

**Indexes:** `idx_normalized_metrics_metric_code (metric_code)`, `idx_normalized_metrics_city_id (city_id)`, `idx_normalized_metrics_activity_id (activity_id)`, `idx_normalized_metrics_year (year)`, `idx_normalized_metrics_city_activity_year (city_id, activity_id, year)`, `idx_normalized_metrics_confidence (confidence DESC)`

**RLS Policies:**
- `Public can read normalized metrics` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Service role can manage normalized metrics` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `metric_definitions`

| Column | Type / Definition |
|--------|-------------------|
| `code` | text PRIMARY KEY |
| `category` | text NOT NULL CHECK (category IN ('city', 'market', 'labor', 'real_estate', 'pricing', 'competition')) |
| `name_ar` | text NOT NULL |
| `name_en` | text |
| `unit` | text |
| `data_type` | text NOT NULL CHECK (data_type IN ('number', 'percent', 'currency', 'index', 'text')) |
| `default_confidence_method` | text CHECK (default_confidence_method IN ('official', 'estimated', 'manual')) |
| `description` | text |
| `sort_order` | int NOT NULL DEFAULT 0 |
| `is_active` | boolean NOT NULL DEFAULT true |
| `created_at` | timestamptz NOT NULL DEFAULT now() |

**Indexes:** `idx_metric_definitions_category (category)`, `idx_metric_definitions_active (is_active, sort_order)`

**RLS Policies:**
- `Public can read metric definitions` — FOR SELECT TO anon, authenticated, service_role
  - USING: `is_active = true`
- `Service role can manage metric definitions` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `country_benchmarks`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `country_code` | text NOT NULL |
| `metric_code` | text NOT NULL |
| `benchmark_value` | numeric NOT NULL |
| `year` | int NOT NULL |
| `source` | text |
| `created_at` | timestamptz NOT NULL DEFAULT now() |
| `updated_at` | timestamptz NOT NULL DEFAULT now() |

**Table-level constraints:** `UNIQUE(country_code, metric_code, year)`

**Indexes:** `idx_country_benchmarks_country_metric (country_code, metric_code)`

**RLS Policies:**
- `Public can read country benchmarks` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Service role can manage country benchmarks` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `official_country_data`
*Official country-level statistics used as ground truth for city indicator estimation*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `country_code` | TEXT NOT NULL |
| `year` | INTEGER NOT NULL |
| `metric_code` | TEXT NOT NULL |
| `value` | NUMERIC |
| `value_text` | TEXT |
| `source` | TEXT NOT NULL |
| `source_url` | TEXT |
| `confidence` | INTEGER NOT NULL DEFAULT 90 |
| `metadata` | JSONB DEFAULT '{}' |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Table-level constraints:** `UNIQUE(country_code, year, metric_code)`

**Indexes:** `idx_official_country_data_lookup (country_code, year, metric_code)`

**RLS:** not enabled

### `city_competitor_calibration`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `city_id` | uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | uuid NOT NULL REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `metric_code` | text NOT NULL DEFAULT 'competitors_count' |
| `year` | int NOT NULL |
| `raw_value` | numeric |
| `calibrated_value` | numeric NOT NULL |
| `factor` | numeric |
| `source` | text |
| `notes` | text |
| `created_at` | timestamptz NOT NULL DEFAULT now() |
| `updated_at` | timestamptz NOT NULL DEFAULT now() |

**Table-level constraints:** `UNIQUE(city_id, activity_id, metric_code, year)`

**Indexes:** `idx_city_competitor_calibration_lookup (city_id, activity_id, metric_code, year)`, `idx_city_competitor_calibration_activity_year (activity_id, metric_code, year)`

**RLS Policies:**
- `Public can read city competitor calibration` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Service role can manage city competitor calibration` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

## V3 Enterprise / Projects

### `companies`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `name` | TEXT NOT NULL |
| `type` | TEXT NOT NULL CHECK (type IN ('investor', 'consultant', 'bank', 'enterprise')) |
| `owner_user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `subscription_tier` | TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')) |
| `settings` | JSONB DEFAULT '{}' |
| `is_active` | BOOLEAN NOT NULL DEFAULT true |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**RLS Policies:**
- `Users can view own companies` — FOR SELECT TO authenticated
  - USING: `owner_user_id = auth.uid()`

**RLS:** enabled

### `company_members`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `company_id` | UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `role` | TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')) |
| `joined_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Table-level constraints:** `UNIQUE (company_id, user_id)`

**RLS Policies:**
- `Users can view own company memberships` — FOR SELECT TO authenticated
  - USING: `user_id = auth.uid()`

**RLS:** enabled

### `user_projects`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE |
| `company_id` | UUID REFERENCES public.companies(id) ON DELETE SET NULL |
| `project_model_id` | UUID NOT NULL REFERENCES public.project_models(id) ON DELETE CASCADE |
| `city_id` | UUID REFERENCES public.cities(id) ON DELETE SET NULL |
| `name` | TEXT NOT NULL |
| `status` | TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')) |

**Indexes:** `idx_user_projects_user_id (user_id)`, `idx_user_projects_company_id (company_id)`

**RLS Policies:**
- `Users can view own projects` — FOR SELECT TO authenticated
  - USING: `user_id = auth.uid()`
- `Users can insert own projects` — FOR INSERT TO authenticated
  - WITH CHECK: `user_id = auth.uid()`
- `Users can update own projects` — FOR UPDATE TO authenticated
  - USING: `user_id = auth.uid()`

**RLS:** enabled

### `reports`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `project_id` | UUID NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE |
| `type` | TEXT NOT NULL CHECK (type IN ('feasibility', 'investor', 'bank', 'executive')) |
| `format` | TEXT NOT NULL CHECK (format IN ('pdf', 'docx', 'pptx')) |
| `file_url` | TEXT |
| `status` | TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed')) |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Indexes:** `idx_reports_project_id (project_id)`

**RLS Policies:**
- `Users can view own reports` — FOR SELECT TO authenticated
  - USING: `     project_id IN (SELECT id FROM public.user_projects WHERE user_id = auth.uid())   `

**RLS:** enabled

### `project_scenarios`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `user_id` | uuid REFERENCES auth.users(id) ON DELETE SET NULL |
| `project_id` | uuid REFERENCES public.user_projects(id) ON DELETE CASCADE |
| `name` | text NOT NULL |
| `description` | text |
| `project_model_code` | text NOT NULL |
| `city_code` | text |
| `baseline_assumptions` | jsonb NOT NULL DEFAULT '{}'::jsonb |
| `shocks` | jsonb NOT NULL DEFAULT '[]'::jsonb |
| `results` | jsonb NOT NULL DEFAULT '{}'::jsonb |
| `is_saved` | boolean NOT NULL DEFAULT false |
| `created_at` | timestamptz NOT NULL DEFAULT now() |
| `updated_at` | timestamptz NOT NULL DEFAULT now() |

**Indexes:** `idx_project_scenarios_user_id (user_id)`, `idx_project_scenarios_project_id (project_id)`, `idx_project_scenarios_created_at (created_at DESC)`

**RLS Policies:**
- `Users can manage own scenarios` — FOR ALL TO authenticated
  - USING: `user_id = auth.uid()`
  - WITH CHECK: `user_id = auth.uid()`
- `Service role can manage all scenarios` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

## V3 Alerts

### `alert_rules`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `name` | text NOT NULL |
| `description` | text |
| `metric_code` | text NOT NULL |
| `entity_type` | text NOT NULL CHECK (entity_type IN ('city', 'activity', 'city_activity')) |
| `city_id` | uuid REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `threshold_type` | text NOT NULL CHECK (threshold_type IN ('relative', 'absolute')) |
| `threshold_value` | numeric NOT NULL |
| `severity` | text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')) |
| `is_active` | boolean NOT NULL DEFAULT true |
| `check_previous_year` | boolean NOT NULL DEFAULT true |
| `created_at` | timestamptz NOT NULL DEFAULT now() |
| `updated_at` | timestamptz NOT NULL DEFAULT now() |

**Indexes:** `idx_alert_rules_active (is_active, metric_code)`, `idx_alert_rules_entity (city_id, activity_id)`

**RLS Policies:**
- `Service role manages alert rules` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`
- `Public can read active alert rules` — FOR SELECT TO anon, authenticated
  - USING: `is_active = true`

**RLS:** enabled

### `alerts`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `rule_id` | uuid REFERENCES public.alert_rules(id) ON DELETE SET NULL |
| `city_id` | uuid REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `metric_code` | text NOT NULL |
| `old_value` | numeric |
| `new_value` | numeric |
| `change_value` | numeric |
| `change_percent` | numeric |
| `severity` | text NOT NULL |
| `message` | text NOT NULL |
| `is_read` | boolean NOT NULL DEFAULT false |
| `sent_email` | boolean NOT NULL DEFAULT false |
| `sent_webhook` | boolean NOT NULL DEFAULT false |
| `created_at` | timestamptz NOT NULL DEFAULT now() |
| `insight` | text |
| `detected_at` | timestamptz NOT NULL DEFAULT now() |

**Indexes:** `idx_alerts_unread (is_read, created_at DESC)`, `idx_alerts_rule_id (rule_id)`, `idx_alerts_city_activity (city_id, activity_id)`, `idx_alerts_dedup (rule_id, city_id, activity_id, metric_code, created_at DESC)`

**RLS Policies:**
- `Service role manages alerts` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`
- `Public can read alerts` — FOR SELECT TO anon, authenticated
  - USING: `true`

**RLS:** enabled

## V3 Data Engine & ML

### `data_source_runs`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `source_id` | text NOT NULL |
| `run_type` | text NOT NULL CHECK (run_type IN ('full', 'incremental', 'manual')) |
| `status` | text NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')) |
| `started_at` | timestamptz NOT NULL DEFAULT now() |
| `finished_at` | timestamptz |
| `records_fetched` | int NOT NULL DEFAULT 0 |
| `records_valid` | int NOT NULL DEFAULT 0 |
| `records_imported` | int NOT NULL DEFAULT 0 |
| `errors` | jsonb NOT NULL DEFAULT '[]' |
| `metadata` | jsonb NOT NULL DEFAULT '{}' |

**Indexes:** `idx_data_source_runs_source_id (source_id)`, `idx_data_source_runs_status (status)`, `idx_data_source_runs_started_at (started_at DESC)`

**RLS Policies:**
- `Public can read data source runs` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Service role can manage data source runs` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `raw_data`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `run_id` | uuid NOT NULL REFERENCES public.data_source_runs(id) ON DELETE CASCADE |
| `source_id` | text NOT NULL |
| `external_id` | text |
| `raw_payload` | jsonb NOT NULL |
| `fetched_at` | timestamptz NOT NULL DEFAULT now() |

**Indexes:** `idx_raw_data_run_id (run_id)`, `idx_raw_data_source_id (source_id)`

**RLS Policies:**
- `Public can read raw data` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Service role can manage raw data` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `data_source_quality`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `source_id` | TEXT NOT NULL |
| `city_id` | uuid REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `year` | int NOT NULL |
| `metric_code` | TEXT NOT NULL |
| `success` | BOOLEAN NOT NULL DEFAULT false |
| `count` | int |
| `confidence` | int CHECK (confidence BETWEEN 0 AND 100) |
| `source_method` | TEXT |
| `failure_reason` | TEXT |
| `attempts` | int NOT NULL DEFAULT 0 |
| `successes` | int NOT NULL DEFAULT 0 |
| `last_attempted_at` | timestamptz NOT NULL DEFAULT NOW() |
| `last_success_at` | timestamptz |
| `created_at` | timestamptz NOT NULL DEFAULT NOW() |
| `updated_at` | timestamptz NOT NULL DEFAULT NOW() |

**Table-level constraints:** `UNIQUE(source_id, city_id, activity_id, year, metric_code)`

**Indexes:** `idx_data_source_quality_source (source_id)`, `idx_data_source_quality_city (city_id)`, `idx_data_source_quality_success (success, last_attempted_at DESC)`

**RLS Policies:**
- `Service role can manage data source quality` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `http_cache`

| Column | Type / Definition |
|--------|-------------------|
| `key` | TEXT PRIMARY KEY |
| `value` | JSONB NOT NULL |
| `expires_at` | TIMESTAMPTZ NOT NULL |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Indexes:** `idx_http_cache_expires (expires_at)`

**RLS Policies:**
- `Service role can manage http cache` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `ml_models`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `metric_code` | text NOT NULL |
| `feature_key` | text NOT NULL |
| `country_code` | text |
| `slope` | numeric NOT NULL |
| `intercept` | numeric NOT NULL |
| `r_squared` | numeric NOT NULL DEFAULT 0 |
| `sample_count` | int NOT NULL DEFAULT 0 |
| `feature_stats` | jsonb NOT NULL DEFAULT '{}' |
| `trained_at` | timestamptz NOT NULL DEFAULT now() |
| `model_type` | text NOT NULL DEFAULT 'linear' |
| `weights` | jsonb NOT NULL DEFAULT '[]' |
| `feature_means` | jsonb NOT NULL DEFAULT '{}' |
| `feature_stds` | jsonb NOT NULL DEFAULT '{}' |
| `target_mean` | numeric NOT NULL DEFAULT 0 |
| `rmse` | numeric NOT NULL DEFAULT 0 |
| `mape` | numeric NOT NULL DEFAULT 0 |

**Table-level constraints:** `UNIQUE(metric_code, feature_key, country_code)`

**Indexes:** `idx_ml_models_metric (metric_code)`, `idx_ml_models_country (country_code)`, `idx_ml_models_type (model_type)`

**RLS Policies:**
- `Public can read ML models` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Service role can manage ML models` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `metric_feedback`

| Column | Type / Definition |
|--------|-------------------|
| `id` | uuid PRIMARY KEY DEFAULT gen_random_uuid() |
| `metric_code` | text NOT NULL REFERENCES public.metric_definitions(code) ON DELETE RESTRICT |
| `city_id` | uuid REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE |
| `year` | int NOT NULL |
| `estimated_value` | numeric |
| `estimated_value_text` | text |
| `actual_value` | numeric |
| `actual_value_text` | text |
| `project_id` | uuid REFERENCES public.user_projects(id) ON DELETE SET NULL |
| `source` | text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'admin', 'audit', 'external')) |
| `confidence` | int CHECK (confidence BETWEEN 0 AND 100) |
| `notes` | text |
| `created_at` | timestamptz NOT NULL DEFAULT now() |
| `updated_at` | timestamptz NOT NULL DEFAULT now() |

**Indexes:** `idx_metric_feedback_metric_code (metric_code)`, `idx_metric_feedback_city_id (city_id)`, `idx_metric_feedback_activity_id (activity_id)`, `idx_metric_feedback_year (year)`, `idx_metric_feedback_city_activity_year (city_id, activity_id, year)`

**RLS Policies:**
- `Public can read metric feedback` — FOR SELECT TO anon, authenticated, service_role
  - USING: `true`
- `Authenticated users can insert own feedback` — FOR INSERT TO authenticated
  - WITH CHECK: `source = 'user'`
- `Service role can manage metric feedback` — FOR ALL TO service_role
  - USING: `true`
  - WITH CHECK: `true`

**RLS:** enabled

### `data_feedback`
*User-submitted corrections for city indicators and market data*

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `city_id` | UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | UUID REFERENCES public.economic_activities(id) ON DELETE SET NULL |
| `year` | INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE) |
| `metric_code` | TEXT NOT NULL |
| `current_value` | NUMERIC |
| `suggested_value` | NUMERIC NOT NULL |
| `reason` | TEXT |
| `source_url` | TEXT |
| `status` | TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')) |
| `reviewed_by` | UUID |
| `reviewed_at` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Indexes:** `idx_data_feedback_city_id (city_id)`, `idx_data_feedback_status (status)`, `idx_data_feedback_metric (metric_code, year)`

**RLS:** not enabled

### `confidence_log`

| Column | Type / Definition |
|--------|-------------------|
| `id` | UUID PRIMARY KEY DEFAULT gen_random_uuid() |
| `city_id` | UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE |
| `activity_id` | UUID REFERENCES public.economic_activities(id) ON DELETE SET NULL |
| `year` | INTEGER NOT NULL |
| `metric_code` | TEXT |
| `old_confidence` | INTEGER |
| `new_confidence` | INTEGER NOT NULL |
| `reason` | TEXT NOT NULL |
| `source` | TEXT |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() |

**Indexes:** `idx_confidence_log_city (city_id, year)`

**RLS:** not enabled

## Storage

### `storage.objects`

| Column | Type / Definition |
|--------|-------------------|

**RLS Policies:**
- `Allow authenticated uploads` — FOR INSERT TO authenticated
  - WITH CHECK: `bucket_id = 'avatars'`
- `Allow authenticated reads` — FOR SELECT TO authenticated
  - USING: `bucket_id = 'avatars'`
- `Allow public reads` — FOR SELECT TO anon, authenticated
  - USING: `bucket_id = 'avatars'`
- `Allow authenticated updates` — FOR UPDATE TO authenticated
  - USING: `bucket_id = 'avatars'`

**RLS:** not enabled
## Functions & Triggers

### Database functions

| Function | Args | Language | Notes |
|----------|------|----------|-------|
| `calculate_cost_share` | `()` | plpgsql |  |
| `calculate_menu_engineering` | `(p_user_id UUID)` | plpgsql |  |
| `calculate_sale_deductions` | `()` | plpgsql |  |
| `public.count_user_countries` | `(p_user_id uuid)` | sql | Returns distinct country count for a user. |
| `public.count_user_scenarios` | `(p_user_id uuid)` | sql | Returns scenario count for a user. |
| `public.exec_sql` | `(sql text)` | plpgsql | SECURITY DEFINER utility; locked down. |
| `public.get_user_limits` | `(p_user_id uuid)` | plpgsql | Returns JSON of tier limits. |
| `public.handle_new_user` | `()` | plpgsql | Auto-creates/updates profile on auth.users insert. |
| `public.log_ingredient_price_change` | `()` | plpgsql | Logs ingredient current_price changes to ingredient_prices. |
| `public.set_updated_at` | `()` | plpgsql | Sets NEW.updated_at = now(). |
| `refresh_engineering_scores` | `(p_user_id UUID)` | plpgsql |  |

### Trigger summary

| Trigger | Table | Function |
|---------|-------|----------|
| `trigger_calculate_cost_share` | `menu_item_ingredients` | `calculate_cost_share` |
| `trigger_calculate_sale_deductions` | `sales_transactions` | `calculate_sale_deductions` |
| `on_auth_user_created` | `auth.users` | `handle_new_user` |
| `subscriptions_updated_at` | `subscriptions` | `set_updated_at` |
| `city_indicators_updated_at` | `city_indicators` | `set_updated_at` |
| `project_scenarios_updated_at` | `project_scenarios` | `set_updated_at` |
| `alert_rules_updated_at` | `alert_rules` | `set_updated_at` |
| `metric_feedback_updated_at` | `metric_feedback` | `set_updated_at` |
| `country_benchmarks_updated_at` | `country_benchmarks` | `set_updated_at` |
| `data_feedback_updated_at` | `data_feedback` | `set_updated_at` |
| `official_country_data_updated_at` | `official_country_data` | `set_updated_at` |
| `city_competitor_calibration_updated_at` | `city_competitor_calibration` | `set_updated_at` |
| `trg_ingredient_price_change` | `ingredients` | `log_ingredient_price_change` |

Additionally, V3 master-data migration creates `trg_<table>_updated_at` triggers on: `economic_sectors`, `economic_sub_sectors`, `economic_activities`, `project_models`, `financial_assumptions`, `project_model_assumptions`, `cities`, `city_market_data`, `risk_factors`, `project_model_risks`, `city_risk_adjustments`, `companies`, `company_members`, `user_projects`, `reports`.

## Enums & Special Types

Most enumerations are implemented as `TEXT` columns with `CHECK` constraints. Notable sets:

| Domain | Values |
|--------|--------|
| `profiles.tier` | `free`, `pro`, `enterprise` |
| `profiles.status` | `active`, `inactive`, `trialing`, `past_due` |
| `subscriptions.tier` (template / V3) | `free`, `pro`, `enterprise` |
| `subscriptions.status` (template) | `active`, `inactive`, `trialing`, `past_due`, `cancelled` |
| `moyasar_invoices.tier` | `pro`, `enterprise` |
| `moyasar_invoices.status` | `initiated`, `pending`, `paid`, `failed`, `expired` |
| `bank_transfer_requests.status` | `pending`, `verified`, `rejected` |
| `admin_roles.role` | `super_admin`, `admin`, `support`, `viewer` |
| `company_members.role` | `owner`, `admin`, `member`, `viewer` |
| `companies.type` | `investor`, `consultant`, `bank`, `enterprise` |
| `companies.subscription_tier` | `free`, `pro`, `enterprise` |
| `economic_sectors.risk_category` | `low`, `medium`, `high`, `volatile` |
| `project_models.model_type` | `greenfield`, `franchise`, `existing`, `expansion` |
| `project_models.size_category` | `small`, `medium`, `large`, `mega` |
| `financial_assumptions.category` | `revenue`, `cogs`, `opex`, `capex`, `tax`, `depreciation`, `working_capital`, `financing`, `hr`, `utilities`, `rent` |
| `financial_assumptions.unit_type` | `percentage`, `fixed_amount`, `ratio`, `count`, `days`, `months`, `per_unit` |
| `risk_factors.category` | `market`, `financial`, `operational`, `legal`, `environmental`, `geopolitical` |
| `user_projects.status` | `draft`, `completed`, `archived` |
| `reports.type` | `feasibility`, `investor`, `bank`, `executive` |
| `reports.format` | `pdf`, `docx`, `pptx` |
| `metric_definitions.category` | `city`, `market`, `labor`, `real_estate`, `pricing`, `competition` |
| `metric_definitions.data_type` | `number`, `percent`, `currency`, `index`, `text` |
| `metric_definitions.default_confidence_method` | `official`, `estimated`, `manual` |
| `data_source_runs.run_type` | `full`, `incremental`, `manual` |
| `data_source_runs.status` | `running`, `success`, `failed`, `partial` |
| `vat_transactions.transaction_type` | `output_sale`, `input_purchase` |
| `menu_engineering_scores.category` | `star`, `plowhorse`, `puzzle`, `dog`, `unclassified` |
| `alert_rules.entity_type` | `city`, `activity`, `city_activity` |
| `alert_rules.threshold_type` | `relative`, `absolute` |
| `alert_rules.severity` | `info`, `warning`, `critical` |
| `alerts.severity` | `info`, `warning`, `critical` |
| `city_market_data.expected_demand` | `low`, `medium`, `high` |
| `metric_feedback.source` | `user`, `admin`, `audit`, `external` |
| `data_feedback.status` | `pending`, `approved`, `rejected` |

## Row-Level Security Patterns

- **User-owned data:** policies generally enforce `auth.uid() = user_id` (or `owner_user_id`).
- **Indirect ownership:** tables like `menu_item_ingredients`, `menu_platform_prices`, `recipe_ingredients`, and `reports` use `EXISTS` subqueries against the parent user-owned table.
- **Public append-only:** `contact_messages`, `usage_logs`, `page_views`, `page_sessions`, and `bank_transfer_requests` allow anonymous `INSERT` but block or restrict `SELECT`.
- **Public read master data:** V3 master tables are mostly public-read with `is_active = true` filters.
- **Service-role backdoor:** most tables include a `service_role` policy with `USING (true)` for admin/edge-function operations.
- **Storage:** `storage.objects` policies restrict the `avatars` bucket: authenticated users can upload/update, public/anonymous can read.

## Schema Conflicts & Ambiguities

### 1. `subscriptions` — multiple incompatible definitions

| Source | Key differences |
|--------|-----------------|
| `templates/supabase-schema.sql` | `tier` CHECK (`free`/`pro`/`enterprise`), `status` CHECK (`active`/`inactive`/`trialing`/`past_due`/`cancelled`), `cancel_at_period_end boolean`, `stripe_price_id` |
| `supabase/migrations/20260611000000_v2_core_tables.sql` | `plan` TEXT default `free`, `status` TEXT default `inactive`, no CHECK, no `cancel_at_period_end`/`stripe_price_id` |
| `v3/supabase/migrations/20260613000000_v3_subscriptions.sql` | `status` default `incomplete`, `tier` default `free`, no CHECK, no `cancel_at_period_end`/`stripe_price_id` |

All three use `CREATE TABLE IF NOT EXISTS`, so the actual deployed schema depends on execution order. This should be consolidated.

### 2. `ingredients` — two divergent table shapes

| Source | Columns | Consumers |
|--------|---------|-----------|
| `supabase/migrations/20260530120000_menu_engineering_schema.sql` | `cost_per_unit decimal(12,4)`, `stock_quantity`, `reorder_level`, `last_price_update` | `menu_item_ingredients`, `calculate_cost_share` trigger, `refresh_engineering_scores` |
| `templates/supabase-schema.sql` | `category`, `unit`, `current_price numeric(10,2)`, `vat_included`, `supplier`, `country` | `ingredient_prices`, `recipe_ingredients`, `log_ingredient_price_change` trigger |

Because both are `CREATE TABLE IF NOT EXISTS`, whichever runs first wins; the second silently does nothing. This is a breaking conflict for the recipe-costing vs menu-engineering features.

### 3. `profiles` — trigger/schema drift

The template defines a smaller `profiles` table; later migrations add `email`, `phone`, `city`, `business_type`, `bio`, `needs`, `employee_count`, `branch_count`, `governorate`, `city_code`, `city_name`. The `handle_new_user` trigger has at least five iterative versions across migrations, each adding more metadata fields. All additions use `IF NOT EXISTS`, so applying migrations sequentially yields the union of columns.

### 4. Two project/scenario concepts

- `public.projects` (V2 core) is a flat feasibility result table owned by `auth.users`.
- `public.user_projects` (V3) is a richer entity tied to `project_models`, `cities`, `companies`, and `reports`.
- `public.scenarios` (V1/V2) stores saved calculator inputs.
- `public.project_scenarios` (V3) stores what-if scenarios tied to V3 user projects.

These are separate tables but conceptually overlap; they likely serve different product surfaces.

## Extensions

- `pgcrypto`
- `uuid-ossp`
