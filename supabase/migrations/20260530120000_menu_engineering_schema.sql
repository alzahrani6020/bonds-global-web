-- ============================================
-- Bonds Global: Restaurant AI Engine Schema
-- Phase 0: Core Database for Menu Engineering
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. INGREDIENTS TABLE
-- المكونات والمستودع
-- ============================================
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_en TEXT,
    unit TEXT NOT NULL DEFAULT 'kg', -- kg, g, l, ml, piece, box
    cost_per_unit DECIMAL(12, 4) NOT NULL DEFAULT 0,
    supplier TEXT,
    stock_quantity DECIMAL(12, 4) DEFAULT 0,
    reorder_level DECIMAL(12, 4) DEFAULT 0,
    last_price_update DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ingredients IS 'المكونات الخام لكل مطعم';

-- ============================================
-- 2. PLATFORMS TABLE
-- المنصات وسياساتها (مُدخل يدوياً أو من البيانات الحالية)
-- ============================================
CREATE TABLE IF NOT EXISTS platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- jahez, hungerstation, talabat, etc.
    name TEXT NOT NULL,
    name_en TEXT,
    country_code TEXT NOT NULL DEFAULT 'SA', -- SA, EG, AE, etc.
    commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 0, -- نسبة العمولة
    service_fee_rate DECIMAL(5, 2) DEFAULT 0, -- رسوم الخدمة
    payment_gateway_fee DECIMAL(5, 2) DEFAULT 0, -- رسوم بوابة الدفع
    delivery_fee DECIMAL(10, 2) DEFAULT 0, -- رسوم التوصيل الثابتة
    vat_on_commission BOOLEAN DEFAULT true, -- هل الضريبة على العمولة؟
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE platforms IS 'منصات التوصيل لكل مستخدم';

-- ============================================
-- 3. MENU ITEMS TABLE
-- الوجبات والمنيو
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_en TEXT,
    category TEXT DEFAULT 'main', -- main, appetizer, dessert, drink
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 0, -- السعر الأساسي
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE menu_items IS 'المنتجات والوجبات في المنيو';

-- ============================================
-- 4. MENU ITEM INGREDIENTS (Many-to-Many)
-- ربط الوجبات بالمكونات
-- ============================================
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity_needed DECIMAL(10, 4) NOT NULL DEFAULT 1, -- الكمية المطلوبة للوجبة الواحدة
    unit TEXT NOT NULL DEFAULT 'g',
    cost_share DECIMAL(12, 4) DEFAULT 0,
    UNIQUE(menu_item_id, ingredient_id)
);

COMMENT ON TABLE menu_item_ingredients IS 'كميات المكونات لكل وجبة';

-- ============================================
-- 5. MENU PLATFORM PRICES
-- أسعار الوجبة في كل منصة
-- ============================================
CREATE TABLE IF NOT EXISTS menu_platform_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    platform_price DECIMAL(10, 2) NOT NULL, -- السعر في المنصة
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(menu_item_id, platform_id)
);

COMMENT ON TABLE menu_platform_prices IS 'سعر كل وجبة في كل منصة';

-- ============================================
-- 6. SALES TRANSACTIONS TABLE
-- العمليات والمبيعات
-- ============================================
CREATE TABLE IF NOT EXISTS sales_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    platform_id UUID REFERENCES platforms(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_revenue DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    commission_deduction DECIMAL(12, 2) DEFAULT 0,
    service_fee_deduction DECIMAL(12, 2) DEFAULT 0,
    net_revenue DECIMAL(12, 2) DEFAULT 0,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sales_transactions IS 'المبيعات اليومية لكل وجبة ومنصة';

-- ============================================
-- 7. MENU ENGINEERING SCORES (Computed)
-- نتائج تصنيف الوجبات (Stars, Plowhorses, Puzzles, Dogs)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_engineering_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    platform_id UUID REFERENCES platforms(id) ON DELETE SET NULL,
    
    -- المقاييس
    total_sales_count INTEGER DEFAULT 0, -- عدد الوحدات المباعة
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    total_cost DECIMAL(12, 2) DEFAULT 0,
    gross_profit DECIMAL(12, 2) DEFAULT 0,
    profit_margin_pct DECIMAL(5, 2) DEFAULT 0, -- نسبة الربح الإجمالي
    
    -- التصنيف النسبي (0-1)
    popularity_score DECIMAL(4, 3) DEFAULT 0, -- شعبية الوجبة
    profit_score DECIMAL(4, 3) DEFAULT 0, -- درجة الربح
    
    -- التصنيف النهائي
    category TEXT DEFAULT 'unclassified', -- star, plowhorse, puzzle, dog
    
    -- التوصية
    recommendation TEXT,
    
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, menu_item_id, platform_id)
);

COMMENT ON TABLE menu_engineering_scores IS 'نتائج تصنيف هندسة المنيو';

-- ============================================
-- 8. PROMO CAMPAIGNS TABLE
-- حملات الخصم المحاكاة
-- ============================================
CREATE TABLE IF NOT EXISTS promo_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platform_id UUID REFERENCES platforms(id) ON DELETE SET NULL,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL, -- NULL = كل المنيو
    
    -- inputs
    discount_pct DECIMAL(5, 2) NOT NULL DEFAULT 0, -- نسبة الخصم
    target_sales_lift_pct DECIMAL(5, 2) DEFAULT 0, -- نسبة النمو المتوقعة
    campaign_days INTEGER DEFAULT 7,
    
    -- computed results
    original_margin DECIMAL(5, 2) DEFAULT 0,
    new_margin DECIMAL(5, 2) DEFAULT 0,
    required_volume_lift DECIMAL(5, 2) DEFAULT 0, -- نسبة النمو المطلوبة للحفاظ على الربح
    break_even_daily_sales INTEGER DEFAULT 0,
    is_profitable BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE promo_campaigns IS 'محاكاة حملات الخصم';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_platform_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_engineering_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_campaigns ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can CRUD their own ingredients" ON ingredients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD their own platforms" ON platforms FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD their own menu_items" ON menu_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD their own menu_item_ingredients" ON menu_item_ingredients FOR ALL USING (EXISTS (SELECT 1 FROM menu_items WHERE id = menu_item_ingredients.menu_item_id AND user_id = auth.uid()));
CREATE POLICY "Users can CRUD their own menu_platform_prices" ON menu_platform_prices FOR ALL USING (EXISTS (SELECT 1 FROM menu_items WHERE id = menu_platform_prices.menu_item_id AND user_id = auth.uid()));
CREATE POLICY "Users can CRUD their own sales" ON sales_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD their own engineering scores" ON menu_engineering_scores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD their own promos" ON promo_campaigns FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Calculate Menu Engineering Score
CREATE OR REPLACE FUNCTION calculate_menu_engineering(p_user_id UUID)
RETURNS void AS $$
DECLARE
    avg_popularity DECIMAL(10, 4);
    avg_profit DECIMAL(10, 4);
BEGIN
    -- Calculate averages for this user
    SELECT AVG(total_sales_count), AVG(gross_profit)
    INTO avg_popularity, avg_profit
    FROM menu_engineering_scores
    WHERE user_id = p_user_id;
    
    -- Classify items
    UPDATE menu_engineering_scores
    SET category = CASE
        WHEN total_sales_count >= avg_popularity AND gross_profit >= avg_profit THEN 'star'
        WHEN total_sales_count >= avg_popularity AND gross_profit < avg_profit THEN 'engine'
        WHEN total_sales_count < avg_popularity AND gross_profit >= avg_profit THEN 'treasure'
        ELSE 'stalled'
    END,
    recommendation = CASE
        WHEN total_sales_count >= avg_popularity AND gross_profit >= avg_profit THEN 'حافظ عليها ودعمها تسويقياً'
        WHEN total_sales_count >= avg_popularity AND gross_profit < avg_profit THEN 'قلل الكميات أو ارفع السعر 5%'
        WHEN total_sales_count < avg_popularity AND gross_profit >= avg_profit THEN 'أعد تسميتها أو روج لها في التطبيقات'
        ELSE 'حذفها أو طورها فوراً'
    END,
    calculated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Refresh Engineering Scores from Sales
CREATE OR REPLACE FUNCTION refresh_engineering_scores(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Upsert scores based on sales_transactions
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
        SUM(mi.total_cost),
        SUM(st.net_revenue) - SUM(mi.total_cost),
        CASE WHEN SUM(st.total_revenue) > 0 
             THEN ((SUM(st.net_revenue) - SUM(mi.total_cost)) / SUM(st.total_revenue)) * 100 
             ELSE 0 
        END
    FROM sales_transactions st
    JOIN (
        SELECT mii.menu_item_id, SUM(mii.cost_share) as total_cost
        FROM menu_item_ingredients mii
        GROUP BY mii.menu_item_id
    ) mi ON mi.menu_item_id = st.menu_item_id
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
    
    -- Then classify
    PERFORM calculate_menu_engineering(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ingredients_user ON ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_user ON menu_items(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales_transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_menu_platform ON sales_transactions(menu_item_id, platform_id);
CREATE INDEX IF NOT EXISTS idx_engineering_user ON menu_engineering_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_engineering_category ON menu_engineering_scores(category);
