/**
 * @jest-environment node
 */
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const { closingGateSummary, normalizeClosingMilestone }=require('../../lib/deals/deal-closing');

describe('unified investment context and closing',()=>{
  test('migration is additive, RLS-protected and links canonical entities',()=>{
    const sql=read('supabase/migrations/20261112150000_investment_context_and_closing.sql');
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).toContain('create table if not exists public.bonds_investment_opportunities');
    expect(sql).toContain('create table if not exists public.bonds_investment_artifacts');
    expect(sql).toContain('create table if not exists public.bonds_deal_closing_conditions');
    expect(sql).toContain('create table if not exists public.bonds_deal_closing_milestones');
    expect(sql).toContain('create table if not exists public.bonds_investment_interest_leads');
    expect(sql).toMatch(/asset_valuations[\s\S]*project_id uuid references public\.bonds_projects/i);
    expect(sql).toContain('alter table public.bonds_investment_opportunities enable row level security');
    expect(sql).toContain('alter table public.bonds_investment_artifacts enable row level security');
    expect(sql).toContain('revoke all on public.bonds_investment_interest_leads from anon');
  });

  test('v3 router exposes authenticated context API under existing function',()=>{
    const source=read('v3/api/index.js');
    expect(source).toContain("const { investmentContextRouter } = require('./investment-context');");
    expect(source).toContain("path.startsWith('/investment-context')");
    expect(source).toContain('return await investmentContextRouter(req, res, path, supabase, user);');
  });

  test('context API owns opportunity -> project conversion and persisted artifacts',()=>{
    const source=read('v3/api/investment-context.js');
    expect(source).toContain("from('bonds_investment_opportunities')");
    expect(source).toContain("from('bonds_investment_artifacts')");
    expect(source).toContain("from('investment_readiness_scores')");
    expect(source).toContain("from('bonds_investment_interest_leads')");
    expect(source).toContain("new LifecycleEngine({supabase})");
    expect(source).toContain('CONTEXT_PROJECT_DEAL_MISMATCH');
  });

  test('valuation UI and lifecycle share project identity',()=>{
    const ui=read('valuation/valuation-ui.js');
    const adapter=read('lib/enterprise-lifecycle/integrations/valuation-adapter.js');
    expect(ui).toContain("const projectId = contextParams.get('project_id') || null");
    expect(ui).toContain('project_id: projectId');
    expect(ui).toContain("artifact_type: 'valuation'");
    expect(adapter).toContain("_fetchProjectAssetValuation({ projectId: instance.entity_id })");
    expect(adapter).toContain(".from('asset_valuations')");
    expect(adapter).toContain(".eq('project_id', projectId)");
  });

  test('readiness is persisted to the canonical project readiness table',()=>{
    const page=read('v3/project-readiness.html');
    expect(page).toContain("/api/v3/investment-context/readiness");
    expect(page).toContain('project_id: projectId');
    expect(page).toContain('readiness_score: lastReadiness.score');
    expect(page).not.toContain("alert('تم حفظ التقييم');\n    }");
  });

  test('feasibility and risk carry project context and persist artifacts',()=>{
    const client=read('components/service-request.js');
    const api=read('v3/api/services.js');
    expect(client).toContain("project_id:params.get('project_id')||null");
    expect(client).toContain("deal_id:params.get('deal_id')||null");
    expect(client).toContain("opportunity_id:params.get('opportunity_id')||null");
    expect(api).toContain("serviceCode === 'feasibility_studies'");
    expect(api).toContain("serviceCode === 'risk_analysis'");
    expect(api).toContain("from('bonds_investment_artifacts')");
  });

  test('investment discovery tools retain or save governed context',()=>{
    const runtime=read('components/investment-context.js');
    expect(runtime).toContain('/api/v3/investment-context/opportunities');
    expect(runtime).toContain('/api/v3/investment-context/artifacts');
    expect(runtime).toContain('/api/v3/projects');
    expect(runtime).toContain('Convert to project');
    expect(read('v3/opportunity-bank.html')).toContain('save-opportunity');
    expect(read('v3/scenarios.html')).toContain('BondsInvestmentArtifactSnapshot');
    expect(read('v3/city-comparison.html')).toContain('BondsInvestmentArtifactSnapshot');
    expect(read('v3/investment-map.html')).toContain('BondsInvestmentArtifactSnapshot');
  });

  test('direct interest is no longer only a generic contact submission',()=>{
    const page=read('investment-opportunities.html');
    expect(page).toContain('/api/v3/investment-context/direct-interest');
    expect(page).not.toContain("fetch('/api/contact'");
  });

  test('closing domain blocks final readiness until all critical evidence exists',()=>{
    expect(closingGateSummary([],[]).ready_to_close).toBe(false);
    const conditions=[
      {is_critical:true,status:'satisfied'},
      {is_critical:false,status:'open'}
    ];
    const milestones=[
      {milestone_type:'term_sheet_signed',status:'confirmed'},
      {milestone_type:'cap_table_approved',status:'confirmed'},
      {milestone_type:'funds_received',status:'confirmed'},
      {milestone_type:'signing_complete',status:'confirmed'}
    ];
    expect(closingGateSummary(conditions,milestones)).toMatchObject({
      critical_open:0,term_sheet_signed:true,cap_table_approved:true,
      funds_received:true,signing_complete:true,ready_to_close:true
    });
    expect(()=>normalizeClosingMilestone({milestone_type:'unknown'})).toThrow('MILESTONE_TYPE_INVALID');
  });

  test('deal API and lifecycle use closing evidence',()=>{
    const api=read('v3/api/deals.js');
    const adapter=read('lib/enterprise-lifecycle/integrations/deal-context-adapter.js');
    expect(api).toContain("child === 'closing'");
    expect(api).toContain('CLOSING_MILESTONE_EVIDENCE_REQUIRED');
    expect(api).toContain('DEAL_CLOSING_NOT_READY');
    expect(adapter).toContain("closingDocuments.term_sheet = { status:'signed' }");
    expect(adapter).toContain("closingDocuments.cap_table = { status:'approved' }");
    expect(adapter).toContain("closingDocuments.funding_confirmation = { status:'confirmed' }");
  });

  test('deal workspace exposes F.3 and F.4 in the same operating surface',()=>{
    const ar=read('my-bonds/deals/index.html');
    const en=read('en/my-bonds/deals/index.html');
    const client=read('components/deal-workspace.js');
    for(const html of [ar,en]){
      expect(html).toContain('dealPipelinePanel');
      expect(html).toContain('dealOffersPanel');
      expect(html).toContain('dealClosingPanel');
      expect(html).toContain('dealClosingConditionForm');
      expect(html).toContain('dealClosingMilestoneForm');
    }
    expect(client).toContain('renderClosingConditions');
    expect(client).toContain('renderClosingMilestones');
    expect(client).toContain('/closing/conditions');
    expect(client).toContain('/closing/milestones');
  });
});
