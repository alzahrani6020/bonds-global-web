-- Bonds V3 — Alerts Engine
-- Stores alert rules and generated alerts for metric changes.

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  metric_code text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('city', 'activity', 'city_activity')),
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  threshold_type text NOT NULL CHECK (threshold_type IN ('relative', 'absolute')),
  threshold_value numeric NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  is_active boolean NOT NULL DEFAULT true,
  check_previous_year boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_active
  ON public.alert_rules(is_active, metric_code);
CREATE INDEX IF NOT EXISTS idx_alert_rules_entity
  ON public.alert_rules(city_id, activity_id);

CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.economic_activities(id) ON DELETE CASCADE,
  metric_code text NOT NULL,
  old_value numeric,
  new_value numeric,
  change_value numeric,
  change_percent numeric,
  severity text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  sent_email boolean NOT NULL DEFAULT false,
  sent_webhook boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_unread
  ON public.alerts(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_rule_id
  ON public.alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_alerts_city_activity
  ON public.alerts(city_id, activity_id);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages alert rules"
  ON public.alert_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public can read active alert rules"
  ON public.alert_rules FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Service role manages alerts"
  ON public.alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public can read alerts"
  ON public.alerts FOR SELECT TO anon, authenticated USING (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS alert_rules_updated_at ON public.alert_rules;
CREATE TRIGGER alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed a default rule: rent increase > 10% in any city
INSERT INTO public.alert_rules (name, description, metric_code, entity_type, threshold_type, threshold_value, severity)
VALUES (
  'ارتفاع الإيجار',
  'تنبيه عندما يرتفع متوسط الإيجار للمتر المربع بنسبة تزيد عن 10%',
  'avg_rent_per_sqm',
  'city',
  'relative',
  0.10,
  'warning'
)
ON CONFLICT DO NOTHING;
