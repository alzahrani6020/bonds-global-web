-- Rollback for migration: 20260826000000_secure_public_tables_rls_and_grants.sql
-- WARNING: This restores the pre-migration vulnerable state. Use only in emergency.
-- Date: 2026-08-26

-- ============================================================
-- 1. Restore EXECUTE grants on functions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.grant_all_permissions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_data_quality_issues(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dq_run_all_checks() TO anon, authenticated;

-- ============================================================
-- 2. Restore CRUD grants on tables and views
-- ============================================================

GRANT DELETE, INSERT, SELECT, UPDATE ON public._migrations TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public._migrations TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.activity_market_profiles TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.activity_market_profiles TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.assets_due_for_reassessment TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.assets_due_for_reassessment TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.bonds_objects TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.bonds_objects TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.bonds_sequences TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.bonds_sequences TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.business_rules_registry TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.business_rules_registry TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.confidence_log TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.confidence_log TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.data_feedback TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.data_feedback TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.data_sources TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.data_sources TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_api_contracts TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_api_contracts TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_conflicts TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_conflicts TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_connector_definitions TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_connector_definitions TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_consensus TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_consensus TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_data_quality TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_data_quality TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_decision_impacts TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_decision_impacts TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_marketplace_items TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_marketplace_items TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_observability_events TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_observability_events TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_plugins TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_plugins TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_provenance TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_provenance TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_refresh_policies TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_refresh_policies TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_source_rankings TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.fabric_source_rankings TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.formula_registry TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.formula_registry TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.high_risk_assets TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.high_risk_assets TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.metric_feedback_accuracy TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.metric_feedback_accuracy TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.official_country_data TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.official_country_data TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.social_accounts TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.social_accounts TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.social_posts TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.social_posts TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.social_scheduled_posts TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.social_scheduled_posts TO authenticated;

-- ============================================================
-- 3. Disable forced RLS
-- ============================================================

ALTER TABLE public._migrations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_market_profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_objects NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_sequences NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules_registry NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.confidence_log NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_feedback NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_api_contracts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_conflicts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_connector_definitions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_consensus NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_data_quality NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_decision_impacts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_marketplace_items NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_observability_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_plugins NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_provenance NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_refresh_policies NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_source_rankings NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.formula_registry NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.official_country_data NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_scheduled_posts NO FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Disable RLS
-- ============================================================

ALTER TABLE public._migrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_market_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules_registry DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.confidence_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_api_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_conflicts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_connector_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_consensus DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_data_quality DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_decision_impacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_marketplace_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_observability_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_plugins DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_provenance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_refresh_policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_source_rankings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_registry DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_country_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_scheduled_posts DISABLE ROW LEVEL SECURITY;
