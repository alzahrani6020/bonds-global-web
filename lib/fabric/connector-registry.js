/**
 * BONDS Connector Registry
 *
 * Discovers, registers, and dispatches enterprise connectors.
 * No connector talks to UCP directly; it only produces normalized, evidence-backed values.
 */

class ConnectorRegistry {
  constructor() {
    this.connectors = new Map();
  }

  /**
   * Register a connector instance or class.
   */
  register(connector) {
    if (!connector) {
      throw new Error('Cannot register null connector');
    }
    const instance = typeof connector.getManifest === 'function' ? connector : new connector();
    const manifest = instance.getManifest();
    if (!manifest.sourceCode) {
      throw new Error('Connector manifest must include sourceCode');
    }
    this.connectors.set(manifest.sourceCode, instance);
    return instance;
  }

  /**
   * Unregister a connector.
   */
  unregister(sourceCode) {
    this.connectors.delete(sourceCode);
  }

  /**
   * Get a connector by source code.
   */
  get(sourceCode) {
    return this.connectors.get(sourceCode) || null;
  }

  /**
   * List all registered connector manifests.
   */
  list() {
    return Array.from(this.connectors.values()).map(c => c.getManifest());
  }

  /**
   * Find connectors supporting a given country and operation.
   */
  find({ country, industry, operation, metricCode }) {
    return this.list().filter(m => {
      if (country && !m.supportedCountries.includes(country)) return false;
      if (industry && !m.supportedIndustries.includes(industry)) return false;
      if (operation && !m.supportedOperations.includes(operation)) return false;
      if (metricCode && m.supportedMetrics && !m.supportedMetrics.includes(metricCode)) return false;
      return true;
    });
  }

  /**
   * Run health checks on all connectors (or a subset).
   */
  async healthCheck(sourceCodes) {
    const codes = sourceCodes || Array.from(this.connectors.keys());
    const results = [];
    for (const code of codes) {
      const connector = this.connectors.get(code);
      if (!connector) {
        results.push({ sourceCode: code, healthy: false, error: 'Connector not registered' });
        continue;
      }
      try {
        const check = await connector.healthCheck();
        results.push({ sourceCode: code, ...check });
      } catch (err) {
        results.push({ sourceCode: code, healthy: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Fetch and normalize data from a connector by source code.
   */
  async fetch(sourceCode, request = {}) {
    const connector = this.connectors.get(sourceCode);
    if (!connector) {
      throw new Error(`Connector not found: ${sourceCode}`);
    }
    const rate = await connector.checkRateLimit();
    if (!rate.allowed) {
      const err = new Error(`Rate limit exceeded for ${sourceCode}`);
      err.status = 429;
      throw err;
    }

    const raw = await connector.withRetry(() => connector.fetch(request), request);
    const normalized = await connector.normalize(raw);
    const items = Array.isArray(normalized) ? normalized : [normalized];
    const validated = [];
    for (const item of items) {
      const { valid, errors } = await connector.validate(item);
      if (valid) {
        validated.push({
          ...item,
          sourceCode,
          sourceVersion: connector.version,
          evidence: connector.mapEvidence(item)
        });
      } else {
        validated.push({
          ...item,
          sourceCode,
          sourceVersion: connector.version,
          valid: false,
          validationErrors: errors
        });
      }
    }
    return validated;
  }
}

module.exports = { ConnectorRegistry };
