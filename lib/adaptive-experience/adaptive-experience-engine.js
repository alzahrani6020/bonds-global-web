/**
 * BONDS Adaptive Experience Engine
 *
 * Adapts the UI configuration based on the user's Decision Profile.
 * Does not render UI; returns configuration for the frontend.
 */

function buildExperienceConfig(decisionProfile, options = {}) {
  const expertise = decisionProfile.expertiseScore || 0;
  const topSectors = decisionProfile.topSectors ? decisionProfile.topSectors(3) : [];
  const topDecisions = decisionProfile.topDecisions ? decisionProfile.topDecisions(3) : [];
  const language = options.language || decisionProfile.metadata?.language || 'ar';

  const isNovice = expertise < 30;
  const isExpert = expertise >= 70;

  return {
    language,
    simplifiedMode: isNovice,
    showAdvancedOptions: isExpert,
    showTooltips: isNovice,
    defaultSector: topSectors[0]?.item || null,
    defaultDecisionType: topDecisions[0]?.type || null,
    fieldDensity: isNovice ? 'minimal' : isExpert ? 'full' : 'standard',
    fieldOrdering: buildFieldOrdering(decisionProfile),
    reportOrdering: buildReportOrdering(decisionProfile),
    dataSourceHints: topDataSources(decisionProfile),
    helpLevel: isNovice ? 'high' : isExpert ? 'low' : 'medium',
    onboardingComplete: expertise > 10
  };
}

function buildFieldOrdering(decisionProfile) {
  // Fields the user has filled or seen most often should appear first.
  const formulaFields = (decisionProfile.formulas || []).slice(0, 5);
  const patterns = decisionProfile.decisionPatterns || {};
  const order = [];

  if (patterns.feasibility) order.push('capital', 'revenue', 'costs');
  if (patterns.request_financing || patterns.financing) order.push('dscr', 'ltv', 'collateral');
  if (patterns.value_asset || patterns.buy_asset || patterns.sell_asset) order.push('asset_class', 'location', 'market_value');
  if (patterns.market_analysis) order.push('sector', 'city', 'competitors');

  // Deduplicate while preserving priority.
  return [...new Set([...order, ...formulaFields])];
}

function buildReportOrdering(decisionProfile) {
  const reportTypes = decisionProfile.reportTypes || [];
  const counts = {};
  for (const r of reportTypes) counts[r] = (counts[r] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);
}

function topDataSources(decisionProfile) {
  const sources = decisionProfile.dataSources || [];
  const counts = {};
  for (const s of sources) counts[s] = (counts[s] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([source, count]) => ({ source, count }));
}

module.exports = {
  buildExperienceConfig,
  buildFieldOrdering,
  buildReportOrdering,
  topDataSources
};
