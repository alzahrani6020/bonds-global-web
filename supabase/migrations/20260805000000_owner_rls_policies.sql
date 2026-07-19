-- Migration: Owner-based and role-based RLS policies
-- Adds row-level security for user-scoped tables that were missing it.
-- Admin-only tables get role-based policies (recovery/advisory/city).

-- =============================================================================
-- 1. Helper functions for admin-module role checks
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_recovery_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.recovery_roles WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_recovery_manager()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.recovery_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_advisory_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.advisory_roles WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_advisory_manager()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.advisory_roles WHERE user_id = auth.uid() AND role = 'manager'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_city_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.city_roles WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()
  );
END;
$$;

-- =============================================================================
-- 2. Direct owner tables (user_id)
-- =============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'platforms',
    'menu_items',
    'menu_ingredients',
    'sales_transactions',
    'bonds_projects',
    'investment_memoranda',
    'investment_readiness_scores',
    'moyasar_invoices',
    'oneoff_purchases',
    'user_notifications'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_own_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid());',
      tbl || '_own_select', tbl
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_own_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());',
      tbl || '_own_insert', tbl
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_own_update', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());',
      tbl || '_own_update', tbl
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_own_delete', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid());',
      tbl || '_own_delete', tbl
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_admin_read', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN (''super_admin'', ''admin'', ''support'')));',
      tbl || '_admin_read', tbl
    );
  END LOOP;
END $$;

-- =============================================================================
-- 3. Parent-owner tables
-- =============================================================================

-- Menu engineering joins
ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_item_ingredients_own_select ON public.menu_item_ingredients;
CREATE POLICY menu_item_ingredients_own_select ON public.menu_item_ingredients
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_item_ingredients.menu_item_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS menu_item_ingredients_own_insert ON public.menu_item_ingredients;
CREATE POLICY menu_item_ingredients_own_insert ON public.menu_item_ingredients
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_item_ingredients.menu_item_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS menu_item_ingredients_own_update ON public.menu_item_ingredients;
CREATE POLICY menu_item_ingredients_own_update ON public.menu_item_ingredients
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_item_ingredients.menu_item_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_item_ingredients.menu_item_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS menu_item_ingredients_own_delete ON public.menu_item_ingredients;
CREATE POLICY menu_item_ingredients_own_delete ON public.menu_item_ingredients
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_item_ingredients.menu_item_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS menu_item_ingredients_admin_read ON public.menu_item_ingredients;
CREATE POLICY menu_item_ingredients_admin_read ON public.menu_item_ingredients
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

ALTER TABLE public.menu_platform_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_platform_prices_own_select ON public.menu_platform_prices;
CREATE POLICY menu_platform_prices_own_select ON public.menu_platform_prices
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_platform_prices.menu_item_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS menu_platform_prices_own_insert ON public.menu_platform_prices;
CREATE POLICY menu_platform_prices_own_insert ON public.menu_platform_prices
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_platform_prices.menu_item_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS menu_platform_prices_own_update ON public.menu_platform_prices;
CREATE POLICY menu_platform_prices_own_update ON public.menu_platform_prices
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_platform_prices.menu_item_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_platform_prices.menu_item_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS menu_platform_prices_own_delete ON public.menu_platform_prices;
CREATE POLICY menu_platform_prices_own_delete ON public.menu_platform_prices
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.menu_items WHERE id = menu_platform_prices.menu_item_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS menu_platform_prices_admin_read ON public.menu_platform_prices;
CREATE POLICY menu_platform_prices_admin_read ON public.menu_platform_prices
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

-- BONDS project children
ALTER TABLE public.bonds_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bonds_assets_own_select ON public.bonds_assets;
CREATE POLICY bonds_assets_own_select ON public.bonds_assets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_assets.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_assets_own_insert ON public.bonds_assets;
CREATE POLICY bonds_assets_own_insert ON public.bonds_assets
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_assets.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_assets_own_update ON public.bonds_assets;
CREATE POLICY bonds_assets_own_update ON public.bonds_assets
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_assets.project_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_assets.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_assets_own_delete ON public.bonds_assets;
CREATE POLICY bonds_assets_own_delete ON public.bonds_assets
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_assets.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_assets_admin_read ON public.bonds_assets;
CREATE POLICY bonds_assets_admin_read ON public.bonds_assets
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

ALTER TABLE public.bonds_valuations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bonds_valuations_own_select ON public.bonds_valuations;
CREATE POLICY bonds_valuations_own_select ON public.bonds_valuations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_valuations.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_valuations_own_insert ON public.bonds_valuations;
CREATE POLICY bonds_valuations_own_insert ON public.bonds_valuations
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_valuations.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_valuations_own_update ON public.bonds_valuations;
CREATE POLICY bonds_valuations_own_update ON public.bonds_valuations
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_valuations.project_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_valuations.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_valuations_own_delete ON public.bonds_valuations;
CREATE POLICY bonds_valuations_own_delete ON public.bonds_valuations
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_valuations.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_valuations_admin_read ON public.bonds_valuations;
CREATE POLICY bonds_valuations_admin_read ON public.bonds_valuations
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

ALTER TABLE public.bonds_financing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bonds_financing_own_select ON public.bonds_financing;
CREATE POLICY bonds_financing_own_select ON public.bonds_financing
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_financing.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_financing_own_insert ON public.bonds_financing;
CREATE POLICY bonds_financing_own_insert ON public.bonds_financing
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_financing.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_financing_own_update ON public.bonds_financing;
CREATE POLICY bonds_financing_own_update ON public.bonds_financing
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_financing.project_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_financing.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_financing_own_delete ON public.bonds_financing;
CREATE POLICY bonds_financing_own_delete ON public.bonds_financing
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_financing.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_financing_admin_read ON public.bonds_financing;
CREATE POLICY bonds_financing_admin_read ON public.bonds_financing
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

ALTER TABLE public.bonds_digital_twins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bonds_digital_twins_own_select ON public.bonds_digital_twins;
CREATE POLICY bonds_digital_twins_own_select ON public.bonds_digital_twins
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_digital_twins.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_digital_twins_own_insert ON public.bonds_digital_twins;
CREATE POLICY bonds_digital_twins_own_insert ON public.bonds_digital_twins
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_digital_twins.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_digital_twins_own_update ON public.bonds_digital_twins;
CREATE POLICY bonds_digital_twins_own_update ON public.bonds_digital_twins
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_digital_twins.project_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_digital_twins.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_digital_twins_own_delete ON public.bonds_digital_twins;
CREATE POLICY bonds_digital_twins_own_delete ON public.bonds_digital_twins
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_digital_twins.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_digital_twins_admin_read ON public.bonds_digital_twins;
CREATE POLICY bonds_digital_twins_admin_read ON public.bonds_digital_twins
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

ALTER TABLE public.bonds_project_context_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bonds_project_context_memory_own_select ON public.bonds_project_context_memory;
CREATE POLICY bonds_project_context_memory_own_select ON public.bonds_project_context_memory
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_context_memory.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_project_context_memory_own_insert ON public.bonds_project_context_memory;
CREATE POLICY bonds_project_context_memory_own_insert ON public.bonds_project_context_memory
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_context_memory.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_project_context_memory_own_update ON public.bonds_project_context_memory;
CREATE POLICY bonds_project_context_memory_own_update ON public.bonds_project_context_memory
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_context_memory.project_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_context_memory.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_project_context_memory_own_delete ON public.bonds_project_context_memory;
CREATE POLICY bonds_project_context_memory_own_delete ON public.bonds_project_context_memory
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_context_memory.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_project_context_memory_admin_read ON public.bonds_project_context_memory;
CREATE POLICY bonds_project_context_memory_admin_read ON public.bonds_project_context_memory
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

ALTER TABLE public.bonds_project_timeline_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bonds_project_timeline_events_own_select ON public.bonds_project_timeline_events;
CREATE POLICY bonds_project_timeline_events_own_select ON public.bonds_project_timeline_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_timeline_events.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_project_timeline_events_own_insert ON public.bonds_project_timeline_events;
CREATE POLICY bonds_project_timeline_events_own_insert ON public.bonds_project_timeline_events
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_timeline_events.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_project_timeline_events_own_update ON public.bonds_project_timeline_events;
CREATE POLICY bonds_project_timeline_events_own_update ON public.bonds_project_timeline_events
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_timeline_events.project_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_timeline_events.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_project_timeline_events_own_delete ON public.bonds_project_timeline_events;
CREATE POLICY bonds_project_timeline_events_own_delete ON public.bonds_project_timeline_events
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bonds_projects WHERE id = bonds_project_timeline_events.project_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS bonds_project_timeline_events_admin_read ON public.bonds_project_timeline_events;
CREATE POLICY bonds_project_timeline_events_admin_read ON public.bonds_project_timeline_events
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

-- Investment memoranda children
ALTER TABLE public.investment_memoranda_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investment_memoranda_versions_own_select ON public.investment_memoranda_versions;
CREATE POLICY investment_memoranda_versions_own_select ON public.investment_memoranda_versions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = investment_memoranda_versions.memorandum_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS investment_memoranda_versions_own_insert ON public.investment_memoranda_versions;
CREATE POLICY investment_memoranda_versions_own_insert ON public.investment_memoranda_versions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = investment_memoranda_versions.memorandum_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS investment_memoranda_versions_own_update ON public.investment_memoranda_versions;
CREATE POLICY investment_memoranda_versions_own_update ON public.investment_memoranda_versions
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = investment_memoranda_versions.memorandum_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = investment_memoranda_versions.memorandum_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS investment_memoranda_versions_own_delete ON public.investment_memoranda_versions;
CREATE POLICY investment_memoranda_versions_own_delete ON public.investment_memoranda_versions
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = investment_memoranda_versions.memorandum_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS investment_memoranda_versions_admin_read ON public.investment_memoranda_versions;
CREATE POLICY investment_memoranda_versions_admin_read ON public.investment_memoranda_versions
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

ALTER TABLE public.ai_investment_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_investment_reviews_own_select ON public.ai_investment_reviews;
CREATE POLICY ai_investment_reviews_own_select ON public.ai_investment_reviews
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = ai_investment_reviews.memorandum_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS ai_investment_reviews_own_insert ON public.ai_investment_reviews;
CREATE POLICY ai_investment_reviews_own_insert ON public.ai_investment_reviews
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = ai_investment_reviews.memorandum_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS ai_investment_reviews_own_update ON public.ai_investment_reviews;
CREATE POLICY ai_investment_reviews_own_update ON public.ai_investment_reviews
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = ai_investment_reviews.memorandum_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = ai_investment_reviews.memorandum_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS ai_investment_reviews_own_delete ON public.ai_investment_reviews;
CREATE POLICY ai_investment_reviews_own_delete ON public.ai_investment_reviews
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.investment_memoranda WHERE id = ai_investment_reviews.memorandum_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS ai_investment_reviews_admin_read ON public.ai_investment_reviews;
CREATE POLICY ai_investment_reviews_admin_read ON public.ai_investment_reviews
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

-- =============================================================================
-- 4. created_by / overridden_by owner table
-- =============================================================================
ALTER TABLE public.data_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_overrides_own_select ON public.data_overrides;
CREATE POLICY data_overrides_own_select ON public.data_overrides
  FOR SELECT TO authenticated USING (overridden_by = auth.uid());
DROP POLICY IF EXISTS data_overrides_own_insert ON public.data_overrides;
CREATE POLICY data_overrides_own_insert ON public.data_overrides
  FOR INSERT TO authenticated WITH CHECK (overridden_by = auth.uid());
DROP POLICY IF EXISTS data_overrides_own_update ON public.data_overrides;
CREATE POLICY data_overrides_own_update ON public.data_overrides
  FOR UPDATE TO authenticated USING (overridden_by = auth.uid()) WITH CHECK (overridden_by = auth.uid());
DROP POLICY IF EXISTS data_overrides_own_delete ON public.data_overrides;
CREATE POLICY data_overrides_own_delete ON public.data_overrides
  FOR DELETE TO authenticated USING (overridden_by = auth.uid());
DROP POLICY IF EXISTS data_overrides_admin_read ON public.data_overrides;
CREATE POLICY data_overrides_admin_read ON public.data_overrides
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')));

-- =============================================================================
-- 5. Admin-module role-based tables
-- =============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'recovery_assets',
    'recovery_asset_valuations',
    'recovery_distress_reasons',
    'recovery_plans',
    'recovery_plan_stages',
    'recovery_costs',
    'recovery_investors',
    'recovery_investor_offers',
    'recovery_documents',
    'recovery_notes',
    'recovery_activity_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_recovery_access', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_recovery_user()) WITH CHECK (public.is_recovery_user());',
      tbl || '_recovery_access', tbl
    );
  END LOOP;

  FOREACH tbl IN ARRAY ARRAY[
    'advisory_clients',
    'advisory_projects',
    'advisory_feasibility_studies',
    'advisory_financial_models',
    'advisory_documents',
    'advisory_notes',
    'advisory_activity_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_advisory_access', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());',
      tbl || '_advisory_access', tbl
    );
  END LOOP;
END $$;

-- City Intelligence data tables: read for any city user, write for managers/admins
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'city_indicator_values',
    'city_projects',
    'city_competitors',
    'city_reports',
    'city_activity_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_city_read', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_city_user());',
      tbl || '_city_read', tbl
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;',
      tbl || '_city_write', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.city_is_manager_or_admin(auth.uid())) WITH CHECK (public.city_is_manager_or_admin(auth.uid()));',
      tbl || '_city_write', tbl
    );
  END LOOP;
END $$;
