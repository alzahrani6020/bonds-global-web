-- Enterprise Data Quality Center
-- Tables and functions to detect duplicates, missing data, broken relationships.

CREATE TABLE IF NOT EXISTS public.data_quality_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL CHECK (check_type IN ('duplicate','missing','broken_relation','orphan_file','incomplete','invalid')),
  entity_type text NOT NULL,
  entity_id uuid,
  field_name text,
  severity text NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_quality_type ON public.data_quality_issues(check_type);
CREATE INDEX IF NOT EXISTS idx_data_quality_entity ON public.data_quality_issues(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_data_quality_status ON public.data_quality_issues(status);
CREATE INDEX IF NOT EXISTS idx_data_quality_severity ON public.data_quality_issues(severity);

ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_quality_all ON public.data_quality_issues FOR ALL TO authenticated USING (public.is_advisory_user()) WITH CHECK (public.is_advisory_user());

-- Helper: clear existing open issues before re-running checks
CREATE OR REPLACE FUNCTION public.clear_data_quality_issues(p_check_type text DEFAULT NULL)
RETURNS void AS $$
BEGIN
  IF p_check_type IS NULL THEN
    DELETE FROM public.data_quality_issues WHERE status = 'open';
  ELSE
    DELETE FROM public.data_quality_issues WHERE status = 'open' AND check_type = p_check_type;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check duplicate advisory clients by email
CREATE OR REPLACE FUNCTION public.dq_find_duplicate_clients()
RETURNS bigint AS $$
DECLARE v_count bigint := 0;
BEGIN
  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message, metadata)
  SELECT 'duplicate', 'advisory_client', c1.id, 'email', 'high',
         'عميل مكرر بنفس البريد الإلكتروني: ' || c1.email,
         jsonb_build_object('email', c1.email, 'duplicate_ids', array_agg(c2.id))
  FROM public.advisory_clients c1
  JOIN public.advisory_clients c2 ON lower(trim(c1.email)) = lower(trim(c2.email)) AND c1.id < c2.id
  WHERE c1.email IS NOT NULL AND length(trim(c1.email)) > 0
  GROUP BY c1.id, c1.email;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check missing required fields
CREATE OR REPLACE FUNCTION public.dq_find_missing_fields()
RETURNS bigint AS $$
DECLARE v_count bigint := 0;
BEGIN
  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'missing', 'advisory_client', id, 'name', 'critical', 'اسم العميل ناقص'
  FROM public.advisory_clients WHERE name IS NULL OR length(trim(name)) = 0;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'missing', 'advisory_project', id, 'client_id', 'critical', 'المشروع غير مرتبط بعميل'
  FROM public.advisory_projects WHERE client_id IS NULL;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'missing', 'advisory_project', id, 'budget', 'medium', 'المشروع لا يحتوي على ميزانية'
  FROM public.advisory_projects WHERE budget IS NULL OR budget <= 0;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'missing', 'recovery_asset', id, 'original_value', 'medium', 'الأصل لا يحتوي على قيمة أصلية'
  FROM public.recovery_assets WHERE original_value IS NULL OR original_value <= 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check broken relations
CREATE OR REPLACE FUNCTION public.dq_find_broken_relations()
RETURNS bigint AS $$
DECLARE v_count bigint := 0;
BEGIN
  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'broken_relation', 'advisory_project', p.id, 'client_id', 'critical', 'المشروع مرتبط بعميل غير موجود'
  FROM public.advisory_projects p
  LEFT JOIN public.advisory_clients c ON c.id = p.client_id
  WHERE p.client_id IS NOT NULL AND c.id IS NULL;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'broken_relation', 'advisory_feasibility_study', s.id, 'client_id', 'critical', 'دراسة الجدوى مرتبطة بعميل غير موجود'
  FROM public.advisory_feasibility_studies s
  LEFT JOIN public.advisory_clients c ON c.id = s.client_id
  WHERE s.client_id IS NOT NULL AND c.id IS NULL;

  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message)
  SELECT 'broken_relation', 'advisory_feasibility_study', s.id, 'project_id', 'high', 'دراسة الجدوى مرتبطة بمشروع غير موجود'
  FROM public.advisory_feasibility_studies s
  LEFT JOIN public.advisory_projects p ON p.id = s.project_id
  WHERE s.project_id IS NOT NULL AND p.id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check incomplete projects
CREATE OR REPLACE FUNCTION public.dq_find_incomplete_projects()
RETURNS bigint AS $$
DECLARE v_count bigint := 0;
BEGIN
  INSERT INTO public.data_quality_issues (check_type, entity_type, entity_id, field_name, severity, message, metadata)
  SELECT 'incomplete', 'advisory_project', id, 'status', 'medium',
         'مشروع نشط بدون تاريخ انتهاء أو ميزانية',
         jsonb_build_object('status', status, 'budget', budget, 'end_date', end_date)
  FROM public.advisory_projects
  WHERE status = 'active' AND (end_date IS NULL OR budget IS NULL OR budget <= 0);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master check runner
CREATE OR REPLACE FUNCTION public.dq_run_all_checks()
RETURNS jsonb AS $$
DECLARE v_dup bigint;
DECLARE v_miss bigint;
DECLARE v_broken bigint;
DECLARE v_incomp bigint;
BEGIN
  PERFORM public.clear_data_quality_issues();
  v_dup := public.dq_find_duplicate_clients();
  v_miss := public.dq_find_missing_fields();
  v_broken := public.dq_find_broken_relations();
  v_incomp := public.dq_find_incomplete_projects();
  RETURN jsonb_build_object(
    'success', true,
    'duplicates', v_dup,
    'missing', v_miss,
    'broken_relations', v_broken,
    'incomplete', v_incomp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
