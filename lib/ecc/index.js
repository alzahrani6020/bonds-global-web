/**
 * BONDS Executive Command Center (ECC) — Public API
 *
 * Phase E.0: project-centric command layer that aggregates all existing
 * BONDS engines without introducing new calculations.
 */

const { aggregateProjectStatus } = require('./project-status-aggregator');

module.exports = {
  aggregateProjectStatus
};
