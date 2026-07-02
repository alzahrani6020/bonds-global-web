-- Phase D.1.5 — Enterprise Lifecycle Engine
-- Registry-driven workflow, stage, transition, gate, approval, task, event, and timeline backbone.
-- All financial data is referenced from canonical tables; this layer holds only lifecycle metadata.

-- Workflow definitions registry (metadata + optional override definition)
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_code TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_workflows IS 'Registry of enterprise lifecycle workflow definitions per entity type.';

CREATE INDEX IF NOT EXISTS idx_el_workflows_code ON public.enterprise_lifecycle_workflows(workflow_code);
CREATE INDEX IF NOT EXISTS idx_el_workflows_entity_type ON public.enterprise_lifecycle_workflows(entity_type);
CREATE INDEX IF NOT EXISTS idx_el_workflows_status ON public.enterprise_lifecycle_workflows(status);

DROP TRIGGER IF EXISTS enterprise_lifecycle_workflows_updated_at ON public.enterprise_lifecycle_workflows;
CREATE TRIGGER enterprise_lifecycle_workflows_updated_at
  BEFORE UPDATE ON public.enterprise_lifecycle_workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reusable stage metadata registry
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  name_en TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_stages IS 'Reusable stage metadata used by lifecycle workflows.';

CREATE INDEX IF NOT EXISTS idx_el_stages_code ON public.enterprise_lifecycle_stages(stage_code);
CREATE INDEX IF NOT EXISTS idx_el_stages_category ON public.enterprise_lifecycle_stages(category);
CREATE INDEX IF NOT EXISTS idx_el_stages_status ON public.enterprise_lifecycle_stages(status);

DROP TRIGGER IF EXISTS enterprise_lifecycle_stages_updated_at ON public.enterprise_lifecycle_stages;
CREATE TRIGGER enterprise_lifecycle_stages_updated_at
  BEFORE UPDATE ON public.enterprise_lifecycle_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lifecycle instance per entity (project, asset, report, etc.)
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  workflow_code TEXT NOT NULL REFERENCES public.enterprise_lifecycle_workflows(workflow_code),
  current_stage TEXT NOT NULL,
  previous_stage TEXT,
  context JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_instances IS 'State-machine instance tracking the current stage of an entity.';

CREATE INDEX IF NOT EXISTS idx_el_instances_entity ON public.enterprise_lifecycle_instances(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_el_instances_workflow ON public.enterprise_lifecycle_instances(workflow_code);
CREATE INDEX IF NOT EXISTS idx_el_instances_stage ON public.enterprise_lifecycle_instances(current_stage);
CREATE INDEX IF NOT EXISTS idx_el_instances_status ON public.enterprise_lifecycle_instances(status);

DROP TRIGGER IF EXISTS enterprise_lifecycle_instances_updated_at ON public.enterprise_lifecycle_instances;
CREATE TRIGGER enterprise_lifecycle_instances_updated_at
  BEFORE UPDATE ON public.enterprise_lifecycle_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Transition audit log with decision checkpoint
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.enterprise_lifecycle_instances(id) ON DELETE CASCADE,
  transition_id TEXT,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  decision_checkpoint JSONB NOT NULL DEFAULT '{}',
  evaluated_gates JSONB NOT NULL DEFAULT '[]',
  evidence JSONB NOT NULL DEFAULT '[]',
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  rolled_back BOOLEAN NOT NULL DEFAULT false,
  rollback_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_transitions IS 'Audit log of every stage transition including evidence and decision checkpoint.';

CREATE INDEX IF NOT EXISTS idx_el_transitions_instance ON public.enterprise_lifecycle_transitions(instance_id);
CREATE INDEX IF NOT EXISTS idx_el_transitions_from_to ON public.enterprise_lifecycle_transitions(from_stage, to_stage);
CREATE INDEX IF NOT EXISTS idx_el_transitions_created_at ON public.enterprise_lifecycle_transitions(created_at);

-- Gate evaluations per transition
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_gate_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_id UUID NOT NULL REFERENCES public.enterprise_lifecycle_transitions(id) ON DELETE CASCADE,
  gate_id TEXT NOT NULL,
  gate_type TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  threshold NUMERIC(5,2),
  evidence JSONB NOT NULL DEFAULT '[]',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_gate_evaluations IS 'Per-gate result attached to a transition attempt.';

CREATE INDEX IF NOT EXISTS idx_el_gate_evaluations_transition ON public.enterprise_lifecycle_gate_evaluations(transition_id);
CREATE INDEX IF NOT EXISTS idx_el_gate_evaluations_gate ON public.enterprise_lifecycle_gate_evaluations(gate_id);

-- Approval framework
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.enterprise_lifecycle_instances(id) ON DELETE CASCADE,
  transition_id TEXT,
  stage_id TEXT,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('single', 'multi', 'sequential', 'parallel', 'committee')),
  approver_roles JSONB NOT NULL DEFAULT '[]',
  min_approvals INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decisions JSONB NOT NULL DEFAULT '[]',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_approvals IS 'Approval requests for transitions or stage gates.';

CREATE INDEX IF NOT EXISTS idx_el_approvals_instance ON public.enterprise_lifecycle_approvals(instance_id);
CREATE INDEX IF NOT EXISTS idx_el_approvals_status ON public.enterprise_lifecycle_approvals(status);

DROP TRIGGER IF EXISTS enterprise_lifecycle_approvals_updated_at ON public.enterprise_lifecycle_approvals;
CREATE TRIGGER enterprise_lifecycle_approvals_updated_at
  BEFORE UPDATE ON public.enterprise_lifecycle_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Task orchestrator
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.enterprise_lifecycle_instances(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  task_code TEXT NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT,
  title_en TEXT,
  owner_role TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  deadline TIMESTAMPTZ,
  dependencies JSONB NOT NULL DEFAULT '[]',
  completion_rules JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed', 'cancelled')),
  evidence JSONB NOT NULL DEFAULT '[]',
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_tasks IS 'Tasks auto-generated when an entity enters a lifecycle stage.';

CREATE INDEX IF NOT EXISTS idx_el_tasks_instance ON public.enterprise_lifecycle_tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_el_tasks_stage ON public.enterprise_lifecycle_tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_el_tasks_status ON public.enterprise_lifecycle_tasks(status);

DROP TRIGGER IF EXISTS enterprise_lifecycle_tasks_updated_at ON public.enterprise_lifecycle_tasks;
CREATE TRIGGER enterprise_lifecycle_tasks_updated_at
  BEFORE UPDATE ON public.enterprise_lifecycle_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Event bus log
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.enterprise_lifecycle_instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_events IS 'Lifecycle event log for subscriptions and side-effects.';

CREATE INDEX IF NOT EXISTS idx_el_events_instance ON public.enterprise_lifecycle_events(instance_id);
CREATE INDEX IF NOT EXISTS idx_el_events_type ON public.enterprise_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_el_events_created_at ON public.enterprise_lifecycle_events(created_at);

-- Unified timeline materialized entries
CREATE TABLE IF NOT EXISTS public.enterprise_lifecycle_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.enterprise_lifecycle_instances(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('transition', 'gate', 'approval', 'task', 'event', 'document', 'decision')),
  reference_table TEXT,
  reference_id UUID,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB NOT NULL DEFAULT '[]',
  confidence_score NUMERIC(5,2),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.enterprise_lifecycle_timeline IS 'Unified timeline of lifecycle, documents, approvals, and decisions.';

CREATE INDEX IF NOT EXISTS idx_el_timeline_instance ON public.enterprise_lifecycle_timeline(instance_id);
CREATE INDEX IF NOT EXISTS idx_el_timeline_type ON public.enterprise_lifecycle_timeline(entry_type);
CREATE INDEX IF NOT EXISTS idx_el_timeline_occurred_at ON public.enterprise_lifecycle_timeline(occurred_at);

-- Seed workflow registry metadata (full definitions live in lib/enterprise-lifecycle/definitions/*.json)
INSERT INTO public.enterprise_lifecycle_workflows (workflow_code, entity_type, version, status, name, description)
VALUES
  ('project-investment-lifecycle', 'project', 1, 'active', 'Project Investment Lifecycle', 'Unified path from investment idea to closed deal and exit.'),
  ('asset-lifecycle', 'asset', 1, 'active', 'Asset Lifecycle', 'Unified path from asset acquisition to disposal.'),
  ('report-certificate-lifecycle', 'report', 1, 'active', 'Report & Certificate Lifecycle', 'Unified path for issuing reports and digital certificates.')
ON CONFLICT (workflow_code) DO NOTHING;

-- Seed reusable stage metadata
INSERT INTO public.enterprise_lifecycle_stages (stage_code, category, name, name_ar, name_en)
VALUES
  ('idea', 'discovery', 'Idea', 'فكرة', 'Idea'),
  ('feasibility', 'analysis', 'Feasibility', 'جدوى', 'Feasibility'),
  ('valuation', 'analysis', 'Valuation', 'تقييم', 'Valuation'),
  ('funding', 'structuring', 'Funding', 'تمويل', 'Funding'),
  ('investment_readiness', 'structuring', 'Investment Readiness', 'جاهزية الاستثمار', 'Investment Readiness'),
  ('investment_memorandum', 'documentation', 'Investment Memorandum', 'مذكرة استثمارية', 'Investment Memorandum'),
  ('ai_review', 'review', 'AI Review', 'مراجعة الذكاء الاصطناعي', 'AI Review'),
  ('investor_matching', 'market', 'Investor Matching', 'مطابقة المستثمر', 'Investor Matching'),
  ('teaser', 'market', 'Teaser', 'نبذة استثمارية', 'Teaser'),
  ('nda', 'legal', 'NDA', 'اتفاقية سرية', 'NDA'),
  ('virtual_data_room', 'legal', 'Virtual Data Room', 'غرفة بيانات افتراضية', 'Virtual Data Room'),
  ('deal_room', 'deal', 'Deal Room', 'غرفة الصفقة', 'Deal Room'),
  ('due_diligence', 'deal', 'Due Diligence', 'عناية مستحقة', 'Due Diligence'),
  ('negotiation', 'deal', 'Negotiation', 'تفاوض', 'Negotiation'),
  ('term_sheet', 'legal', 'Term Sheet', 'ورقة شروط', 'Term Sheet'),
  ('cap_table', 'legal', 'Cap Table', 'جدولة ملكية', 'Cap Table'),
  ('funding_closed', 'execution', 'Funding Closed', 'إغلاق التمويل', 'Funding Closed'),
  ('execution', 'execution', 'Execution', 'تنفيذ', 'Execution'),
  ('monitoring', 'monitoring', 'Monitoring', 'مراقبة', 'Monitoring'),
  ('expansion', 'monitoring', 'Expansion', 'توسع', 'Expansion'),
  ('exit', 'exit', 'Exit', 'تخارج', 'Exit'),
  ('acquisition', 'acquisition', 'Acquisition', 'اكتساب', 'Acquisition'),
  ('operation', 'operation', 'Operation', 'تشغيل', 'Operation'),
  ('maintenance', 'maintenance', 'Maintenance', 'صيانة', 'Maintenance'),
  ('revaluation', 'analysis', 'Revaluation', 'إعادة تقييم', 'Revaluation'),
  ('disposal', 'exit', 'Disposal', 'تصرف', 'Disposal'),
  ('draft', 'documentation', 'Draft', 'مسودة', 'Draft'),
  ('submitted', 'documentation', 'Submitted', 'مُقدَّم', 'Submitted'),
  ('financial_review', 'review', 'Financial Review', 'مراجعة مالية', 'Financial Review'),
  ('technical_review', 'review', 'Technical Review', 'مراجعة فنية', 'Technical Review'),
  ('compliance_review', 'review', 'Compliance Review', 'مراجعة امتثال', 'Compliance Review'),
  ('executive_approval', 'approval', 'Executive Approval', 'اعتماد تنفيذي', 'Executive Approval'),
  ('certified', 'certification', 'Certified', 'معتمد', 'Certified'),
  ('published', 'publication', 'Published', 'منشور', 'Published'),
  ('archived', 'archival', 'Archived', 'مؤرشف', 'Archived')
ON CONFLICT (stage_code) DO NOTHING;

-- Row Level Security
ALTER TABLE public.enterprise_lifecycle_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_lifecycle_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_lifecycle_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_lifecycle_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_lifecycle_gate_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_lifecycle_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_lifecycle_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_lifecycle_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS el_workflows_public ON public.enterprise_lifecycle_workflows;
CREATE POLICY el_workflows_public ON public.enterprise_lifecycle_workflows
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS el_stages_public ON public.enterprise_lifecycle_stages;
CREATE POLICY el_stages_public ON public.enterprise_lifecycle_stages
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS el_instances_own ON public.enterprise_lifecycle_instances;
CREATE POLICY el_instances_own ON public.enterprise_lifecycle_instances
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS el_transitions_own ON public.enterprise_lifecycle_transitions;
CREATE POLICY el_transitions_own ON public.enterprise_lifecycle_transitions
  USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_transitions.instance_id AND i.created_by = auth.uid()
  ));

DROP POLICY IF EXISTS el_gate_evaluations_own ON public.enterprise_lifecycle_gate_evaluations;
CREATE POLICY el_gate_evaluations_own ON public.enterprise_lifecycle_gate_evaluations
  USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_transitions t
    JOIN public.enterprise_lifecycle_instances i ON i.id = t.instance_id
    WHERE t.id = enterprise_lifecycle_gate_evaluations.transition_id AND i.created_by = auth.uid()
  ));

DROP POLICY IF EXISTS el_approvals_own ON public.enterprise_lifecycle_approvals;
CREATE POLICY el_approvals_own ON public.enterprise_lifecycle_approvals
  USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_approvals.instance_id AND i.created_by = auth.uid()
  ));

DROP POLICY IF EXISTS el_tasks_own ON public.enterprise_lifecycle_tasks;
CREATE POLICY el_tasks_own ON public.enterprise_lifecycle_tasks
  USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_tasks.instance_id AND i.created_by = auth.uid()
  ));

DROP POLICY IF EXISTS el_events_own ON public.enterprise_lifecycle_events;
CREATE POLICY el_events_own ON public.enterprise_lifecycle_events
  USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_events.instance_id AND i.created_by = auth.uid()
  ));

DROP POLICY IF EXISTS el_timeline_own ON public.enterprise_lifecycle_timeline;
CREATE POLICY el_timeline_own ON public.enterprise_lifecycle_timeline
  USING (EXISTS (
    SELECT 1 FROM public.enterprise_lifecycle_instances i
    WHERE i.id = enterprise_lifecycle_timeline.instance_id AND i.created_by = auth.uid()
  ));
