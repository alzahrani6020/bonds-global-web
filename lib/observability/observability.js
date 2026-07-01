/**
 * BONDS Observability
 *
 * Traces every operation through the system: what was called, how long it took,
 * what data was used, and whether it failed.
 */

class OperationTrace {
  constructor(name, metadata = {}) {
    this.name = name;
    this.metadata = metadata;
    this.startedAt = Date.now();
    this.endedAt = null;
    this.durationMs = 0;
    this.steps = [];
    this.error = null;
  }

  step(name, details = {}) {
    const step = {
      name,
      timestamp: Date.now(),
      elapsedMs: Date.now() - this.startedAt,
      ...details
    };
    this.steps.push(step);
    return step;
  }

  fail(error) {
    this.error = {
      message: error.message || String(error),
      stack: error.stack || null
    };
    this.end();
  }

  end(result = null) {
    if (this.endedAt) return this;
    this.endedAt = Date.now();
    this.durationMs = this.endedAt - this.startedAt;
    if (result !== null && result !== undefined) {
      this.resultSummary = summarizeResult(result);
    }
    return this;
  }

  toJSON() {
    return {
      name: this.name,
      metadata: this.metadata,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMs: this.durationMs,
      steps: this.steps,
      error: this.error,
      resultSummary: this.resultSummary
    };
  }
}

function summarizeResult(result) {
  if (result === null || result === undefined) return null;
  if (typeof result === 'object') {
    const keys = Object.keys(result);
    const summary = {};
    for (const key of keys.slice(0, 5)) {
      const value = result[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        summary[key] = '<object>';
      } else if (Array.isArray(value)) {
        summary[key] = `<array:${value.length}>`;
      } else {
        summary[key] = value;
      }
    }
    return summary;
  }
  return result;
}

async function trace(name, fn, metadata = {}) {
  const t = new OperationTrace(name, metadata);
  try {
    const result = await fn(t);
    t.end(result);
    return { result, trace: t.toJSON() };
  } catch (err) {
    t.fail(err);
    throw err;
  }
}

module.exports = {
  OperationTrace,
  trace,
  summarizeResult
};
