/**
 * BONDS Freshness Engine
 *
 * Evaluates age, expiry, and refresh recommendations for every imported value.
 */

class FreshnessEngine {
  constructor(defaultMaxAgeSeconds = 86400) {
    this.defaultMaxAgeSeconds = defaultMaxAgeSeconds;
  }

  evaluate(record, policy = {}) {
    const collectedAt = record.collectedAt || record.created_at || new Date().toISOString();
    const lastUpdate = record.lastUpdate || collectedAt;
    const maxAgeSeconds = policy.maxAgeSeconds || record.maxAgeSeconds || this.defaultMaxAgeSeconds;
    const expiry = new Date(new Date(collectedAt).getTime() + maxAgeSeconds * 1000).toISOString();
    const now = Date.now();
    const ageSeconds = Math.max(0, Math.round((now - new Date(collectedAt).getTime()) / 1000));
    const ageDays = Math.round(ageSeconds / 86400 * 10) / 10;

    const freshnessRatio = Math.max(0, 1 - ageSeconds / maxAgeSeconds);
    const freshnessScore = Math.round(freshnessRatio * 100);

    let recommendation = 'fresh';
    if (freshnessRatio <= 0) recommendation = 'expired';
    else if (freshnessRatio < 0.25) recommendation = 'refresh_urgent';
    else if (freshnessRatio < 0.5) recommendation = 'refresh_soon';

    const autoRefresh = policy.autoRefresh && recommendation !== 'fresh';

    return {
      collectedAt,
      lastUpdate,
      expiry,
      ageSeconds,
      ageDays,
      maxAgeSeconds,
      freshnessScore,
      recommendation,
      autoRefresh,
      refreshDueAt: expiry
    };
  }

  /**
   * Recommend refresh order for a list of records.
   */
  prioritize(records) {
    return records
      .map(r => ({ record: r, ...this.evaluate(r, r.policy) }))
      .sort((a, b) => a.freshnessScore - b.freshnessScore);
  }
}

module.exports = { FreshnessEngine };
