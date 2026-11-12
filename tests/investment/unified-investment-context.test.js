/**
 * @jest-environment node
 */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

describe('unified investment context',()=>{
  test('migration is additive and RLS protected',()=>{
    const sql=read('supabase/migrations/20261112160000_unified_investment_context.sql');
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).toContain('create table if not exists public.bonds_investment_opportunities');
    expect(sql).toContain('create table if not exists public.bonds_investment_artifacts');
    expect(sql).toContain('create table if not exists public.bonds_investment_interest_leads');
    expect(sql).toMatch(/asset_valuations[\s\S]*project_id uuid references public\.bonds_projects/i);
    expect(sql).toContain('alter table public.bonds_investment_opportunities enable row level security');
    expect(sql).toContain('alter table public.bonds_investment_artifacts enable row level security');
    expect(sql).toContain('alter table public.bonds_investment_interest_leads enable row level security');
    expect(sql).toContain('revoke all on public.bonds_investment_interest_leads from anon');
  });

  test('v3 router exposes context without a second serverless function',()=>{
    const source=read('v3/api/index.js');
    expect(source).toContain("const { investmentContextRouter } = require('./investment-context');");
    expect(source).toContain("path.startsWith('/investment-context')");
    expect(source).toContain('return await investmentContextRouter(req, res, path, supabase, user);');
  });

  test('API owns opportunity project conversion and artifacts',()=>{
    const source=read('v3/api/investment-context.js');
    expect(source).toContain("from('bonds_investment_opportunities')");
    expect(source).toContain("from('bonds_investment_artifacts')");
    expect(source).toContain("from('investment_readiness_scores')");
    expect(source).toContain("from('bonds_investment_interest_leads')");
    expect(source).toContain("new LifecycleEngine({supabase})");
    expect(source).toContain('CONTEXT_PROJECT_DEAL_MISMATCH');
    expect(source).toContain('geo_snapshot:geoSnapshot');
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

  test('readiness writes to project lifecycle table when project is selected',()=>{
    const page=read('v3/project-readiness.html');
    expect(page).toContain('/api/v3/investment-context/readiness');
    expect(page).toContain('project_id: projectId');
    expect(page).toContain('readiness_score: lastReadiness.score');
    expect(page).toContain('تم حفظ الجاهزية وربطها بالمشروع ودورة حياته');
  });

  test('feasibility and risk carry project context and persist results',()=>{
    const client=read('components/service-request.js');
    const api=read('v3/api/services.js');
    expect(client).toContain("project_id:params.get('project_id')||null");
    expect(client).toContain("deal_id:params.get('deal_id')||null");
    expect(client).toContain("opportunity_id:params.get('opportunity_id')||null");
    expect(api).toContain("serviceCode === 'feasibility_studies'");
    expect(api).toContain("serviceCode === 'risk_analysis'");
    expect(api).toContain("from('bonds_investment_artifacts')");
  });

  test('discovery and analytics use one context runtime',()=>{
    const runtime=read('components/investment-context.js');
    const layout=read('site-layout.js');
    expect(layout).toContain('/components/investment-context.js?v=1');
    expect(runtime).toContain('/api/v3/investment-context/opportunities');
    expect(runtime).toContain('/api/v3/investment-context/artifacts');
    expect(runtime).toContain('/api/v3/projects');
    expect(runtime).toContain('convertOpportunity');
    expect(read('v3/opportunity-bank.html')).toContain('save-opportunity');
    expect(read('v3/scenarios.html')).toContain('BondsInvestmentArtifactSnapshot');
    expect(read('v3/city-comparison.html')).toContain('BondsInvestmentArtifactSnapshot');
    expect(read('v3/investment-map.html')).toContain('BondsInvestmentArtifactSnapshot');
  });

  test('direct investor interest is a governed investment lead',()=>{
    const page=read('investment-opportunities.html');
    expect(page).toContain('/api/v3/investment-context/direct-interest');
    expect(page).not.toContain("fetch('/api/contact'");
  });

  test('F.3 and F.4 remain provided by the canonical deal workspace',()=>{
    const source=read('v3/api/deals.js');
    const adr=read('docs/phase-f/PHASE_F_DEAL_LIFECYCLE_ADR.md');
    expect(source).toContain("child === 'pipeline'");
    expect(source).toContain("child === 'closing'");
    expect(adr).toMatch(/F\.4/i);
  });
});
