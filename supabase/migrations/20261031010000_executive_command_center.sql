-- Executive Command Center: governance, targets, alerts, decisions and scenarios.
-- Additive only. No existing analytics tables are dropped or rewritten.

CREATE TABLE IF NOT EXISTS public.analytics_data_sources (
  source_key text PRIMARY KEY,
  display_name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('ga4','supabase','payments','crm','tracking','search_console','manual','computed')),
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('healthy','degraded','unavailable','not_configured','disabled')),
  freshness_sla_minutes integer,
  owner_role text,
  metadata jsonb NOT NULL DEFAULT '{}',
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_metric_definitions (
  metric_key text PRIMARY KEY,
  display_name_ar text NOT NULL,
  display_name_en text,
  description text,
  unit text NOT NULL DEFAULT 'number',
  source_key text REFERENCES public.analytics_data_sources(source_key) ON DELETE SET NULL,
  formula text,
  owner_role text,
  refresh_minutes integer,
  sensitivity text NOT NULL DEFAULT 'internal' CHECK (sensitivity IN ('public','internal','confidential','restricted')),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','draft')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL REFERENCES public.analytics_metric_definitions(metric_key) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_value numeric(20,4) NOT NULL,
  comparison text NOT NULL DEFAULT 'gte' CHECK (comparison IN ('gte','lte','eq')),
  scenario text NOT NULL DEFAULT 'base' CHECK (scenario IN ('base','upside','downside')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_key,period_start,period_end,scenario)
);

CREATE TABLE IF NOT EXISTS public.analytics_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  metric_key text REFERENCES public.analytics_metric_definitions(metric_key) ON DELETE CASCADE,
  operator text NOT NULL CHECK (operator IN ('gt','gte','lt','lte','eq','pct_drop','pct_rise','stale')),
  threshold numeric(20,4),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','high','critical')),
  cooldown_minutes integer NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  owner_role text,
  escalation jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','implemented','measured','cancelled')),
  decision_type text NOT NULL DEFAULT 'management',
  expected_outcome jsonb NOT NULL DEFAULT '{}',
  baseline jsonb NOT NULL DEFAULT '{}',
  measured_outcome jsonb NOT NULL DEFAULT '{}',
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high','medium','low','unknown')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.analytics_decisions(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scenario_type text NOT NULL DEFAULT 'what_if',
  inputs jsonb NOT NULL DEFAULT '{}',
  outputs jsonb NOT NULL DEFAULT '{}',
  assumptions jsonb NOT NULL DEFAULT '{}',
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high','medium','low','unknown')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'private' CHECK (scope IN ('private','role','global')),
  role_name text,
  definition jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_refs jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_watchlists ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.analytics_data_sources, public.analytics_metric_definitions, public.analytics_targets,
  public.analytics_alert_rules, public.analytics_decisions, public.analytics_actions, public.analytics_scenarios,
  public.analytics_saved_views, public.analytics_watchlists FROM anon, authenticated;

INSERT INTO public.admin_permissions(permission,description,risk_level) VALUES
('analytics.command_center.read','Read executive command center analytics','high'),
('analytics.command_center.manage','Manage analytics targets, alerts, decisions and scenarios','critical')
ON CONFLICT(permission) DO NOTHING;

INSERT INTO public.admin_role_permissions(role,permission)
SELECT role,permission FROM (VALUES
('super_admin','analytics.command_center.read'),
('super_admin','analytics.command_center.manage'),
('admin','analytics.command_center.read')
) AS x(role,permission)
ON CONFLICT(role,permission) DO NOTHING;

INSERT INTO public.analytics_data_sources(source_key,display_name,source_type,status,freshness_sla_minutes,owner_role) VALUES
('ga4','Google Analytics 4','ga4','not_configured',15,'admin'),
('tracking','BONDS First-Party Tracking','tracking','not_configured',15,'admin'),
('crm','BONDS CRM','crm','not_configured',60,'admin'),
('payments','Payments','payments','not_configured',60,'finance'),
('funding','Funding Cases','supabase','not_configured',60,'admin')
ON CONFLICT(source_key) DO NOTHING;

INSERT INTO public.analytics_metric_definitions(metric_key,display_name_ar,display_name_en,description,unit,source_key,formula,owner_role,refresh_minutes) VALUES
('visitors_today','زوار اليوم','Visitors today','Unique active users reported by GA4 for today','users','ga4','GA4 activeUsers, date=today','marketing',15),
('active_users_now','المتواجدون الآن','Active users now','Realtime active users from GA4','users','ga4','GA4 realtime activeUsers','marketing',1),
('leads_today','Leads اليوم','Leads today','First-party lead creation events today','count','tracking','count(contact_lead_created and qualified lead events)','sales',15),
('funding_requests_30d','طلبات التمويل 30 يوم','Funding requests 30d','Funding cases created in the last 30 days','count','funding','count(funding_cases created_at >= now-30d)','funding',60),
('monthly_revenue','الإيراد الشهري','Monthly revenue','Paid invoice revenue in current calendar month','SAR','payments','sum(paid invoice amount)/100','finance',60),
('pipeline_value','قيمة Pipeline','Pipeline value','Open CRM opportunity gross value','SAR','crm','sum(open crm_opportunities.value_amount)','sales',60),
('conversion_rate','معدل التحويل','Conversion rate','Leads divided by GA4 active users for selected period','percent','ga4','leads / activeUsers * 100','growth',15),
('business_health','صحة الأعمال','Business health','Target-weighted composite; UNKNOWN until targets exist','score','computed','weighted target attainment across configured executive KPIs','management',60)
ON CONFLICT(metric_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_analytics_targets_metric_period ON public.analytics_targets(metric_key,period_start DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_alert_rules_enabled ON public.analytics_alert_rules(enabled,metric_key);
CREATE INDEX IF NOT EXISTS idx_analytics_decisions_status ON public.analytics_decisions(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_actions_status ON public.analytics_actions(status,due_at);
