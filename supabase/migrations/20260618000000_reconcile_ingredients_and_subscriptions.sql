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
  ORDER BY user_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
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
