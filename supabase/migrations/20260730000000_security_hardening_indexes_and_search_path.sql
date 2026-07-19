-- Security hardening: set search_path on all SECURITY DEFINER functions
-- and add missing indexes on high-traffic foreign keys.
-- This migration is idempotent and safe to rerun.

-- Fix search-path injection risk for every SECURITY DEFINER function in public schema.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public, auth',
        r.proname,
        r.args
      );
    EXCEPTION WHEN OTHERS THEN
      -- Skip functions that cannot be altered (e.g., built-ins wrapped in public)
      RAISE NOTICE 'Could not set search_path for %: %', r.proname, SQLERRM;
    END;
  END LOOP;
END $$;

-- Indexes for high-traffic foreign keys and lookup columns.
CREATE INDEX IF NOT EXISTS idx_advisory_projects_client_id ON public.advisory_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_advisory_feasibility_studies_client_id ON public.advisory_feasibility_studies(client_id);
CREATE INDEX IF NOT EXISTS idx_advisory_feasibility_studies_project_id ON public.advisory_feasibility_studies(project_id);
CREATE INDEX IF NOT EXISTS idx_advisory_financial_models_project_id ON public.advisory_financial_models(project_id);

CREATE INDEX IF NOT EXISTS idx_ai_results_request_id ON public.ai_results(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_requests_request_id ON public.ai_review_requests(request_id);

CREATE INDEX IF NOT EXISTS idx_investment_memoranda_versions_memorandum_id ON public.investment_memoranda_versions(memorandum_id);
CREATE INDEX IF NOT EXISTS idx_investment_readiness_scores_project_id ON public.investment_readiness_scores(project_id);

CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_menu_item_id ON public.menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_ingredient_id ON public.menu_item_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_menu_platform_prices_menu_item_id ON public.menu_platform_prices(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_platform_prices_platform_id ON public.menu_platform_prices(platform_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_menu_item_id ON public.sales_transactions(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_platform_id ON public.sales_transactions(platform_id);

CREATE INDEX IF NOT EXISTS idx_recovery_asset_valuations_asset_id ON public.recovery_asset_valuations(asset_id);
CREATE INDEX IF NOT EXISTS idx_recovery_plans_asset_id ON public.recovery_plans(asset_id);

CREATE INDEX IF NOT EXISTS idx_city_indicator_values_city_id ON public.city_indicator_values(city_id);
CREATE INDEX IF NOT EXISTS idx_city_indicator_values_district_id ON public.city_indicator_values(district_id);
CREATE INDEX IF NOT EXISTS idx_city_projects_city_id ON public.city_projects(city_id);
CREATE INDEX IF NOT EXISTS idx_city_competitors_city_id ON public.city_competitors(city_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_intelligence_runs_user_id ON public.enterprise_intelligence_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_intelligence_graphs_run_id ON public.enterprise_intelligence_graphs(run_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_intelligence_recommendations_run_id ON public.enterprise_intelligence_recommendations(run_id);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id_calculator ON public.usage_logs(user_id, calculator);
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON public.page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_sessions_started_at ON public.page_sessions(started_at);
