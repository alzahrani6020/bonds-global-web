'use strict';

const { fetchUrl, crawl } =
  require('../intelligence/web-acquisition');

const { searchWeb } =
  require('../intelligence/web-search');

const { extractContent } =
  require('../intelligence/content-extraction');

const {
  verifyEvidence,
  synthesizeResearch
} = require('../intelligence/research-intelligence');

const {
  getInferenceRouter
} = require('../ai/inference-router');

const {
  resolveNavigation,
  resolveForm
} = require('../assistant/protocol');

const assistantFormRegistry =
  require('../assistant/form-registry.json');

const assistantCalculatorRegistry =
  require('../assistant/calculator-registry.json');

const { UniversalCalculationPlatform } =
  require('../ucp');

const { runFinancialEngine } =
  require('../finance/financial-engine-registry');

const {
  SupabasePeriodCloseStore
} = require('../finance/accounting/supabase-period-close-store');

const {
  SupabaseAccountingDimensionStore
} = require('../finance/accounting/supabase-accounting-dimension-store');

const {
  SupabaseAccountingDimensionPolicyStore
} = require('../finance/accounting/supabase-accounting-dimension-policy-store');

const {
  SupabaseAccountingAllocationStore
} = require('../finance/accounting/supabase-accounting-allocation-store');

const {
  SupabaseAccountingReportStore
} = require('../finance/accounting/supabase-accounting-report-store');

const {
  SupabaseAccountingYearEndStore
} = require('../finance/accounting/supabase-accounting-year-end-store');

const {
  SupabaseAssetCollateralStore
} = require('../finance/accounting/supabase-asset-collateral-store');

const {
  SupabaseFixedAssetDepreciationStore
} = require('../finance/accounting/supabase-fixed-asset-depreciation-store');

const { EvidenceGraphEngine } =
  require('../decision-os/evidence-graph-engine');

const { EventMonitorEngine } =
  require('../decision-os/event-monitor-engine');

const { BlindSpotEngine } =
  require('../enterprise-intelligence/blind-spot-engine');

const { DecisionGraphEngine } =
  require('../enterprise-intelligence/decision-graph-engine');

const { RecommendationSynthesizer } =
  require('../enterprise-intelligence/recommendation-synthesizer');

const {
  classifyMedia
} = require('../media/file-policy-registry');

const {
  detectLanguage
} = require('../media/language-engine');

const {
  analyzeOwnedDocument
} = require('../assistant/document-processing');

const {
  scanOwnedDocument
} = require('../security/file-security');


function publicNetworkInput(input = {}) {
  return {
    ...input,
    allowPrivateNetworks: false,
    allow_private_networks: false
  };
}

function publicFetchOptions(options = {}) {
  return {
    ...options,
    allowPrivateNetworks: false
  };
}

function assistantFailure(code, httpStatus = 404) {
  return {
    ok: false,
    executed: false,
    httpStatus,
    error: { code }
  };
}

function assistantDatabase() {
  return require('../../v3/lib/supabase').getSupabaseClient();
}

function assistantUserReady(context = {}) {
  return typeof context.userId === 'string' &&
    context.userId &&
    context.actor?.id === context.userId;
}

async function accountingMembership(context = {}, accountingEntityId, allowedRoles = []) {
  if (!assistantUserReady(context)) {
    return { ok:false, response:assistantFailure('USER_GOVERNANCE_UNAVAILABLE', 503) };
  }
  const entityId = String(accountingEntityId || '').trim();
  if (!entityId) {
    return { ok:false, response:assistantFailure('ACCOUNTING_ENTITY_REQUIRED', 400) };
  }

  const db = assistantDatabase();
  const { data, error } = await db
    .from('accounting_entity_members')
    .select('accounting_entity_id,user_id,role,status')
    .eq('accounting_entity_id', entityId)
    .eq('user_id', context.userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    return { ok:false, response:assistantFailure('ACCOUNTING_ENTITY_MEMBERSHIP_READ_FAILED', 503) };
  }
  if (!data) {
    return { ok:false, response:assistantFailure('ACCOUNTING_ENTITY_ACCESS_DENIED', 403) };
  }
  if (allowedRoles.length && !allowedRoles.includes(data.role)) {
    return { ok:false, response:assistantFailure('ACCOUNTING_ENTITY_ROLE_FORBIDDEN', 403) };
  }
  return { ok:true, role:data.role, entityId, db };
}

function accountingInput(input = {}) {
  return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

function assistantCalculator(code) {
  const key = String(code || '').trim();
  const entry = assistantCalculatorRegistry.calculators?.[key];
  return entry ? { key, ...entry } : null;
}

function formForRequirement(requirementCode) {
  for (const [key, form] of Object.entries(assistantFormRegistry.forms || {})) {
    if (form.funding_requirement === requirementCode) {
      return { key, ...form };
    }
  }
  return null;
}

async function loadFundingState(input = {}, context = {}) {
  if (!assistantUserReady(context)) {
    return assistantFailure('USER_GOVERNANCE_UNAVAILABLE', 503);
  }

  const caseId = String(input.case_id || '').trim();
  if (!caseId) return assistantFailure('CASE_ID_REQUIRED', 400);

  const db = assistantDatabase();
  const { data: fundingCase, error: caseError } = await db
    .from('funding_cases')
    .select('id,case_reference,status,project_id,user_id,next_action_at,amount,financing_type,updated_at')
    .eq('id', caseId)
    .eq('user_id', context.userId)
    .maybeSingle();

  if (caseError) return assistantFailure('FUNDING_CASE_READ_FAILED', 503);
  if (!fundingCase) return assistantFailure('FUNDING_CASE_NOT_FOUND', 404);

  const [stagesResult, requirementsResult, submissionsResult] = await Promise.all([
    db.from('funding_file_stages')
      .select('id,code,label_ar,label_en,sort_order')
      .eq('is_active', true),
    db.from('funding_file_requirements')
      .select('id,code,stage_id,label_ar,label_en,data_scope,sort_order,is_required,completion_statuses')
      .eq('is_active', true),
    db.from('funding_case_submissions')
      .select('requirement_id,status,submitted_at,source_record_id,updated_at')
      .eq('case_id', caseId)
  ]);

  if (stagesResult.error || requirementsResult.error || submissionsResult.error) {
    return assistantFailure('FUNDING_REQUIREMENTS_READ_FAILED', 503);
  }

  const stageById = new Map((stagesResult.data || []).map(stage => [stage.id, stage]));
  const submissionByRequirement = new Map(
    (submissionsResult.data || []).map(row => [row.requirement_id, row])
  );

  const requirements = (requirementsResult.data || []).map(requirement => {
    const stage = stageById.get(requirement.stage_id) || null;
    const submission = submissionByRequirement.get(requirement.id) || null;
    const completionStatuses = Array.isArray(requirement.completion_statuses)
      ? requirement.completion_statuses
      : [];
    const completed = !!submission && completionStatuses.includes(submission.status);
    const form = formForRequirement(requirement.code);
    const navigation = form
      ? resolveNavigation(form.navigation_target, input.language === 'en' ? 'en' : 'ar')
      : null;

    return {
      code: requirement.code,
      label_ar: requirement.label_ar,
      label_en: requirement.label_en,
      data_scope: requirement.data_scope,
      required: requirement.is_required === true,
      stage: stage ? {
        code: stage.code,
        label_ar: stage.label_ar,
        label_en: stage.label_en,
        sort_order: stage.sort_order
      } : null,
      sort_order: requirement.sort_order,
      completed,
      status: submission?.status || 'missing',
      submitted_at: submission?.submitted_at || null,
      source_record_id: submission?.source_record_id || null,
      form: form?.key || null,
      navigation_target: navigation?.key || null,
      route: navigation?.route || null
    };
  }).sort((a, b) =>
    ((a.stage?.sort_order ?? 9999) - (b.stage?.sort_order ?? 9999)) ||
    ((a.sort_order ?? 9999) - (b.sort_order ?? 9999))
  );

  const completed = requirements.filter(item => item.completed);
  const missing = requirements.filter(item => item.required && !item.completed);
  const next = missing[0] || null;

  return {
    ok: true,
    executed: true,
    result: {
      case: {
        id: fundingCase.id,
        case_reference: fundingCase.case_reference,
        status: fundingCase.status,
        project_id: fundingCase.project_id,
        amount: fundingCase.amount,
        financing_type: fundingCase.financing_type,
        next_action_at: fundingCase.next_action_at,
        updated_at: fundingCase.updated_at
      },
      requirements,
      completed,
      missing,
      next
    }
  };
}


const RUNTIME_ADAPTERS = Object.freeze({

  assistant_site_navigate: async (input) => {
    const navigation = resolveNavigation(
      input.target,
      input.language === 'en' ? 'en' : 'ar'
    );
    if (!navigation) return assistantFailure('NAVIGATION_TARGET_NOT_REGISTERED', 404);
    return {
      ok: true,
      executed: true,
      result: {
        target: navigation.key,
        route: navigation.route,
        kind: navigation.kind,
        auth_required: navigation.auth_required === true
      }
    };
  },

  assistant_form_find: async (input) => {
    const form = resolveForm(input.form);
    if (!form) return assistantFailure('FORM_NOT_REGISTERED', 404);
    return {
      ok: true,
      executed: true,
      result: {
        form: form.key,
        navigation_target: form.navigation_target,
        funding_requirement: form.funding_requirement,
        data_scope: form.data_scope
      }
    };
  },

  assistant_form_load: async (input) => {
    const form = resolveForm(input.form);
    if (!form) return assistantFailure('FORM_NOT_REGISTERED', 404);
    const navigation = resolveNavigation(
      form.navigation_target,
      input.language === 'en' ? 'en' : 'ar'
    );
    if (!navigation) return assistantFailure('FORM_NAVIGATION_NOT_REGISTERED', 503);
    return {
      ok: true,
      executed: true,
      result: {
        form: form.key,
        metadata: form,
        navigation: {
          target: navigation.key,
          route: navigation.route
        }
      }
    };
  },

  assistant_media_classify: async (input) => ({
    ok: true,
    executed: true,
    result: classifyMedia({
      name: input.name,
      size: input.size,
      type: input.type
    })
  }),

  assistant_language_detect: async (input) => ({
    ok: true,
    executed: true,
    result: detectLanguage(input.text)
  }),

  assistant_file_security_scan: async (input, context = {}) => {
    if (!assistantUserReady(context)) {
      return assistantFailure('USER_GOVERNANCE_UNAVAILABLE', 503);
    }
    try {
      const result = await scanOwnedDocument({
        db:assistantDatabase(),
        userId:context.userId,
        documentId:input.document_id
      });
      if (!result) return assistantFailure('DOCUMENT_NOT_FOUND', 404);
      return { ok:true, executed:true, result };
    } catch (error) {
      const code = String(error?.code || error?.message || 'FILE_SECURITY_SCAN_FAILED');
      const status = Number(error?.httpStatus) || 503;
      return assistantFailure(code, status);
    }
  },

  assistant_document_analyze: async (input, context = {}) => {
    if (!assistantUserReady(context)) {
      return assistantFailure('USER_GOVERNANCE_UNAVAILABLE', 503);
    }
    try {
      const result = await analyzeOwnedDocument({
        supabase: assistantDatabase(),
        userId: context.userId,
        documentId: input.document_id
      });
      if (!result) return assistantFailure('DOCUMENT_NOT_FOUND', 404);
      return { ok:true, executed:true, result };
    } catch (error) {
      const code = String(error?.message || 'DOCUMENT_ANALYSIS_FAILED');
      const clientErrors = new Set(['DOCUMENT_ID_REQUIRED','DOCUMENT_USER_REQUIRED','DOCUMENT_NOT_FOUND']);
      return assistantFailure(clientErrors.has(code) ? code : 'DOCUMENT_ANALYSIS_FAILED',
        clientErrors.has(code) ? 400 : 503);
    }
  },

  assistant_funding_status: async (input, context) =>
    loadFundingState(input, context),

  assistant_funding_next_step: async (input, context) => {
    const state = await loadFundingState(input, context);
    if (!state.ok) return state;
    return {
      ok: true,
      executed: true,
      result: {
        case: state.result.case,
        next: state.result.next,
        completed_count: state.result.completed.length,
        missing_count: state.result.missing.length
      }
    };
  },

  assistant_funding_next_requirements: async (input, context) => {
    const state = await loadFundingState(input, context);
    if (!state.ok) return state;
    return {
      ok: true,
      executed: true,
      result: {
        case: state.result.case,
        completed: state.result.completed,
        missing: state.result.missing,
        next: state.result.next
      }
    };
  },

  assistant_calculator_open: async (input) => {
    const calculator = assistantCalculator(input.calculator);
    if (!calculator) return assistantFailure('CALCULATOR_NOT_REGISTERED', 404);

    const navigation = resolveNavigation(
      calculator.navigation_target,
      input.language === 'en' ? 'en' : 'ar'
    );
    if (!navigation) return assistantFailure('CALCULATOR_NAVIGATION_NOT_REGISTERED', 503);

    return {
      ok: true,
      executed: true,
      result: {
        calculator: calculator.key,
        runnable: calculator.runnable === true,
        engine: calculator.engine,
        navigation: {
          target: navigation.key,
          route: navigation.route
        }
      }
    };
  },

  assistant_calculator_run: async (input, context = {}) => {
    const calculator = assistantCalculator(input.calculator);
    if (!calculator) return assistantFailure('CALCULATOR_NOT_REGISTERED', 404);
    if (calculator.runnable !== true || calculator.engine !== 'ucp' || !calculator.template_code) {
      return assistantFailure('CALCULATOR_NOT_RUNNABLE', 422);
    }
    if (!input.inputs || typeof input.inputs !== 'object' || Array.isArray(input.inputs)) {
      return assistantFailure('CALCULATOR_INPUTS_INVALID', 400);
    }

    try {
      const ucp = await UniversalCalculationPlatform.create({ preferStatic: true });
      const result = await ucp.calculate({
        templateCode: calculator.template_code,
        inputs: input.inputs,
        scenarioCodes: Array.isArray(input.scenario_codes) && input.scenario_codes.length
          ? input.scenario_codes
          : ['scn_expected'],
        context: input.context && typeof input.context === 'object' && !Array.isArray(input.context)
          ? input.context
          : {},
        requestId: context.requestId || null,
        userId: context.userId || null,
        projectId: input.project_id || null
      });
      return {
        ok: true,
        executed: true,
        result: {
          calculator: calculator.key,
          engine: 'ucp',
          template_code: calculator.template_code,
          calculation: result
        }
      };
    } catch (error) {
      return {
        ok: false,
        executed: false,
        httpStatus: 422,
        error: {
          code: 'CALCULATION_FAILED',
          message: error?.message || 'Calculation failed'
        }
      };
    }
  },

  accounting_dimension_create: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAccountingDimensionStore(membership.db);
      const dimension = await store.createDimension({
        accountingEntityId:membership.entityId,
        dimensionType:payload.dimension_type,
        code:payload.code,
        name:payload.name,
        parentId:payload.parent_id || null,
        status:payload.status || 'active',
        metadata:payload.metadata || {},
        createdBy:context.userId
      });
      return { ok:true, executed:true, result:{ dimension } };
    } catch (error) {
      return assistantFailure(String(error?.message || 'ACCOUNTING_DIMENSION_CREATE_FAILED'), 422);
    }
  },

  accounting_dimension_policy_configure: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAccountingDimensionPolicyStore(membership.db);
      const policy = await store.configurePolicy({
        accountingEntityId:membership.entityId,
        accountId:payload.account_id,
        dimensionType:payload.dimension_type,
        required:payload.required,
        status:payload.status || 'active',
        metadata:payload.metadata || {},
        configuredBy:context.userId
      });
      return { ok:true, executed:true, result:{ policy } };
    } catch (error) {
      return assistantFailure(String(
        error?.message || 'ACCOUNTING_DIMENSION_POLICY_SAVE_FAILED'
      ), 422);
    }
  },

  accounting_allocation_rule_configure: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAccountingAllocationStore(membership.db);
      const result = await store.configureRule({
        accountingEntityId:membership.entityId,
        ruleCode:payload.rule_code,
        name:payload.name,
        sourceAccountId:payload.source_account_id,
        sourceDimensions:payload.source_dimensions || {},
        targets:payload.targets,
        status:payload.status || 'active',
        actorId:context.userId,
        metadata:payload.metadata || {}
      });
      return { ok:true, executed:true, result };
    } catch (error) {
      return assistantFailure(String(
        error?.message || 'ACCOUNTING_ALLOCATION_RULE_SAVE_FAILED'
      ), 422);
    }
  },

  accounting_allocation_execute: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAccountingAllocationStore(membership.db);
      const result = await store.executeRule({
        accountingEntityId:membership.entityId,
        ruleId:payload.rule_id,
        amount:payload.amount,
        effectiveAt:payload.effective_at,
        requestKey:payload.request_key,
        actorId:context.userId
      });
      return { ok:true, executed:true, result };
    } catch (error) {
      return assistantFailure(String(
        error?.message || 'ACCOUNTING_ALLOCATION_EXECUTION_FAILED'
      ), 422);
    }
  },

  accounting_year_end_policy_configure: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAccountingYearEndStore(membership.db);
      const result = await store.configurePolicy({
        accountingEntityId:membership.entityId,
        retainedEarningsAccountId:payload.retained_earnings_account_id,
        retainedDimensions:payload.retained_dimensions || {},
        fiscalYearEndMonth:payload.fiscal_year_end_month,
        fiscalYearEndDay:payload.fiscal_year_end_day,
        status:payload.status || 'active',
        actorId:context.userId,
        metadata:payload.metadata || {}
      });
      return { ok:true, executed:true, result };
    } catch (error) {
      return assistantFailure(String(
        error?.message || 'ACCOUNTING_YEAR_END_POLICY_SAVE_FAILED'
      ), 422);
    }
  },

  accounting_year_end_close: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAccountingYearEndStore(membership.db);
      const result = await store.closeYear({
        accountingEntityId:membership.entityId,
        fiscalYearStart:payload.fiscal_year_start,
        fiscalYearEnd:payload.fiscal_year_end,
        closingPeriodId:payload.closing_period_id,
        requestKey:payload.request_key,
        actorId:context.userId
      });
      return { ok:true, executed:true, result };
    } catch (error) {
      return assistantFailure(String(
        error?.message || 'ACCOUNTING_YEAR_END_CLOSE_FAILED'
      ), 422);
    }
  },

  accounting_year_end_reopen: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAccountingYearEndStore(membership.db);
      const result = await store.reopenYear({
        accountingEntityId:membership.entityId,
        closeRunId:payload.close_run_id,
        requestKey:payload.request_key,
        reason:payload.reason,
        actorId:context.userId
      });
      return { ok:true, executed:true, result };
    } catch (error) {
      return assistantFailure(String(
        error?.message || 'ACCOUNTING_YEAR_END_REOPEN_FAILED'
      ), 422);
    }
  },

  accounting_dimension_ledger_report: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant','viewer']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAccountingReportStore(membership.db);
      const rows = await store.dimensionLedger({
        accountingEntityId:membership.entityId,
        dimensionType:payload.dimension_type,
        dimensionCode:payload.dimension_code || null,
        from:payload.from || null,
        to:payload.to || null
      });
      return { ok:true, executed:true, result:{ rows } };
    } catch (error) {
      return assistantFailure(String(
        error?.message || 'ACCOUNTING_DIMENSION_REPORT_FAILED'
      ), 422);
    }
  },

  accounting_period_transition: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabasePeriodCloseStore(membership.db);
      const result = await store.transition({
        accountingEntityId:membership.entityId,
        periodId:payload.period_id,
        action:payload.transition,
        actorUserId:context.userId,
        reason:payload.reason || null,
        metadata:payload.metadata || {}
      });
      return { ok:true, executed:true, result };
    } catch (error) {
      return assistantFailure(String(error?.message || 'ACCOUNTING_PERIOD_TRANSITION_FAILED'), 422);
    }
  },

  accounting_asset_create: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAssetCollateralStore(membership.db);
      const asset = await store.createAsset({
        accountingEntityId:membership.entityId,
        assetNumber:payload.asset_number,
        assetClass:payload.asset_class,
        assetType:payload.asset_type || null,
        projectId:payload.project_id || null,
        location:payload.location || null,
        area:payload.area,
        marketValue:payload.market_value,
        acquisitionDate:payload.acquisition_date || null,
        acquisitionCost:payload.acquisition_cost,
        currency:payload.currency || 'SAR',
        usefulLifeMonths:payload.useful_life_months,
        residualValue:payload.residual_value,
        lifecycleStatus:payload.lifecycle_status || 'active',
        metadata:payload.metadata || {}
      });
      return { ok:true, executed:true, result:{ asset } };
    } catch (error) {
      return assistantFailure(String(error?.message || 'ASSET_CREATE_FAILED'), 422);
    }
  },

  accounting_collateral_assign: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseAssetCollateralStore(membership.db);
      const collateral = await store.assignCollateral({
        accountingEntityId:membership.entityId,
        assetId:payload.asset_id,
        status:payload.status || 'proposed',
        securedAmount:payload.secured_amount,
        collateralValue:payload.collateral_value,
        currency:payload.currency || 'SAR',
        priority:payload.priority,
        lienHolder:payload.lien_holder || null,
        agreementReference:payload.agreement_reference || null,
        validFrom:payload.valid_from || null,
        validTo:payload.valid_to || null,
        metadata:payload.metadata || {},
        createdBy:context.userId
      });
      return { ok:true, executed:true, result:{ collateral } };
    } catch (error) {
      return assistantFailure(String(error?.message || 'COLLATERAL_ASSIGNMENT_FAILED'), 422);
    }
  },

  accounting_depreciation_policy_configure: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseFixedAssetDepreciationStore(membership.db);
      const policy = await store.configurePolicy({
        accountingEntityId:membership.entityId,
        assetId:payload.asset_id,
        inServiceDate:payload.in_service_date,
        depreciationExpenseAccountId:payload.depreciation_expense_account_id,
        accumulatedDepreciationAccountId:payload.accumulated_depreciation_account_id,
        depreciationMethod:payload.depreciation_method || 'straight_line',
        prorationMethod:payload.proration_method || 'daily_actual',
        status:payload.status || 'active',
        metadata:payload.metadata || {},
        createdBy:context.userId
      });
      return { ok:true, executed:true, result:{ policy } };
    } catch (error) {
      return assistantFailure(String(error?.message || 'DEPRECIATION_POLICY_SAVE_FAILED'), 422);
    }
  },

  accounting_depreciation_post: async (input, context = {}) => {
    const payload = accountingInput(input);
    const membership = await accountingMembership(
      context,
      payload.accounting_entity_id,
      ['owner','admin','accountant']
    );
    if (!membership.ok) return membership.response;

    try {
      const store = new SupabaseFixedAssetDepreciationStore(membership.db);
      const result = await store.postPeriod({
        accountingEntityId:membership.entityId,
        assetId:payload.asset_id,
        periodId:payload.period_id
      });
      return { ok:true, executed:true, result };
    } catch (error) {
      return assistantFailure(String(error?.message || 'DEPRECIATION_POST_FAILED'), 422);
    }
  },

  financial_analysis_engine: async (input) => ({
    ...runFinancialEngine(
      'financial_analysis',
      input.inputs || input,
      { serviceCode: input.service_code || null }
    )
  }),

  cash_flow_analysis_engine: async (input) => ({
    ...runFinancialEngine(
      'cash_flow_analysis',
      input.inputs || input,
      { serviceCode: input.service_code || null }
    )
  }),

  funding_readiness_engine: async (input) => ({
    ...runFinancialEngine('funding_readiness', input.inputs || input)
  }),

  creditworthiness_engine: async (input) => ({
    ...runFinancialEngine('creditworthiness', input.inputs || input)
  }),

  feasibility_engine: async (input) => ({
    ...runFinancialEngine('feasibility', input.inputs || input)
  }),

  valuation_engine: async (input) => ({
    ...runFinancialEngine('valuation', input.inputs || input)
  }),

  risk_analysis_engine: async (input) => ({
    ...runFinancialEngine(
      'risk_analysis',
      input.inputs || input,
      { serviceCode: input.service_code || null }
    )
  }),

  scenario_forecast_engine: async (input) => ({
    ...runFinancialEngine(
      'scenario_forecast',
      input.inputs || input,
      { serviceCode: input.service_code || null }
    )
  }),

  debt_schedule_engine: async (input) => ({
    ...runFinancialEngine('debt_schedule', input.inputs || input)
  }),

  covenant_monitoring_engine: async (input) => ({
    ...runFinancialEngine('covenant_monitoring', input.inputs || input)
  }),

  credit_risk_engine: async (input) => ({
    ...runFinancialEngine('credit_risk', input.inputs || input)
  }),

  treasury_liquidity_engine: async (input) => ({
    ...runFinancialEngine('treasury_liquidity', input.inputs || input)
  }),

  profitability_intelligence_engine: async (input) => ({
    ...runFinancialEngine('profitability_intelligence', input.inputs || input)
  }),

  unit_economics_engine: async (input) => ({
    ...runFinancialEngine('unit_economics', input.inputs || input)
  }),

  assistant_project_status: async (input, context) => {
    if (!assistantUserReady(context)) {
      return assistantFailure('USER_GOVERNANCE_UNAVAILABLE', 503);
    }
    const projectId = String(input.project_id || '').trim();
    if (!projectId) return assistantFailure('PROJECT_ID_REQUIRED', 400);
    const db = assistantDatabase();
    const { data, error } = await db
      .from('bonds_projects')
      .select('id,name,project_number,sector,sub_sector,activity,currency,status,capital,revenue,annual_profit,language,metadata,created_at,updated_at')
      .eq('id', projectId)
      .eq('user_id', context.userId)
      .maybeSingle();

    if (error) return assistantFailure('PROJECT_READ_FAILED', 503);
    if (!data) return assistantFailure('PROJECT_NOT_FOUND', 404);
    return { ok:true, executed:true, result:{ project:data } };
  },

  web_search: async (input) =>
    searchWeb(input.query, {
      limit: input.limit,
      timeoutMs: input.timeoutMs,
      language: input.language,
      categories: input.categories,
      engines: input.engines,
      safeSearch: input.safeSearch,
      timeRange: input.timeRange,
      disabledProviders: input.disabledProviders
    }),


  web_fetch: async (input) => {
    const result = await fetchUrl(
      input.url,
      publicFetchOptions(input.options)
    );

    return {
      ok: result.ok,
      executed: result.executed,
      evidence: {
        fetch: result.evidence
      },
      result: {
        text: result.text,
        content_type: result.evidence.content_type
      }
    };
  },


  web_crawl: async (input) => {
    const result = await crawl(
      publicNetworkInput(input)
    );

    return {
      ok: result.pages.length > 0,
      executed: true,
      evidence: {
        coverage: result.coverage
      },
      result: {
        pages: result.pages.map(page => ({
          url: page.url,
          depth: page.depth,
          evidence: page.evidence
        })),
        failures: result.failures
      }
    };
  },


  web_explore: async (input) => {
    const result = await crawl(
      publicNetworkInput(input)
    );

    const pages = [];

    for (const page of result.pages) {
      const extracted = await extractContent(
        page.body,
        page.evidence.content_type
      );

      pages.push({
        url: page.url,
        depth: page.depth,
        evidence: page.evidence,
        extracted
      });
    }

    return {
      ok: pages.length > 0,
      executed: true,
      evidence: {
        coverage: result.coverage,
        content_hashes: pages
          .map(page => page.evidence.content_hash)
          .filter(Boolean)
      },
      result: {
        pages,
        failures: result.failures,
        blocked: result.blocked
      }
    };
  },


  evidence_verify: async (input) =>
    verifyEvidence(input),


  research_synthesize: async (input) =>
    synthesizeResearch(input),


  research_intelligence_verify: async (input) =>
    verifyEvidence(input),


  research_intelligence_synthesize: async (input) =>
    synthesizeResearch(input),


  evidence_graph_analyze: async (input) => ({
    ok: true,
    executed: true,
    result: new EvidenceGraphEngine().build(
      input && typeof input === 'object' ? input : {}
    )
  }),


  blind_spot_analyze: async (input) => ({
    ok: true,
    executed: true,
    result: new BlindSpotEngine(
      input && typeof input === 'object' ? input : {}
    ).analyze()
  }),


  decision_graph_build: async (input) => ({
    ok: true,
    executed: true,
    result: new DecisionGraphEngine(
      input && typeof input === 'object' ? input : {}
    ).build()
  }),


  recommendation_synthesize: async (input) => ({
    ok: true,
    executed: true,
    result: new RecommendationSynthesizer(
      input && typeof input === 'object' ? input : {}
    ).synthesize()
  }),


  event_monitor_analyze: async (input) => {
    const engine = new EventMonitorEngine({
      supabase: assistantDatabase()
    });
    const result = await engine.evaluate({
      evaluateAlerts: true,
      persistAlerts: false,
      sendNotifications: false,
      metricCodes: Array.isArray(input?.metricCodes) ? input.metricCodes : [],
      cityIds: Array.isArray(input?.cityIds) ? input.cityIds : []
    });
    return {
      ok: result.executed === true,
      executed: result.executed === true,
      result
    };
  },


  orchestrator_run: async (input, context = {}) => {
    if (!context.actor?.id || context.actor.id !== context.userId ||
        !['free', 'pro', 'enterprise'].includes(context.userTier)) {
      return {
        ok: false,
        executed: false,
        httpStatus: 503,
        error: { code: 'USER_GOVERNANCE_UNAVAILABLE' }
      };
    }
    const intelligenceOrchestrator =
      require('../orchestrator/intelligence-orchestrator');

    return {
      ok: true,
      executed: true,
      result:
        await intelligenceOrchestrator.run({
          ...input.request,
          userId: context.userId,
          userTier: context.userTier,
          requestId: context.requestId || null
        })
    };
  },


  native_health: async (_input, context) =>
    getInferenceRouter(context).health(),


  native_generate: async (input, context) =>
    getInferenceRouter(context).generate(
      input.prompt,
      input
    )
});


function getRuntimeAdapter(name) {
  return RUNTIME_ADAPTERS[
    String(name || '').trim()
  ] || null;
}


module.exports = {
  RUNTIME_ADAPTERS,
  getRuntimeAdapter
};
