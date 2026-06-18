-- ============================================
-- Reconcile conflicting `ingredients` and `subscriptions` definitions
-- Date: 2026-06-18
--
-- Ingredients:
--   - Rename the menu-engineering `ingredients` table to `menu_ingredients`.
--   - Add columns the menu-engineering UI expects (`current_price`, `category`).
--   - Create the recipe-costing `ingredients` table plus `ingredient_prices`,
--     `recipes`, and `recipe_ingredients`.
--
-- Subscriptions:
--   - Unify V2 (`plan`) and V3 (`tier`) columns on the canonical `tier` field.
--   - Add missing columns: `cancel_at_period_end`, `stripe_price_id`,
--     `current_period_start`.
--   - Enforce unique user_id and standard RLS/service-role policies.
-- ============================================

-- ------------------------------------------------------------------
-- 1. Shared utility function
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------
-- 2. Rename menu-engineering ingredients -> menu_ingredients
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ingredients'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_ingredients'
  ) THEN
    ALTER TABLE ingredients RENAME TO menu_ingredients;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 3. Align menu_ingredients columns with the menu-engineering UI
-- ------------------------------------------------------------------
ALTER TABLE public.menu_ingredients
  ADD COLUMN IF NOT EXISTS current_price DECIMAL(12, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_ingredients' AND column_name = 'cost_per_unit'
  ) THEN
    UPDATE public.menu_ingredients
    SET current_price = COALESCE(cost_per_unit, 0)
    WHERE current_price = 0 OR current_price IS NULL;
  END IF;
END $$;

COMMENT ON TABLE public.menu_ingredients IS 'Menu engineering ingredient inventory per restaurant';

-- ------------------------------------------------------------------
-- 4. Repoint FK from menu_item_ingredients to menu_ingredients
-- ------------------------------------------------------------------
DO $$
DECLARE
  conname text;
BEGIN
  SELECT tc.constraint_name INTO conname
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'menu_item_ingredients'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'ingredient_id';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.menu_item_ingredients DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.menu_item_ingredients
  ADD CONSTRAINT fk_menu_item_ingredients_menu_ingredient
  FOREIGN KEY (ingredient_id) REFERENCES public.menu_ingredients(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- 5. Update trigger to read from menu_ingredients
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_cost_share()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cost_share = NEW.quantity_needed * (
    SELECT COALESCE(current_price, cost_per_unit, 0)
    FROM public.menu_ingredients
    WHERE id = NEW.ingredient_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_cost_share ON public.menu_item_ingredients;
CREATE TRIGGER trigger_calculate_cost_share
  BEFORE INSERT OR UPDATE ON public.menu_item_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.calculate_cost_share();

-- ------------------------------------------------------------------
-- 6. RLS + policies + indexes for menu_ingredients
-- ------------------------------------------------------------------
ALTER TABLE public.menu_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own ingredients" ON public.menu_ingredients;
DROP POLICY IF EXISTS "Users can CRUD their own menu ingredients" ON public.menu_ingredients;
CREATE POLICY "Users can CRUD their own menu ingredients"
  ON public.menu_ingredients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP INDEX IF EXISTS idx_ingredients_user;
DROP INDEX IF EXISTS idx_ingredients_name_user;
CREATE INDEX IF NOT EXISTS idx_menu_ingredients_user ON public.menu_ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_ingredients_name_user ON public.menu_ingredients(user_id, name);

-- ------------------------------------------------------------------
-- 7. Create recipe-costing ingredients tables
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ingredients IS 'User ingredient inventory for recipe costing';

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own ingredients" ON public.ingredients;
CREATE POLICY "Users can CRUD own ingredients"
  ON public.ingredients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ingredients_user ON public.ingredients(user_id);

CREATE TABLE IF NOT EXISTS public.ingredient_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid REFERENCES public.ingredients ON DELETE CASCADE NOT NULL,
  price numeric NOT NULL,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ingredient_prices IS 'Ingredient price change history';

ALTER TABLE public.ingredient_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own ingredient prices" ON public.ingredient_prices;
CREATE POLICY "Users can CRUD own ingredient prices"
  ON public.ingredient_prices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id = ingredient_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ingredients i WHERE i.id = ingredient_id AND i.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ingredient_prices_ingredient ON public.ingredient_prices(ingredient_id);

CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  yield_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.recipes IS 'User recipe/dish definitions';

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own recipes" ON public.recipes;
CREATE POLICY "Users can CRUD own recipes"
  ON public.recipes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recipes_user ON public.recipes(user_id);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES public.recipes ON DELETE CASCADE NOT NULL,
  ingredient_id uuid REFERENCES public.ingredients ON DELETE CASCADE NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (recipe_id, ingredient_id)
);

COMMENT ON TABLE public.recipe_ingredients IS 'Links recipes to ingredients with quantities';

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own recipe ingredients" ON public.recipe_ingredients;
CREATE POLICY "Users can CRUD own recipe ingredients"
  ON public.recipe_ingredients FOR ALL
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);

-- Price-change audit trigger for recipe ingredients
CREATE OR REPLACE FUNCTION public.log_ingredient_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.ingredient_prices (ingredient_id, price) VALUES (NEW.id, NEW.price);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ingredient_price_change ON public.ingredients;
CREATE TRIGGER trg_ingredient_price_change
  AFTER UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.log_ingredient_price_change();

-- updated_at triggers for recipe tables
DROP TRIGGER IF EXISTS trg_ingredients_updated_at ON public.ingredients;
CREATE TRIGGER trg_ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ingredient_prices_updated_at ON public.ingredient_prices;
CREATE TRIGGER trg_ingredient_prices_updated_at
  BEFORE UPDATE ON public.ingredient_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recipes_updated_at ON public.recipes;
CREATE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recipe_ingredients_updated_at ON public.recipe_ingredients;
CREATE TRIGGER trg_recipe_ingredients_updated_at
  BEFORE UPDATE ON public.recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------
-- 8. Reconcile subscriptions table (V2 vs V3)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'tier'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN tier text NOT NULL DEFAULT 'free';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'plan'
  ) THEN
    UPDATE public.subscriptions SET tier = plan WHERE tier IS NULL OR tier = '';
    ALTER TABLE public.subscriptions DROP COLUMN plan;
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

-- Remove duplicates before enforcing uniqueness
DELETE FROM public.subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.subscriptions
  ORDER BY user_id, COALESCE(updated_at, created_at, id::text) DESC NULLS LAST
);

DO $$
DECLARE
  conname text;
BEGIN
  SELECT tc.constraint_name INTO conname
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'subscriptions'
    AND tc.constraint_type = 'UNIQUE'
    AND tc.constraint_name LIKE '%user_id%';

  IF conname IS NULL THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

COMMENT ON TABLE public.subscriptions IS 'Unified Stripe-linked subscription records';

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ============================================
-- Funding Sources Directory
-- Banks, Funds, Investors, Government Programs
-- ============================================

CREATE TABLE IF NOT EXISTS public.funding_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('bank', 'fund', 'investor', 'government_program')),
  name_ar text NOT NULL,
  name_en text,
  country_code text NOT NULL DEFAULT 'SA',
  sector text, -- comma-separated or single sector; filterable
  description text,
  eligibility text,
  min_amount numeric,
  max_amount numeric,
  currency text NOT NULL DEFAULT 'SAR',
  interest_rate text, -- e.g. "5% - 8%" or "profit sharing"
  tenure text,        -- e.g. "up to 7 years"
  financing_type text, -- e.g. "loan", "equity", "grant", "guarantee"
  website text,
  email text,
  phone text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.funding_sources IS 'Directory of banks, funds, investors and government financing programs';

ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active funding sources" ON public.funding_sources;
CREATE POLICY "Anyone can read active funding sources"
  ON public.funding_sources FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage funding sources" ON public.funding_sources;
CREATE POLICY "Service role can manage funding sources"
  ON public.funding_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage funding sources" ON public.funding_sources;
CREATE POLICY "Admins can manage funding sources"
  ON public.funding_sources FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
  ));

CREATE INDEX IF NOT EXISTS idx_funding_sources_country ON public.funding_sources(country_code);
CREATE INDEX IF NOT EXISTS idx_funding_sources_type ON public.funding_sources(type);
CREATE INDEX IF NOT EXISTS idx_funding_sources_sector ON public.funding_sources USING gin (to_tsvector('simple', COALESCE(sector, '')));
CREATE INDEX IF NOT EXISTS idx_funding_sources_active ON public.funding_sources(is_active, is_featured, sort_order);

DROP TRIGGER IF EXISTS trg_funding_sources_updated_at ON public.funding_sources;
CREATE TRIGGER trg_funding_sources_updated_at
  BEFORE UPDATE ON public.funding_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed sample data (Saudi Arabia examples; safe to re-run with ON CONFLICT)
INSERT INTO public.funding_sources (
  type, name_ar, name_en, country_code, sector, description, eligibility,
  min_amount, max_amount, currency, interest_rate, tenure, financing_type,
  website, is_active, is_featured, sort_order
) VALUES
-- Saudi Arabia
('government_program', 'برنامج كفالة', 'Kafala Program', 'SA', 'all', 'برنامج ضمان التمويل للمنشآت الصغيرة والمتوسطة.', 'منشآت صغيرة ومتوسطة مسجلة لمدة سنة على الأقل.', 10000, 2000000, 'SAR', 'يحدده البنك الممول', 'حتى 7 سنوات', 'guarantee', 'https://kafala.gov.sa', true, true, 1),
('bank', 'البنك الأهلي السعودي', 'Saudi National Bank (SNB)', 'SA', 'all', 'تمويل الشركات والمنشآت الصغيرة والمتوسطة.', 'شركات مسجلة ومالية سليمة.', 50000, 50000000, 'SAR', 'SAMA repo + margin', '1 - 10 سنوات', 'loan', 'https://www.alahli.com', true, true, 2),
('bank', 'بنك الرياض', 'Riyad Bank', 'SA', 'all', 'حلول تمويلية متنوعة للأعمال.', 'شركات سعودية مسجلة.', 50000, 30000000, 'SAR', 'SAMA repo + margin', '1 - 8 سنوات', 'loan', 'https://www.riyadbank.com', true, false, 3),
('fund', 'صندوق رأس المال الجريء — Monshaat', 'Monshaat VC Fund', 'SA', 'technology,manufacturing', 'استثمارات في الشركات الناشئة والمتوسطة.', 'نموذج عمل قابل للتوسع وفريق قوي.', 500000, 10000000, 'SAR', 'equity stake', '3 - 7 سنوات', 'equity', 'https://www.monshaat.gov.sa', true, false, 4),
('investor', 'مستثمرون أنجال', 'Angel Investors Saudi', 'SA', 'technology,food,healthcare', 'شبكة مستثمرين أفراد للشركات الناشئة.', 'MVP واضح وفريق تنفيذي.', 100000, 2000000, 'SAR', 'equity or convertible note', '2 - 5 سنوات', 'equity', 'https://angelinvestors.sa', true, false, 5),
('government_program', 'صندوق التنمية الصناعية السعودي', 'SIDF', 'SA', 'manufacturing,industry', 'تمويل المشاريع الصناعية والتعدينية.', 'مشاريع صناعية سعودية.', 1000000, 500000000, 'SAR', 'منافس', 'حتى 15 سنة', 'loan', 'https://www.sidf.gov.sa', true, true, 6),
('government_program', 'برنامج ريادة', 'Riyadah', 'SA', 'all', 'دعم ريادة الأعمال والمنشآت الناشئة.', 'رواد أعمال سعوديون.', 50000, 500000, 'SAR', 'منخفض', '3 - 5 سنوات', 'loan', 'https://www.riyadah.com.sa', true, false, 7),

-- UAE
('bank', 'بنك أبوظبي الأول', 'First Abu Dhabi Bank (FAB)', 'AE', 'all', 'حلول تمويلية للشركات في الإمارات.', 'شركات إماراتية مسجلة.', 100000, 10000000, 'AED', 'EIBOR + margin', '1 - 7 سنوات', 'loan', 'https://www.bankfab.com', true, true, 8),
('government_program', 'صندوق خليفة', 'Khalifa Fund', 'AE', 'all', 'دعم وتمويل المشاريع الصغيرة والمتوسطة في أبوظبي.', 'مواطنو أبوظبي والمقيمون.', 50000, 5000000, 'AED', 'منخفض', '5 - 10 سنوات', 'loan', 'https://www.khalifafund.ae', true, true, 9),
('fund', 'مبادلة للاستثمارات', 'Mubadala Investment Company', 'AE', 'technology,healthcare,manufacturing', 'استثمارات استراتيجية في قطاعات النمو.', 'شركات كبرى أو ناشئة ذات تأثير استراتيجي.', 5000000, 500000000, 'AED', 'equity stake', '5 - 10 سنوات', 'equity', 'https://www.mubadala.ae', true, false, 10),
('investor', 'دبي فيوتشر فوند', 'Dubai Future District Fund', 'AE', 'technology', 'صندوق استثماري للتقنية والابتكار.', 'شركات تقنية ناشئة.', 1000000, 20000000, 'AED', 'equity stake', '3 - 7 سنوات', 'equity', 'https://dubaifuture.ae', true, false, 11),
('government_program', 'برنامج محمد بن راشد للابتكار', 'Mohammed bin Rashid Innovation Fund', 'AE', 'technology,manufacturing', 'تمويل مشاريع الابتكار والتقنية.', 'شركات إماراتية مبتكرة.', 100000, 5000000, 'AED', 'منخفض', '3 - 7 سنوات', 'loan', 'https://www.mbrinnovationfund.ae', true, false, 12),

-- Egypt
('bank', 'البنك الأهلي المصري', 'National Bank of Egypt', 'EG', 'all', 'تمويل الشركات والمشروعات الصغيرة والمتوسطة.', 'شركات مصرية مسجلة.', 50000, 20000000, 'EGP', 'CBE corridor + margin', '1 - 7 سنوات', 'loan', 'https://www.nbe.com.eg', true, true, 13),
('government_program', 'جهاز المشروعات الصغيرة والمتوسطة', 'MSMEDA', 'EG', 'all', 'تمويل وتدريب المشروعات الصغيرة والمتوسطة.', 'مصريون أفراد أو شركات.', 5000, 5000000, 'EGP', 'ميسر', '3 - 7 سنوات', 'loan', 'https://www.msmeda.org.eg', true, true, 14),
('fund', 'الصندوق السيادي المصري', 'Egypt Sovereign Fund', 'EG', 'infrastructure,energy,manufacturing', 'استثمارات في مشاريع البنية التحتية والطاقة.', 'مشاريع كبرى أو شركات استراتيجية.', 10000000, 1000000000, 'EGP', 'equity or debt', '5 - 15 سنة', 'equity', 'https://www.tsieg.com', true, false, 15),
('investor', '500 Startups — Egypt', '500 Startups Egypt', 'EG', 'technology', 'مسرعة وصندوق استثماري للشركات الناشئة.', 'شركات ناشئة تقنية.', 50000, 500000, 'USD', 'equity stake', '2 - 5 سنوات', 'equity', 'https://500.co', true, false, 16),

-- Jordan
('bank', 'بنك الأردن', 'Bank of Jordan', 'JO', 'all', 'تمويل الأعمال والمشاريع الصغيرة.', 'شركات أردنية مسجلة.', 10000, 5000000, 'JOD', 'CBR rate + margin', '1 - 7 سنوات', 'loan', 'https://www.bankofjordan.com', true, true, 17),
('government_program', 'صندوق تنمية المحافظات', 'Local Development Fund', 'JO', 'all', 'تمويل مشاريع التنمية المحلية.', 'مشاريع في المحافظات الأردنية.', 5000, 500000, 'JOD', 'ميسر', '3 - 7 سنوات', 'loan', 'https://www.ldf.gov.jo', true, false, 18),
('investor', 'Oasis500', 'Oasis500', 'JO', 'technology', 'مسرعة أعمال وصندوق استثماري.', 'شركات ناشئة في مرحلة مبكرة.', 10000, 250000, 'JOD', 'equity stake', '2 - 5 سنوات', 'equity', 'https://www.oasis500.com', true, false, 19),

-- Kuwait
('bank', 'بنك الكويت الوطني', 'National Bank of Kuwait', 'KW', 'all', 'تمويل الشركات والمؤسسات.', 'شركات كويتية مسجلة.', 50000, 10000000, 'KWD', 'CBK rate + margin', '1 - 7 سنوات', 'loan', 'https://www.nbk.com', true, true, 20),
('government_program', 'الصندوق الوطني لرعاية وحماية المشروعات', 'National Fund for SMEs', 'KW', 'all', 'دعم المشاريع الصغيرة والمتوسطة.', 'مشاريع كويتية.', 5000, 500000, 'KWD', 'ميسر', '3 - 7 سنوات', 'loan', 'https://www.nationalfund.gov.kw', true, true, 21),

-- Qatar
('bank', 'بنك قطر الوطني', 'Qatar National Bank', 'QA', 'all', 'حلول تمويلية للشركات.', 'شركات مسجلة في قطر.', 100000, 15000000, 'QAR', 'QCB rate + margin', '1 - 7 سنوات', 'loan', 'https://www.qnb.com', true, true, 22),
('government_program', 'صندوق قطر للتنمية', 'Qatar Development Bank', 'QA', 'all', 'تمويل وتطوير المشاريع القطرية.', 'شركات قطرية.', 50000, 5000000, 'QAR', 'منافس', '3 - 10 سنوات', 'loan', 'https://www.qdb.qa', true, true, 23),

-- Bahrain
('bank', 'بنك الأهلي المتحد', 'Ahli United Bank', 'BH', 'all', 'تمويل الأعمال والمشاريع.', 'شركات بحرينية مسجلة.', 10000, 3000000, 'BHD', 'CB rate + margin', '1 - 7 سنوات', 'loan', 'https://www.ahliunited.com', true, true, 24),
('government_program', 'تمكين', 'Tamkeen', 'BH', 'all', 'دعم تمويل وتدريب المؤسسات البحرينية.', 'شركات بحرينية.', 2000, 500000, 'BHD', 'دعم', '3 - 7 سنوات', 'loan', 'https://www.tamkeen.bh', true, true, 25),

-- Oman
('bank', 'بنك عمان العربي', 'Bank Muscat', 'OM', 'all', 'تمويل الشركات والمشاريع.', 'شركات عمانية مسجلة.', 10000, 5000000, 'OMR', 'CBR rate + margin', '1 - 7 سنوات', 'loan', 'https://www.bankmuscat.com', true, true, 26),
('government_program', 'صندوق الرفد', 'Rafd Fund', 'OM', 'all', 'تمويل المشاريع الصغيرة والمتوسطة.', 'مشاريع عمانية.', 5000, 500000, 'OMR', 'ميسر', '3 - 7 سنوات', 'loan', 'https://www.rafd.gov.om', true, true, 27),

-- Morocco
('bank', 'Attijariwafa Bank', 'Attijariwafa Bank', 'MA', 'all', 'تمويل الشركات والمشاريع.', 'شركات مغربية مسجلة.', 50000, 50000000, 'MAD', 'BAM rate + margin', '1 - 7 سنوات', 'loan', 'https://www.attijariwafabank.com', true, true, 28),
('government_program', 'إنعاش الأعمال', 'Maroc PME', 'MA', 'all', 'دعم المقاولات الصغرى والمتوسطة.', 'مقاولات مغربية.', 10000, 2000000, 'MAD', 'ميسر', '3 - 7 سنوات', 'loan', 'https://www.marocpme.ma', true, true, 29),

-- Tunisia
('bank', 'البنك التونسي للتضامن', 'BT', 'TN', 'all', 'تمويل المشاريع والأعمال.', 'شركات تونسية مسجلة.', 10000, 10000000, 'TND', 'BCT rate + margin', '1 - 7 سنوات', 'loan', 'https://www.bt.com.tn', true, true, 30),
('government_program', 'الصندوق الوطني للتمويل', 'National Financing Fund', 'TN', 'all', 'تمويل المشاريع الصغرى والمتوسطة.', 'مشاريع تونسية.', 5000, 500000, 'TND', 'ميسر', '3 - 7 سنوات', 'loan', 'https://www.fntp.tn', true, true, 31)
ON CONFLICT DO NOTHING;
