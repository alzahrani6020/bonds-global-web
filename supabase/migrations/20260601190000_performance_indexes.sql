-- ============================================
-- Phase 2: Performance Indexes & Query Tuning
-- Bonds Global — Database Efficiency
-- ============================================

-- ============================================
-- 1. CORE TABLE INDEXES
-- Tables defined in menu_engineering_schema.sql
-- ============================================

-- platforms: heavily filtered by user_id in RLS + API queries
CREATE INDEX IF NOT EXISTS idx_platforms_user ON platforms(user_id);

-- promo_campaigns: filtered by user_id in RLS; no index existed
CREATE INDEX IF NOT EXISTS idx_promo_user ON promo_campaigns(user_id);

-- sales_transactions: 
--   idx_sales_user_date already covers (user_id, transaction_date)
--   idx_sales_menu_platform already covers (menu_item_id, platform_id)
--   Missing: index for aggregation queries that GROUP BY menu_item_id, platform_id
--   after filtering by user_id. This avoids heap fetches + sort step.
CREATE INDEX IF NOT EXISTS idx_sales_user_menu_platform
ON sales_transactions(user_id, menu_item_id, platform_id);

-- sales_transactions: date-range queries for reports (e.g. "last 30 days")
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_transactions(transaction_date);

-- ingredients: search by name within a user's inventory
CREATE INDEX IF NOT EXISTS idx_ingredients_name_user ON ingredients(user_id, name);

-- ============================================
-- 2. CONDITIONAL INDEXES
-- For tables managed outside migrations (Supabase Auth, Stripe webhooks)
-- Wrapped in DO block to avoid errors if tables don't exist yet.
-- ============================================

DO $$
BEGIN
    -- webhook_events: deduplication by stripe_event_id (every webhook hit)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_stripe_event ON webhook_events(stripe_event_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_events(processed, created_at);
    END IF;

    -- subscriptions: upsert by user_id, lookup by stripe_subscription_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
    END IF;

    -- profiles: lookup by stripe_customer_id (sparse, so partial index)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- 3. FUNCTION OPTIMIZATION
-- refresh_engineering_scores: avoid grouping ALL menu_item_ingredients
-- across ALL users. Use LEFT JOIN LATERAL to only compute costs for
-- menu_items that actually appear in the user's sales. Also fixes
-- bug where items without ingredients were excluded (INNER JOIN).
-- ============================================

CREATE OR REPLACE FUNCTION refresh_engineering_scores(p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO menu_engineering_scores (
        user_id, menu_item_id, platform_id,
        total_sales_count, total_revenue, total_cost, gross_profit, profit_margin_pct
    )
    SELECT
        p_user_id,
        st.menu_item_id,
        st.platform_id,
        SUM(st.quantity),
        SUM(st.total_revenue),
        COALESCE(SUM(mi.total_cost), 0),
        SUM(st.net_revenue) - COALESCE(SUM(mi.total_cost), 0),
        CASE WHEN SUM(st.total_revenue) > 0
             THEN ((SUM(st.net_revenue) - COALESCE(SUM(mi.total_cost), 0)) / SUM(st.total_revenue)) * 100
             ELSE 0
        END
    FROM sales_transactions st
    LEFT JOIN LATERAL (
        SELECT SUM(mii.cost_share) as total_cost
        FROM menu_item_ingredients mii
        WHERE mii.menu_item_id = st.menu_item_id
    ) mi ON true
    WHERE st.user_id = p_user_id
    GROUP BY st.menu_item_id, st.platform_id
    ON CONFLICT (user_id, menu_item_id, platform_id)
    DO UPDATE SET
        total_sales_count = EXCLUDED.total_sales_count,
        total_revenue = EXCLUDED.total_revenue,
        total_cost = EXCLUDED.total_cost,
        gross_profit = EXCLUDED.gross_profit,
        profit_margin_pct = EXCLUDED.profit_margin_pct,
        calculated_at = NOW();

    PERFORM calculate_menu_engineering(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. CONNECTION POOL GUARDRAIL (advisory)
-- If using Supabase Pooler, document max connections.
-- This is a comment-only section for ops reference.
-- ============================================

COMMENT ON FUNCTION refresh_engineering_scores(UUID) IS
'Optimized v2: Uses LEFT JOIN LATERAL instead of grouping all menu_item_ingredients globally. Items without ingredients now get cost=0 instead of being excluded.';
