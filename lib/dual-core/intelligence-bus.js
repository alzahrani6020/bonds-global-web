'use strict';

const crypto = require('crypto');
const { validateEvent } = require('./event-taxonomy');

class DynamicIntelligenceBus {
  constructor({ maxHistory = 1000 } = {}) {
    this.handlers = new Map();
    this.history = [];
    this.maxHistory = Math.max(1, Number(maxHistory) || 1000);
  }

  subscribe(type, handler) {
    if (typeof handler !== 'function') throw new Error('DUAL_CORE_HANDLER_REQUIRED');
    const set = this.handlers.get(type) || new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  createEvent(type, payload = {}, metadata = {}) {
    return {
      id: crypto.randomUUID(),
      type,
      occurred_at: new Date().toISOString(),
      payload,
      metadata
    };
  }

  async publish(event) {
    validateEvent(event);
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
    const handlers = [...(this.handlers.get(event.type) || [])];
    const results = [];
    for (const handler of handlers) {
      results.push(await handler(event));
    }
    return { delivered: handlers.length, results };
  }

  recent(limit = 100) {
    const n = Math.max(1, Math.min(this.maxHistory, Number(limit) || 100));
    return this.history.slice(-n);
  }
}

module.exports = { DynamicIntelligenceBus };
