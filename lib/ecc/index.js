/**
 * BONDS Executive Command Center (ECC) — Public API
 *
 * Phase E.0: project-centric command layer that aggregates all existing
 * BONDS engines without introducing new calculations.
 */

const { aggregateProjectStatus } = require('./project-status-aggregator');
const { aggregatePortfolioStatus, listUserProjects } = require('./portfolio-status-aggregator');
const { generateNotifications } = require('./notification-engine');
const { executiveSearch } = require('./executive-search-engine');
const { getUserRole, can, requireRole } = require('./role-guard');

module.exports = {
  aggregateProjectStatus,
  aggregatePortfolioStatus,
  generateNotifications,
  executiveSearch,
  listUserProjects,
  getUserRole,
  can,
  requireRole
};
