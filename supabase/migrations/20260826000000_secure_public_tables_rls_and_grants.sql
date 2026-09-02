-- Migration: Secure public tables and views by enabling RLS and revoking dangerous anon/authenticated grants
-- Project: bonds-global
-- Date: 2026-08-26
-- Scope: Security hardening only. No business logic changes, no data deletion, no table renames.

-- ============================================================
-- 1. Enable Row Level Security on 25 public tables without RLS
-- ============================================================

ALTER TABLE public._migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_market_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confidence_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_api_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_connector_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_consensus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_data_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_decision_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_observability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_refresh_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_source_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_country_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_scheduled_posts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Revoke dangerous CRUD grants from anon/authenticated on 25 tables
-- ============================================================

REVOKE SELECT, INSERT, UPDATE, DELETE ON public._migrations FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activity_market_profiles FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.bonds_objects FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.bonds_sequences FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.business_rules_registry FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.confidence_log FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.data_feedback FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.data_sources FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_api_contracts FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_conflicts FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_connector_definitions FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_consensus FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_data_quality FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_decision_impacts FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_marketplace_items FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_observability_events FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_plugins FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_provenance FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_refresh_policies FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fabric_source_rankings FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.formula_registry FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.official_country_data FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.social_accounts FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.social_posts FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.social_scheduled_posts FROM anon, authenticated;

-- ============================================================
-- 3. Revoke dangerous CRUD grants from anon/authenticated on 3 exposed views
-- ============================================================

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.assets_due_for_reassessment FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.high_risk_assets FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.metric_feedback_accuracy FROM anon, authenticated;

-- ============================================================
-- 4. Revoke EXECUTE on dangerous admin-only functions from anon/authenticated
--    capture_lead, global_search, get_user_permissions are intentionally left unchanged.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.grant_all_permissions(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_data_quality_issues(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dq_run_all_checks() FROM anon, authenticated;

-- ============================================================
-- 5. Force RLS for table owners (defense in depth)
--    Ensures RLS applies even when queries are run by the table owner.
-- ============================================================

ALTER TABLE public._migrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_market_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_objects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bonds_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules_registry FORCE ROW LEVEL SECURITY;
ALTER TABLE public.confidence_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_api_contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_conflicts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_connector_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_consensus FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_data_quality FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_decision_impacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_marketplace_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_observability_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_plugins FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_provenance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_refresh_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_source_rankings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.formula_registry FORCE ROW LEVEL SECURITY;
ALTER TABLE public.official_country_data FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_scheduled_posts FORCE ROW LEVEL SECURITY;
