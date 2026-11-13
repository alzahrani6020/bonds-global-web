/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { createFakeSupabase } = require('../deals/fake-supabase');
const { ProjectAnalysisAdapter, toAnalysis } = require('../../lib/enterprise-lifecycle/integrations/project-analysis-adapter');

const read = rel => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const instance = { entity_type: 'project', entity_id: PROJECT };

function seed(extra = {}) {
  return createFakeSupabase({
    bonds_projects: [{ id: PROJECT, user_id: OWNER, sector: 'manufacturing', city_id: null, geo_snapshot: {}, metadata: {} }],
    bonds_investment_artifacts: [],
    bonds_investment_opportunities: [],
    cities: [],
    ...extra
  });
}

function artifact(fields) {
  return {
    id: fields.id || 'art-' + Math.random().toString(16).slice(2),
    user_id: OWNER,
    project_id: PROJECT,
    status: 'saved',
    created_at: '2026-11-12T10:00:00Z',
    inputs: {},
    results: {},
    ...fields
  };
}

describe('ProjectAnalysisAdapter', () => {
  test('summarizes feasibility results from the service execution body', () => {
    const analysis = toAnalysis(artifact({
      artifact_type: 'feasibility',
      inputs: { revenue: 1000 },
      results: { executed: true, result: { confidence: 78, metrics: { npv: 50 } } }
    }));
    expect(analysis).toMatchObject({ type: 'feasibility', confidence: 78, metrics: { npv: 50 }, inputs: { revenue: 1000 } });
  });

  test('feeds the latest owned feasibility inputs and the opportunity country to UCP', async () => {
    const sb = seed({
      bonds_investment_artifacts: [
        artifact({ artifact_type: 'feasibility', inputs: { revenue: 1 }, created_at: '2026-11-01T00:00:00Z' }),
        artifact({ artifact_type: 'feasibility', inputs: { revenue: 2 }, created_at: '2026-11-10T00:00:00Z' }),
        artifact({ artifact_type: 'risk', results: { confidence: 64 } })
      ],
      bonds_investment_opportunities: [{ id: 'opp', user_id: OWNER, project_id: PROJECT, country_code: 'sa' }]
    });
    const context = await new ProjectAnalysisAdapter({ supabase: sb }).enrich({ instance, context: {} });
    expect(context.inputs).toEqual({ revenue: 2 });
    expect(context.analysis.risk.confidence).toBe(64);
    expect(context.project).toMatchObject({ id: PROJECT, sector: 'manufacturing', country_code: 'SA' });
  });

  test('ignores artifacts written by another user against this project', async () => {
    const sb = seed({
      bonds_investment_artifacts: [artifact({ artifact_type: 'feasibility', user_id: OTHER, inputs: { revenue: 999 } })],
      bonds_investment_opportunities: [{ id: 'opp', user_id: OWNER, project_id: PROJECT, country_code: 'SA' }]
    });
    const context = await new ProjectAnalysisAdapter({ supabase: sb }).enrich({ instance, context: { keep: true } });
    expect(context).toEqual({ keep: true });
  });

  test('does not trigger UCP for projects without a feasibility study', async () => {
    const sb = seed({ bonds_investment_artifacts: [artifact({ artifact_type: 'risk', results: { confidence: 50 } })] });
    const context = await new ProjectAnalysisAdapter({ supabase: sb }).enrich({ instance, context: {} });
    expect(context.analysis.risk.confidence).toBe(50);
    expect(context.project).toBeUndefined();
    expect(context.inputs).toBeUndefined();
  });

  test('keeps caller inputs and country', async () => {
    const sb = seed({ bonds_investment_artifacts: [artifact({ artifact_type: 'feasibility', inputs: { revenue: 5 } })] });
    const context = await new ProjectAnalysisAdapter({ supabase: sb }).enrich({
      instance,
      context: { inputs: { revenue: 7 }, project: { country_code: 'AE' } }
    });
    expect(context.inputs).toEqual({ revenue: 7 });
    expect(context.project.country_code).toBe('AE');
  });

  test('ignores non-project instances', async () => {
    const sb = seed();
    const context = await new ProjectAnalysisAdapter({ supabase: sb }).enrich({ instance: { entity_type: 'asset', entity_id: PROJECT }, context: { a: 1 } });
    expect(context).toEqual({ a: 1 });
  });

  test('is registered between the deal context and UCP', () => {
    const engine = read('lib/enterprise-lifecycle/lifecycle-engine.js');
    const deal = engine.indexOf('new DealContextAdapter({ supabase })');
    const analysis = engine.indexOf('new ProjectAnalysisAdapter({ supabase })');
    const ucp = engine.indexOf('new UcpAdapter({ supabase })');
    expect(deal).toBeGreaterThan(-1);
    expect(analysis).toBeGreaterThan(deal);
    expect(ucp).toBeGreaterThan(analysis);
  });
});

describe('investment context ownership and readiness', () => {
  test('service executions verify project, deal and opportunity ownership before linking artifacts', () => {
    const services = read('v3/api/services.js');
    expect(services).toContain("const { assertContextOwnership } = require('./investment-context');");
    expect(services).toContain('deal_id:owned.dealId || null');
    expect(services).toContain('opportunity_id:owned.opportunityId || null');
    expect(services).not.toContain('deal_id:body.deal_id || null');
    expect(read('v3/api/investment-context.js')).toContain('module.exports={investmentContextRouter,assertContextOwnership};');
  });

  test('self-assessed readiness never writes the gate table directly', () => {
    const source = read('v3/api/investment-context.js');
    const start = source.indexOf("const score=Number(body.readiness_score);");
    const handler = source.slice(start, source.indexOf('\n}\n', start));
    expect(handler).toContain("assessment:'self_reported'");
    expect(handler).toContain('evaluateReadiness({projectId,supabase})');
    expect(handler).toContain('readiness_score:result.output.readinessScore');
    expect(handler).not.toContain('readiness_score:score,grade,\n    strengths');
  });

  test('database rejects links to records the row owner does not own', () => {
    const sql = read('supabase/migrations/20261112170000_investment_context_link_ownership.sql');
    expect(sql).toContain("raise exception 'PROJECT_NOT_OWNED'");
    expect(sql).toContain("raise exception 'DEAL_NOT_OWNED'");
    expect(sql).toContain("raise exception 'OPPORTUNITY_NOT_OWNED'");
    expect(sql).toContain('on public.asset_valuations');
    expect(sql).toContain('on public.bonds_investment_artifacts');
    expect(sql).not.toMatch(/\b(drop|truncate|delete)\b/i);
  });
});

describe('project command center tools', () => {
  test.each([
    ['v3/project/project-command-center.js', '/my-bonds/workspace/?service=feasibility_studies&project_id=', '/valuation/?project_id='],
    ['en/v3/project/project-command-center.js', '/en/my-bonds/workspace/?service=feasibility_studies&project_id=', '/en/valuation/?project_id=']
  ])('%s links project tools for owners', (file, feasibility, valuation) => {
    const source = read(file);
    expect(source).toContain("if (role !== 'owner' && role !== 'admin') return '';");
    expect(source).toContain(feasibility);
    expect(source).toContain(valuation);
    expect(source).toContain('/v3/project-readiness?project_id=');
    expect(source).toContain('${renderProjectToolsCard(project, role)}');
  });

  test('command center script versions are bumped', () => {
    expect(read('v3/project/index.html')).toContain('/v3/project/project-command-center.js?v=6');
    expect(read('en/v3/project/index.html')).toContain('/en/v3/project/project-command-center.js?v=6');
  });
});


describe('Project workspace context continuity', () => {
  test('project command centers propagate project_id and return_to to tools and deal workspace', () => {
    const ar = read('v3/project/project-command-center.js');
    const en = read('en/v3/project/project-command-center.js');

    expect(ar).toContain("const returnTo = encodeURIComponent(`/v3/project/?id=${id}`)");
    expect(ar).toContain("&return_to=${returnTo}");
    expect(ar).toContain("/my-bonds/deals/?project=");
    expect(ar).toContain("return_to=");

    expect(en).toContain("const returnTo = encodeURIComponent(`/en/v3/project/?id=${id}`)");
    expect(en).toContain("&return_to=${returnTo}");
    expect(en).toContain("/en/my-bonds/deals/?project=");
  });

  test('valuation and readiness expose a safe return route to the originating project', () => {
    const valuationAr = read('valuation/index.html');
    const valuationEn = read('en/valuation/index.html');
    const readiness = read('v3/project-readiness.html');

    for (const page of [valuationAr, valuationEn, readiness]) {
      expect(page).toContain("return_to");
      expect(page).toContain("startsWith('/')");
      expect(page).toContain("!returnTo.startsWith('//')");
    }

    expect(valuationAr).toContain("valuationContextReturn");
    expect(valuationEn).toContain("valuationContextReturn");
    expect(readiness).toContain("readinessContextReturn");
  });

  test('deal workspace preserves explicit project return context', () => {
    const client = read('components/deal-workspace.js');
    expect(client).toContain('function safeReturnTo()');
    expect(client).toContain("params.get('return_to')");
    expect(client).toContain('function renderContextReturn()');
    expect(client).toContain("renderContextReturn();");
    expect(client).toContain("link.id='dealContextReturn'");
  });
});
