/**
 * Enterprise Lifecycle Event Bus
 *
 * Publishes lifecycle events that other engines can subscribe to.
 */

class EventBus {
  constructor() {
    this.subscriptions = new Map();
  }

  subscribe(eventType, handler) {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }
    this.subscriptions.get(eventType).push(handler);
  }

  async emit(eventType, payload) {
    const handlers = this.subscriptions.get(eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (err) {
        console.warn(`[EventBus] Handler for ${eventType} failed:`, err.message);
      }
    }
  }

  async emitAndStore({ instanceId, eventType, payload, source, store }) {
    await this.emit(eventType, { instanceId, eventType, payload, source });
    if (store) {
      return await store.createEvent({
        instance_id: instanceId,
        event_type: eventType,
        payload,
        source
      });
    }
    return { instanceId, eventType, payload, source, created_at: new Date().toISOString() };
  }
}

module.exports = { EventBus };
