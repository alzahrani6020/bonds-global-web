'use strict';

class SupabasePostingStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('POSTING_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
    this.claim = null;
  }

  async claimEvent({ accounting_entity_id, event_id, idempotency_key } = {}) {
    if (!accounting_entity_id) throw new Error('POSTING_ACCOUNTING_ENTITY_REQUIRED');
    if (!event_id) throw new Error('POSTING_EVENT_ID_REQUIRED');
    if (!idempotency_key) throw new Error('POSTING_IDEMPOTENCY_KEY_REQUIRED');

    this.claim = { accounting_entity_id, event_id, idempotency_key };
    return { state:'claimed' };
  }

  async commitPosting(posting) {
    if (!this.claim) throw new Error('POSTING_CLAIM_REQUIRED');
    if (posting.accounting_entity_id !== this.claim.accounting_entity_id ||
        posting.event_id !== this.claim.event_id ||
        posting.idempotency_key !== this.claim.idempotency_key) {
      throw new Error('POSTING_CLAIM_MISMATCH');
    }

    const event = posting.event;
    if (!event) throw new Error('POSTING_NORMALIZED_EVENT_REQUIRED');

    const { data, error } = await this.supabase.rpc('accounting_commit_posting', {
      p_event: event,
      p_posting: posting
    });

    this.claim = null;
    if (error) {
      const message = String(error.message || error.code || 'POSTING_COMMIT_FAILED');
      if (message.includes('POSTING_IDEMPOTENCY_CONFLICT')) {
        throw new Error('POSTING_IDEMPOTENCY_CONFLICT');
      }
      throw new Error(message);
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.ok !== true) throw new Error('POSTING_COMMIT_FAILED');

    return {
      ok:true,
      state:result.state || 'claimed',
      posting_id:result.posting_id || null,
      event_id:result.event_id || null,
      subledger_id:result.subledger_id || null,
      period_id:result.period_id || null,
      replayed:result.state === 'replayed'
    };
  }
}

module.exports = { SupabasePostingStore };
