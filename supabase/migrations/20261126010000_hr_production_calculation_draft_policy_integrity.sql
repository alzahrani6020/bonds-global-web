-- Production reconciliation: restore the guard proven in staging.
-- Checked against production 2026-11-26: missing guard and incorrect RLS comparisons.
-- Adds no members, edits no records, and does not create a second trigger on repeat.
-- Additive guard for privileged HR calculation-draft writes. No existing rows are rewritten.
-- An RLS policy alone cannot guard writes using service_role (BYPASSRLS).
-- The invoker-role trigger reads only these reviewed policy columns.
-- CI's service_role deliberately has narrower table grants than the hosted project.
GRANT SELECT (id, workspace_id, jurisdiction, status)
ON public.hr_saas_rule_sets TO service_role;

CREATE OR REPLACE FUNCTION hr_saas_private.assert_calculation_draft_policy_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.hr_saas_rule_sets p
    WHERE p.id = NEW.policy_id
      AND p.workspace_id = NEW.workspace_id
      AND p.jurisdiction = NEW.jurisdiction
      AND p.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'HR calculation draft requires an approved same-workspace and same-jurisdiction policy'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hr_calculation_draft_policy_integrity ON public.hr_saas_calculation_drafts;
CREATE TRIGGER hr_calculation_draft_policy_integrity
BEFORE INSERT OR UPDATE OF workspace_id, policy_id, jurisdiction
ON public.hr_saas_calculation_drafts
FOR EACH ROW EXECUTE FUNCTION hr_saas_private.assert_calculation_draft_policy_integrity();

-- Resolve previously shadowed column names explicitly in the insert RLS policy.
DROP POLICY IF EXISTS hr_calculation_owner_insert ON public.hr_saas_calculation_drafts;
CREATE POLICY hr_calculation_owner_insert ON public.hr_saas_calculation_drafts
FOR INSERT TO authenticated WITH CHECK (
  created_by = (SELECT auth.uid())
  AND status = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.hr_saas_workspaces w
    WHERE w.id = hr_saas_calculation_drafts.workspace_id
      AND w.owner_user_id = (SELECT auth.uid())
  )
  AND hr_saas_private.has_active_access(workspace_id)
  AND EXISTS (
    SELECT 1 FROM public.hr_saas_rule_sets p
    WHERE p.id = hr_saas_calculation_drafts.policy_id
      AND p.workspace_id = hr_saas_calculation_drafts.workspace_id
      AND p.jurisdiction = hr_saas_calculation_drafts.jurisdiction
      AND p.status = 'approved'
  )
);
