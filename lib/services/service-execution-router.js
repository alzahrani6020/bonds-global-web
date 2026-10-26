'use strict';

const { executeCapability } = require('../capabilities/governed-executor');
const { getCapability, getService } = require('../capabilities/bonds-capability-registry');
const { resolveUserGovernanceContext } = require('../capabilities/user-governance-context');
const {
  issueBrokerServiceToken,
  revokeBrokerServiceToken
} = require('../security/service-token-broker');
const { toolById } = require('./service-tool-registry');

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function executionRequest(profile, service, body = {}, context = {}) {
  const values = cleanObject(body.values || body.inputs);
  const requestContext = cleanObject(body.context);
  const sector = String(body.sector || requestContext.sector || 'company').trim() || 'company';
  const activity = body.activity || requestContext.activity || null;
  const country = body.country || body.country_code || requestContext.country || null;
  const city = body.city || requestContext.city || null;
  const language = body.language === 'en' ? 'en' : 'ar';

  return {
    input: body.input || service.name_ar || service.name_en || service.code,
    intent: profile.orchestrator_intent || undefined,
    action: profile.orchestrator_intent || undefined,
    sector,
    activity,
    country,
    city,
    language,
    currency: body.currency || requestContext.currency || 'SAR',
    projectId: body.project_id || requestContext.project_id || null,
    values,
    context: requestContext.decision_context || profile.orchestrator_intent || service.code,
    source: body.source || 'service_execution'
  };
}

async function loadExecutionProfile(supabase, serviceCode) {
  const { data: service, error: serviceError } = await supabase
    .from('service_catalog')
    .select('id,code,name_ar,name_en,category_code,group_code,status,is_active')
    .eq('code', serviceCode)
    .eq('status', 'published')
    .eq('is_active', true)
    .maybeSingle();

  if (serviceError) throw serviceError;
  if (!service) return null;

  const [{ data: profile, error: profileError }, { data: capabilities, error: capabilityError }] = await Promise.all([
    supabase
      .from('service_execution_profiles')
      .select('execution_status,execution_mode,primary_action,orchestrator_intent,tool_id,ai_mode,research_mode,token_mode,assistant_enabled,version,is_active,metadata')
      .eq('service_id', service.id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('service_capability_map')
      .select('capability_code,run_order,is_required')
      .eq('service_id', service.id)
      .order('run_order')
  ]);

  if (profileError || capabilityError) throw profileError || capabilityError;

  return {
    service,
    profile: profile || {
      execution_status: 'request_only',
      execution_mode: 'request_only',
      primary_action: null,
      orchestrator_intent: null,
      tool_id: null,
      ai_mode: 'none',
      research_mode: 'none',
      token_mode: 'as_required',
      assistant_enabled: true,
      version: 1,
      metadata: {}
    },
    capabilities: capabilities || []
  };
}

function capabilityServiceCode(action) {
  const capability = getCapability(action);
  return capability?.serviceCode || null;
}

async function executeGovernedAction({ action, input, req, user, supabase, requestId, runtimeContext = {} }) {
  const capabilityService = getService(capabilityServiceCode(action));

  if (!capabilityService) {
    return {
      ok: false,
      executed: false,
      httpStatus: 422,
      error: { code: 'EXECUTION_SERVICE_NOT_REGISTERED' }
    };
  }

  const authorization = await resolveUserGovernanceContext({
    user,
    service: capabilityService,
    supabase
  });

  if (!authorization.ok) {
    return {
      ok: false,
      executed: false,
      httpStatus: authorization.httpStatus,
      error: { code: authorization.code }
    };
  }

  const headerToken = req.headers['x-bonds-service-token'];
  let serviceToken = typeof headerToken === 'string' && headerToken.trim()
    ? headerToken.trim()
    : null;
  let brokerIssued = false;

  try {
    if (capabilityService.security?.serviceTokenRequired === true && !serviceToken) {
      const issued = await issueBrokerServiceToken({
        audience: capabilityService.serviceCode
      });
      if (!issued.ok) {
        return {
          ok: false,
          executed: false,
          httpStatus: issued.httpStatus || 503,
          error: { code: issued.code || 'TOKEN_BROKER_FAILED' }
        };
      }
      serviceToken = issued.token;
      brokerIssued = true;
    }

    return await executeCapability(action, input, {
      ...runtimeContext,
      ...authorization.context,
      requestId,
      auth: { serviceToken }
    });
  } finally {
    if (brokerIssued && serviceToken) {
      await revokeBrokerServiceToken({ token: serviceToken }).catch(() => null);
    }
  }
}

const FINANCIAL_ENGINE_ACTIONS = new Set([
  'financial_analysis_run',
  'cash_flow_analysis_run',
  'funding_readiness_run',
  'creditworthiness_run',
  'feasibility_run',
  'valuation_run',
  'risk_analysis_run',
  'scenario_forecast_run',
  'debt_schedule_run',
  'covenant_monitoring_run',
  'credit_risk_run',
  'treasury_liquidity_run',
  'profitability_intelligence_run',
  'unit_economics_run',
  'management_reporting_run',
  'consolidation_run',
  'fx_translation_run',
  'planning_budgeting_run'
]);

const ACCOUNTING_REPORT_ACTIONS = new Set([
  'accounting_dimension_cash_flow_statement',
  'accounting_dimension_financial_position',
  'accounting_dimension_income_statement',
  'accounting_dimension_ledger_report',
  'accounting_consolidation_report',
  'accounting_changes_in_equity_statement',
  'accounting_trial_balance_report',
  'accounting_financial_statements_report'
]);

const ACCOUNTING_OPERATION_ACTIONS = new Set([
  'accounting_journal_post',
  'accounting_dimension_create',
  'accounting_dimension_policy_configure',
  'accounting_allocation_rule_configure',
  'accounting_allocation_execute',
  'accounting_year_end_policy_configure',
  'accounting_year_end_close',
  'accounting_year_end_reopen',
  'accounting_period_transition',
  'accounting_asset_create',
  'accounting_collateral_assign',
  'accounting_depreciation_policy_configure',
  'accounting_depreciation_post',
  'accounting_group_configure',
  'accounting_intercompany_link',
  'accounting_cash_account_configure',
  'accounting_cash_flow_policy_configure',
  'accounting_equity_movement_policy_configure'
]);

async function executeService({ req, user, supabase, serviceCode, body = {} }) {
  const resolved = await loadExecutionProfile(supabase, serviceCode);
  if (!resolved) {
    return {
      httpStatus: 404,
      body: { ok: false, executed: false, error: { code: 'SERVICE_NOT_FOUND' } }
    };
  }

  const { service, profile, capabilities } = resolved;
  const language = body.language === 'en' ? 'en' : 'ar';
  const tool = toolById(profile.tool_id, language);

  if (profile.execution_mode !== 'capability_plan' || !profile.primary_action) {
    return {
      httpStatus: 409,
      body: {
        ok: false,
        executed: false,
        service_code: service.code,
        execution_status: profile.execution_status,
        execution_mode: profile.execution_mode,
        tool_id: profile.tool_id || null,
        tool,
        assistant_enabled: profile.assistant_enabled !== false,
        capabilities,
        error: { code: 'SERVICE_EXECUTION_NOT_AUTOMATED' }
      }
    };
  }

  if (!user) {
    return {
      httpStatus: 401,
      body: {
        ok: false,
        executed: false,
        service_code: service.code,
        error: { code: 'AUTHENTICATION_REQUIRED' }
      }
    };
  }

  const requestId = req.headers['x-request-id'] || body.request_id || null;
  const requestedAction = String(body.action || '').trim() || null;
  const mappedActions = new Set((capabilities || []).map(row => row.capability_code).filter(Boolean));
  const executionAction = requestedAction || profile.primary_action;

  if (requestedAction && !mappedActions.has(requestedAction)) {
    return {
      httpStatus: 403,
      body: {
        ok: false,
        executed: false,
        service_code: service.code,
        error: { code: 'SERVICE_ACTION_NOT_MAPPED' }
      }
    };
  }

  let capabilityInput;

  if (executionAction === 'orchestrator_run') {
    const request = executionRequest(profile, service, body, { requestId });
    capabilityInput = { request };
  } else if (executionAction === 'calculator_open') {
    if (!tool?.assistant_calculator) {
      return {
        httpStatus: 422,
        body: {
          ok: false,
          executed: false,
          service_code: service.code,
          tool_id: profile.tool_id || null,
          tool,
          error: { code: 'SERVICE_CALCULATOR_NOT_REGISTERED' }
        }
      };
    }
    capabilityInput = {
      calculator: tool.assistant_calculator,
      language
    };
  } else if (executionAction === 'calculator_run') {
    if (!tool?.assistant_calculator) {
      return {
        httpStatus: 422,
        body: {
          ok: false,
          executed: false,
          service_code: service.code,
          tool_id: profile.tool_id || null,
          tool,
          error: { code: 'SERVICE_CALCULATOR_NOT_REGISTERED' }
        }
      };
    }
    capabilityInput = {
      calculator: tool.assistant_calculator,
      inputs: cleanObject(body.inputs || body.values),
      scenario_codes: Array.isArray(body.scenario_codes) ? body.scenario_codes : undefined,
      context: cleanObject(body.context),
      project_id: body.project_id || body.context?.project_id || null
    };
  } else if (FINANCIAL_ENGINE_ACTIONS.has(executionAction)) {
    capabilityInput = {
      inputs: cleanObject(body.inputs || body.values),
      service_code: service.code
    };
  } else if (ACCOUNTING_REPORT_ACTIONS.has(executionAction)) {
    capabilityInput = cleanObject(body.inputs || body.values);
  } else if (ACCOUNTING_OPERATION_ACTIONS.has(executionAction)) {
    capabilityInput = cleanObject(body.inputs || body.values);
  } else {
    return {
      httpStatus: 422,
      body: {
        ok: false,
        executed: false,
        service_code: service.code,
        error: { code: 'SERVICE_EXECUTION_ACTION_UNSUPPORTED' }
      }
    };
  }

  const result = await executeGovernedAction({
    action: executionAction,
    input: capabilityInput,
    req,
    user,
    supabase,
    requestId
  });

  return {
    httpStatus: result.ok ? 200 : (result.httpStatus || 422),
    body: {
      service_code: service.code,
      execution_status: profile.execution_status,
      execution_mode: profile.execution_mode,
      orchestrator_intent: profile.orchestrator_intent,
      tool_id: profile.tool_id || null,
      tool,
      ai_mode: profile.ai_mode,
      research_mode: profile.research_mode,
      token_mode: profile.token_mode,
      capabilities,
      ...result
    }
  };
}

module.exports = {
  capabilityServiceCode,
  loadExecutionProfile,
  executionRequest,
  executeGovernedAction,
  executeService
};
