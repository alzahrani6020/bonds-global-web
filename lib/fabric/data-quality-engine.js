/**
 * BONDS Data Quality Engine
 *
 * Computes quality dimensions for any imported or calculated value.
 */

class DataQualityEngine {
  constructor(weights = {}) {
    this.weights = {
      completeness: 0.15,
      accuracy: 0.15,
      consistency: 0.15,
      uniqueness: 0.10,
      validity: 0.15,
      integrity: 0.10,
      timeliness: 0.10,
      availability: 0.10,
      ...weights
    };
  }

  evaluate(value, context = {}) {
    const dimensions = {
      completeness: this._completeness(value, context),
      accuracy: this._accuracy(value, context),
      consistency: this._consistency(value, context),
      uniqueness: this._uniqueness(value, context),
      validity: this._validity(value, context),
      integrity: this._integrity(value, context),
      timeliness: this._timeliness(value, context),
      availability: this._availability(value, context)
    };

    const overall = Math.round(
      Object.entries(this.weights).reduce((sum, [key, weight]) => {
        return sum + dimensions[key] * weight;
      }, 0)
    );

    return {
      dimensions,
      overallScore: overall,
      assessedAt: new Date().toISOString()
    };
  }

  _completeness(value, context) {
    if (value === null || value === undefined) return 0;
    if (Array.isArray(value) && value.length === 0) return 0;
    if (typeof value === 'object' && Object.keys(value).length === 0) return 30;
    if (context.requiredFields) {
      const missing = context.requiredFields.filter(f => value[f] === undefined || value[f] === null);
      return Math.round((1 - missing.length / context.requiredFields.length) * 100);
    }
    return 100;
  }

  _accuracy(value, context) {
    return context.accuracyScore !== undefined ? Math.round(context.accuracyScore) : 70;
  }

  _consistency(value, context) {
    if (!context.peerValues || context.peerValues.length < 2) return 70;
    const numeric = context.peerValues.map(v => Number(v)).filter(n => !isNaN(n));
    if (numeric.length < 2) return 70;
    const mean = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    const variance = numeric.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numeric.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = mean === 0 ? 0 : stdDev / Math.abs(mean);
    return Math.round(Math.max(0, 100 - coefficient * 100));
  }

  _uniqueness(value, context) {
    if (!context.peerValues || context.peerValues.length === 0) return 100;
    const str = JSON.stringify(value);
    const duplicates = context.peerValues.filter(v => JSON.stringify(v) === str).length;
    return Math.round(Math.max(0, 100 - duplicates * 10));
  }

  _validity(value, context) {
    if (context.validator && typeof context.validator === 'function') {
      return context.validator(value) ? 100 : 0;
    }
    if (typeof value === 'number' && isNaN(value)) return 0;
    return 80;
  }

  _integrity(value, context) {
    return context.integrityVerified ? 100 : 60;
  }

  _timeliness(value, context) {
    return context.timelinessScore !== undefined ? Math.round(context.timelinessScore) : 70;
  }

  _availability(value, context) {
    return context.available === false ? 0 : 100;
  }
}

module.exports = { DataQualityEngine };
