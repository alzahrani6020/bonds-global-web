'use strict';

function resolveOpportunityYear(requestedYear, currentYear = new Date().getFullYear()) {
  if (!requestedYear || requestedYear === 'latest') return currentYear;
  const parsed = Number.parseInt(requestedYear, 10);
  return Number.isFinite(parsed) ? parsed : currentYear;
}

module.exports = { resolveOpportunityYear };
