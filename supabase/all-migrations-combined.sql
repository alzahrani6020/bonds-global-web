-- Make the 'avatars' storage bucket publicly accessible
-- This allows public URLs to work without authentication
-- Run this in Supabase Dashboard → SQL Editor

-- Option 1: If bucket already exists, make it public
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- Option 2: If bucket doesn't exist, create it as public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Verify
SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;

CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated reads"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;

CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');
-- ============================================
-- Fix ALL RLS Issues — Profiles + Storage
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- ============================================
-- 1. FIX PROFILES TABLE RLS
-- ============================================

-- Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public reads" ON public.profiles;

-- Create policies: users can only access their OWN row
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- ============================================
-- 2. FIX STORAGE (AVATARS BUCKET)
-- ============================================

-- Make avatars bucket public (for direct image URLs)
UPDATE storage.buckets
SET public = true
WHERE id = 'avatars';

-- Allow authenticated users to upload to avatars bucket
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

-- ============================================
-- 3. VERIFY (Optional — check results)
-- ============================================
SELECT 'profiles policies:' as section;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';

SELECT 'storage policies:' as section;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
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
-- ============================================
-- Auto-Calculation Triggers for Menu Engineering
-- حساب التكاليف والعمولات تلقائياً
-- ============================================

-- 1. Trigger: Calculate cost_share when linking ingredient to menu item
-- عند ربط مكون بوجبة، احسب تكلفة الحصة تلقائياً
CREATE OR REPLACE FUNCTION calculate_cost_share()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cost_share = NEW.quantity_needed * (
        SELECT cost_per_unit FROM ingredients WHERE id = NEW.ingredient_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_cost_share ON menu_item_ingredients;
CREATE TRIGGER trigger_calculate_cost_share
BEFORE INSERT OR UPDATE ON menu_item_ingredients
FOR EACH ROW EXECUTE FUNCTION calculate_cost_share();

-- 2. Trigger: Calculate commission and net revenue on each sale
-- عند تسجيل مبيعة، احسب العمولة والربح الصافي تلقائياً
CREATE OR REPLACE FUNCTION calculate_sale_deductions()
RETURNS TRIGGER AS $$
DECLARE
    plat_record platforms%ROWTYPE;
    commission_amt DECIMAL(12, 2) := 0;
    service_amt DECIMAL(12, 2) := 0;
    gateway_amt DECIMAL(12, 2) := 0;
    delivery_amt DECIMAL(10, 2) := 0;
BEGIN
    -- If platform specified, fetch rates
    IF NEW.platform_id IS NOT NULL THEN
        SELECT * INTO plat_record FROM platforms WHERE id = NEW.platform_id;
        IF FOUND THEN
            commission_amt := NEW.total_revenue * (plat_record.commission_rate / 100);
            service_amt := NEW.total_revenue * (plat_record.service_fee_rate / 100);
            gateway_amt := NEW.total_revenue * (plat_record.payment_gateway_fee / 100);
            delivery_amt := COALESCE(plat_record.delivery_fee, 0);
        END IF;
    END IF;
    
    NEW.commission_deduction := commission_amt;
    NEW.service_fee_deduction := service_amt;
    NEW.net_revenue := NEW.total_revenue - commission_amt - service_amt - gateway_amt - delivery_amt;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_sale_deductions ON sales_transactions;
CREATE TRIGGER trigger_calculate_sale_deductions
BEFORE INSERT OR UPDATE ON sales_transactions
FOR EACH ROW EXECUTE FUNCTION calculate_sale_deductions();
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
-- ============================================
-- Contact Messages Table
-- Stores submissions from the contact form
-- ============================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  sector text,
  service text,
  message text NOT NULL,
  read boolean DEFAULT false,
  source text DEFAULT 'website',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.contact_messages IS 'Contact form submissions';

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Only service_role / admin can read contact messages
CREATE POLICY "Service role can read contact messages"
  ON public.contact_messages FOR SELECT
  USING (false); -- Block direct access; admin API uses service_role

-- Anyone can insert (for the contact form)
CREATE POLICY "Anyone can submit contact message"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);
-- ============================================
-- Add email & phone to profiles + update trigger
-- ============================================

-- Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Update trigger to copy email & phone from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, restaurant_name, country, language, email, phone
  ) VALUES (
    new.id,
    new.raw_user_meta_data->>'restaurant_name',
    new.raw_user_meta_data->>'country',
    COALESCE(new.raw_user_meta_data->>'language', 'ar'),
    new.email,
    new.phone
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also backfill existing users
UPDATE public.profiles p
SET email = u.email,
    phone = u.phone
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.phone IS NULL);
-- ============================================
-- Admin Roles & Permissions
-- RBAC for admin dashboard
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'support', 'viewer')),
  granted_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.admin_roles IS 'Admin role assignments for dashboard RBAC';

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage admin roles directly
-- Frontend uses admin-verify API with service_role key

-- Permissions reference (not enforced at DB level, checked in API):
-- super_admin: all + manage_admins + settings
-- admin: users + messages + subscriptions + stats
-- support: users_read + messages_read + messages_write
-- viewer: users_read + messages_read (no write)
-- ============================================
-- Usage Analytics Logs
-- Tracks calculator usage for business insights
-- ============================================

CREATE TABLE IF NOT EXISTS public.usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  calculator text NOT NULL,
  country text,
  inputs jsonb,
  results jsonb,
  scenario_type text,
  source text DEFAULT 'web',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.usage_logs IS 'Calculator usage analytics';

-- Enable RLS
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Service role can read all; anon can insert (for tracking)
CREATE POLICY "Service role can read usage logs"
  ON public.usage_logs FOR SELECT
  USING (false);

CREATE POLICY "Anyone can log usage"
  ON public.usage_logs FOR INSERT
  WITH CHECK (true);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_calculator ON public.usage_logs(calculator);
CREATE INDEX IF NOT EXISTS idx_usage_logs_country ON public.usage_logs(country);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs(created_at DESC);
-- ============================================
-- Moyasar Invoices Table
-- Tracks SADAD/Bank Transfer payments
-- ============================================

CREATE TABLE IF NOT EXISTS public.moyasar_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users NOT NULL,
  tier text NOT NULL CHECK (tier IN ('pro', 'enterprise')),
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending', 'paid', 'failed', 'expired')),
  url text,
  metadata jsonb DEFAULT '{}',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_moyasar_invoices_user_id ON public.moyasar_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_moyasar_invoices_status ON public.moyasar_invoices(status);

-- RLS: users can only see their own invoices
ALTER TABLE public.moyasar_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own moyasar invoices"
  ON public.moyasar_invoices
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all moyasar invoices"
  ON public.moyasar_invoices
  FOR ALL
  USING (true)
  WITH CHECK (true);
