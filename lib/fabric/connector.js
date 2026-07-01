/**
 * BONDS Enterprise Connector Interface
 *
 * Every external data provider must implement this contract.
 * Connectors do NOT communicate directly with UCP; they feed the Trusted Data Fabric.
 */

class BaseConnector {
  constructor(options = {}) {
    this.sourceCode = options.sourceCode || this.constructor.name;
    this.sourceName = options.sourceName || this.sourceCode;
    this.version = options.version || '1.0.0';
    this.category = options.category || 'generic';
    this.supportedCountries = options.supportedCountries || [];
    this.supportedIndustries = options.supportedIndustries || [];
    this.supportedOperations = options.supportedOperations || [];
    this.supportedAssets = options.supportedAssets || [];
    this.authType = options.authType || 'none';
    this.rateLimit = options.rateLimit || { requests: 100, windowMs: 60_000 };
    this.retryPolicy = options.retryPolicy || { maxRetries: 3, backoffMs: 500 };
    this.cachePolicy = options.cachePolicy || { ttlSeconds: 300 };
    this.evidenceMapping = options.evidenceMapping || {};
    this.confidenceMapping = options.confidenceMapping || {};
    this.config = options.config || {};
    this.status = options.status || 'active';
  }

  /**
   * Connector manifest — consumed by Connector Registry and Marketplace.
   */
  getManifest() {
    return {
      sourceCode: this.sourceCode,
      sourceName: this.sourceName,
      version: this.version,
      category: this.category,
      supportedCountries: this.supportedCountries,
      supportedIndustries: this.supportedIndustries,
      supportedOperations: this.supportedOperations,
      supportedAssets: this.supportedAssets,
      authType: this.authType,
      rateLimit: this.rateLimit,
      retryPolicy: this.retryPolicy,
      cachePolicy: this.cachePolicy,
      evidenceMapping: this.evidenceMapping,
      confidenceMapping: this.confidenceMapping,
      status: this.status
    };
  }

  /**
   * Validate and store credentials. Return metadata without exposing secrets.
   */
  async authenticate(credentials) {
    throw new Error(`authenticate() not implemented for ${this.sourceCode}`);
  }

  /**
   * Health check: connectivity, latency, basic liveness.
   */
  async healthCheck() {
    return { healthy: true, latencyMs: 0, message: 'No health check implemented' };
  }

  /**
   * Fetch raw data from the source for a given request context.
   */
  async fetch(request = {}) {
    throw new Error(`fetch() not implemented for ${this.sourceCode}`);
  }

  /**
   * Normalize raw payload into canonical metric/value records.
   */
  async normalize(raw) {
    return raw;
  }

  /**
   * Validate a normalized record.
   */
  async validate(normalized) {
    const errors = [];
    if (normalized === null || normalized === undefined) {
      errors.push('normalized value is null or undefined');
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * List metric codes this connector can provide.
   */
  getSupportedMetrics() {
    return [];
  }

  /**
   * Map a normalized value to an evidence object.
   */
  mapEvidence(normalized) {
    return {
      evidence_type: 'external_source',
      source: this.sourceCode,
      source_version: this.version,
      collected_at: normalized?.collectedAt || new Date().toISOString(),
      ...this.evidenceMapping
    };
  }

  /**
   * Convert source-quality label to a base confidence score.
   */
  getConfidence(sourceQuality = 'estimated') {
    const map = {
      official: 95,
      open_data: 80,
      google_places: 85,
      manual: 85,
      scraped: 60,
      mixed: 55,
      estimated: 50,
      fallback: 45,
      llm: 40,
      ...this.confidenceMapping
    };
    return map[sourceQuality] ?? 50;
  }

  /**
   * Retry helper with exponential backoff.
   */
  async withRetry(fn, context = {}) {
    const { maxRetries = 3, backoffMs = 500 } = this.retryPolicy;
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt === maxRetries) break;
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  /**
   * Simple in-memory rate-limit gate. Production should use a distributed store.
   */
  async checkRateLimit() {
    return { allowed: true, remaining: this.rateLimit.requests, resetAt: Date.now() + this.rateLimit.windowMs };
  }
}

module.exports = BaseConnector;
