'use strict';

const { runFinancialEngine } = require('../finance/financial-engine-registry');

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildCacRoas(input = {}) {
  const invoices = Array.isArray(input.invoices) ? input.invoices : [];
  const opportunities = Array.isArray(input.opportunities) ? input.opportunities : [];
  const governed = input.governedAcquisitionInput && typeof input.governedAcquisitionInput === 'object'
    ? input.governedAcquisitionInput
    : null;

  const currency = governed ? String(governed.currency || '').trim().toUpperCase() : '';
  const periodBasis = governed ? String(governed.period_basis || '').trim() : '';

  let engineResult = null;
  if (governed && currency && periodBasis) {
    engineResult = runFinancialEngine('unit_economics', {
      ...governed,
      analysis_scope: 'acquisition'
    });
  }

  const cac = engineResult && engineResult.ok ? finite(engineResult.metrics.cac) : null;
  const roas = engineResult && engineResult.ok ? finite(engineResult.metrics.roas) : null;
  const attributedRevenue = engineResult && engineResult.ok ? finite(engineResult.metrics.attributed_revenue) : null;
  const dataState = cac === null || roas === null ? 'unknown' : 'available';

  return {
    status: 'partial',
    dataState,
    cac,
    roas,
    attributedRevenue,
    currency: engineResult && engineResult.ok ? currency : null,
    periodBasis: engineResult && engineResult.ok
      ? engineResult.diagnostics?.period_basis || null
      : null,
    reason: dataState === 'unknown'
      ? 'CAC / ROAS are UNKNOWN: no governed acquisition-spend dataset is currently available together with new-customer and explicitly attributed revenue evidence.'
      : 'CAC and ROAS are computed by the governed unit-economics engine; capability remains PARTIAL until campaign-cost ingestion and revenue attribution coverage are operational.',
    coverage: {
      opportunities: opportunities.length,
      opportunitiesWithSource: opportunities.filter(row => String(row?.source || '').trim()).length,
      paidInvoices: invoices.filter(row => row?.status === 'paid').length,
      paidInvoicesWithExplicitSource: invoices.filter(row => {
        if (row?.status !== 'paid') return false;
        const meta = row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {};
        return Boolean(String(meta.source || meta.utm_source || meta.referrer || '').trim());
      }).length
    },
    missingEvidence: dataState === 'unknown'
      ? [
          'governed_acquisition_spend',
          'governed_new_customers',
          'explicitly_attributed_paid_revenue',
          'consistent_period_and_currency_basis'
        ]
      : [],
    semantics: 'governed_spend_and_attributed_revenue_not_pipeline_value',
    engine: 'unit_economics'
  };
}

module.exports = { buildCacRoas };
