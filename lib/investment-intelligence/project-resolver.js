/**
 * BONDS Investment Intelligence — Project Context Resolver
 *
 * Loads canonical project data from Supabase and runs it through the UCP
 * bridge so that every investment document is built on platform numbers.
 */

const { createUcpRunner } = require('../orchestrator/ucp-bridge');

function normalizeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchProjectContext(supabase, projectId) {
  if (!supabase) throw new Error('Supabase client is required');
  if (!projectId) throw new Error('projectId is required');

  const { data: project, error: projectError } = await supabase
    .from('bonds_projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (projectError) throw projectError;
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const [assetResult, valuationResult, financingResult, cityResult] = await Promise.all([
    supabase.from('bonds_assets').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('bonds_valuations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('bonds_financing').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).single(),
    project.city_id ? supabase.from('cities').select('*').eq('id', project.city_id).single() : Promise.resolve({ data: null, error: null })
  ]);

  return {
    project,
    asset: assetResult.data || null,
    valuation: valuationResult.data || null,
    financing: financingResult.data || null,
    city: cityResult.data || null
  };
}

function buildUcpInputs(context) {
  const { project, asset, valuation, financing } = context;
  const revenue = normalizeNumber(project.revenue);
  const annualProfit = normalizeNumber(project.annual_profit);
  const capital = normalizeNumber(project.capital);
  const assetValue = normalizeNumber(valuation?.value || asset?.market_value);
  const loanAmount = normalizeNumber(financing?.amount);
  const interestRate = normalizeNumber(financing?.interest_rate);
  const tenorMonths = normalizeNumber(financing?.tenor);

  const inputs = {
    revenue,
    annual_net_cash_flow: annualProfit,
    net_operating_income: annualProfit,
    initial_investment: capital || assetValue,
    asset_value: assetValue,
    loan_amount: loanAmount,
    interest_rate: interestRate,
    loan_term_months: tenorMonths || 60,
    total_debt_service: loanAmount,
    operating_expenses: revenue > annualProfit ? revenue - annualProfit : 0
  };

  return inputs;
}

async function runUcpForProject(context, { requestId, userId } = {}) {
  const { project, city } = context;
  const sector = project.sector || 'company';
  const country = city?.country_code || 'SA';
  const cityCode = city?.code || undefined;
  const inputs = buildUcpInputs(context);

  try {
    const runUcp = createUcpRunner({ requestId, userId, projectId: project.id });
    const ucpResult = await runUcp({
      sector,
      country,
      city: cityCode,
      inputs,
      intent: 'investment'
    });
    return ucpResult;
  } catch (err) {
    console.error('[investment-intelligence] UCP run failed:', err.message);
    return null;
  }
}

async function resolveProjectContext({ projectId, supabase, projectData }) {
  if (projectData) {
    return { ...projectData, ucpResult: projectData.ucpResult || null };
  }
  const context = await fetchProjectContext(supabase, projectId);
  const ucpResult = await runUcpForProject(context, { projectId });
  return { ...context, ucpResult };
}

module.exports = {
  fetchProjectContext,
  buildUcpInputs,
  runUcpForProject,
  resolveProjectContext
};
