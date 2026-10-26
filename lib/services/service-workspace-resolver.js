'use strict';

const WORKSPACE_TYPES = Object.freeze({
  ACCOUNTING: 'accounting',
  FINANCIAL_ANALYSIS: 'financial-analysis',
  FUNDING: 'funding-restructuring',
  STUDIES_VALUATION: 'studies-valuation',
  COMPLIANCE: 'tax-compliance',
  PROFESSIONAL_REVIEW: 'professional-review',
  ADVISORY: 'advisory-request'
});

const GROUP_WORKSPACES = Object.freeze({
  accounting_records: WORKSPACE_TYPES.ACCOUNTING,
  financial_statements_reporting: WORKSPACE_TYPES.ACCOUNTING,
  audit_opinion: WORKSPACE_TYPES.PROFESSIONAL_REVIEW,
  planning_cashflow: WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
  core_financial_analysis: WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
  leverage_capital_debt: WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
  returns_margins: WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
  working_capital_cash: WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
  comparative_trends: WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
  risk_resilience: WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
  growth_value_diagnostics: WORKSPACE_TYPES.FINANCIAL_ANALYSIS,
  studies_valuation: WORKSPACE_TYPES.STUDIES_VALUATION,
  funding_restructuring: WORKSPACE_TYPES.FUNDING,
  business_market: WORKSPACE_TYPES.STUDIES_VALUATION,
  zakat_services: WORKSPACE_TYPES.COMPLIANCE,
  vat_services: WORKSPACE_TYPES.COMPLIANCE,
  direct_tax_withholding: WORKSPACE_TYPES.COMPLIANCE,
  transaction_excise_tax: WORKSPACE_TYPES.COMPLIANCE,
  e_invoicing_tax: WORKSPACE_TYPES.COMPLIANCE,
  tax_audit_disputes: WORKSPACE_TYPES.COMPLIANCE,
  tax_compliance_health: WORKSPACE_TYPES.COMPLIANCE
});

function workspaceTypeFor(service = {}) {
  if (GROUP_WORKSPACES[service.group_code]) return GROUP_WORKSPACES[service.group_code];
  if (service.category_code === 'tax_zakat') return WORKSPACE_TYPES.COMPLIANCE;
  if (service.category_code === 'funding_restructuring') return WORKSPACE_TYPES.FUNDING;
  if (service.category_code === 'studies_valuation') return WORKSPACE_TYPES.STUDIES_VALUATION;
  if (service.category_code === 'financial_advisory') return WORKSPACE_TYPES.FINANCIAL_ANALYSIS;
  if (service.category_code === 'business_market') return WORKSPACE_TYPES.STUDIES_VALUATION;
  return WORKSPACE_TYPES.ADVISORY;
}

function routeForWorkspace(type, language = 'ar') {
  const prefix = language === 'en' ? '/en' : '';
  if (type === WORKSPACE_TYPES.ADVISORY) {
    return prefix + '/service-request.html';
  }
  return prefix + '/my-bonds/workspace/';
}

function resolveServiceWorkspace(service = {}, profile = {}) {
  const executionMode = String(profile.execution_mode || 'request_only');
  const executionStatus = String(profile.execution_status || 'request_only');
  const automated = executionMode === 'capability_plan' && Boolean(profile.primary_action);

  if (!automated) {
    return {
      type: WORKSPACE_TYPES.ADVISORY,
      mode: 'request',
      ready: true,
      route_ar: '/service-request.html',
      route_en: '/en/service-request.html',
      reason: 'request_only'
    };
  }

  const type = workspaceTypeFor(service);
  return {
    type,
    mode: 'execute',
    ready: true,
    route_ar: routeForWorkspace(type, 'ar'),
    route_en: routeForWorkspace(type, 'en'),
    reason: executionStatus
  };
}

module.exports = {
  WORKSPACE_TYPES,
  GROUP_WORKSPACES,
  workspaceTypeFor,
  routeForWorkspace,
  resolveServiceWorkspace
};
