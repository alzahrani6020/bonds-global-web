'use strict';

const { runFinancialEngine } = require('../finance/financial-engine-registry');

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function explicitClientId(event) {
  const payload = event && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload : {};
  const evidence = event && typeof event.evidence === 'object' && !Array.isArray(event.evidence) ? event.evidence : {};
  return text(payload.client_id || evidence.client_id) || null;
}

function buildClientLifetimeValue(input = {}) {
  const clients = array(input.clients);
  const serviceRequests = array(input.serviceRequests);
  const financialEvents = array(input.financialEvents);
  const customerSuccess = array(input.customerSuccess);
  const governed = input.governedUnitEconomicsInput && typeof input.governedUnitEconomicsInput === 'object'
    ? input.governedUnitEconomicsInput
    : null;

  const clientIds = new Set(clients.map(row => text(row.id)).filter(Boolean));
  const requestClientIds = new Set(
    serviceRequests.map(row => text(row.client_id)).filter(id => id && (!clientIds.size || clientIds.has(id)))
  );
  const posted = financialEvents.filter(row => row && row.status === 'posted');
  const postedClientAttributed = posted.filter(row => {
    const id = explicitClientId(row);
    return id && (!clientIds.size || clientIds.has(id));
  });

  let engineResult = null;
  if (governed) {
    engineResult = runFinancialEngine('unit_economics', {
      ...governed,
      analysis_scope: 'ltv'
    });
  }

  const ltv = engineResult && engineResult.ok ? engineResult.metrics.ltv : null;
  const dataState = ltv === null ? 'unknown' : 'available';

  return {
    status: 'partial',
    dataState,
    ltv,
    method: engineResult && engineResult.ok
      ? engineResult.diagnostics?.ltv_method || null
      : null,
    periodBasis: engineResult && engineResult.ok
      ? engineResult.diagnostics?.period_basis || null
      : null,
    reason: ltv === null
      ? 'CLV is UNKNOWN: current production evidence does not provide governed churn/explicit LTV plus client-attributed posted financial evidence.'
      : 'LTV is computed by the governed unit-economics engine; capability remains PARTIAL until client revenue/cost attribution and retention evidence are fully operational.',
    coverage: {
      clients: clients.length,
      clientsWithServiceRequests: requestClientIds.size,
      serviceRequests: serviceRequests.length,
      customerSuccessRows: customerSuccess.length,
      postedFinancialEvents: posted.length,
      postedClientAttributedFinancialEvents: postedClientAttributed.length
    },
    missingEvidence: ltv === null
      ? [
          'governed_churn_rate_pct_or_explicit_ltv',
          'governed_gross_profit_and_active_customers_when_churn_method_is_used',
          'posted_client_attributed_financial_events',
          'customer_retention_history'
        ]
      : [],
    semantics: 'governed_ltv_not_crm_pipeline_value',
    engine: 'unit_economics'
  };
}

module.exports = { buildClientLifetimeValue };
