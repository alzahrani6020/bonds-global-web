'use strict';

function normalizeEntityName(value) {
  const name = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('ACCOUNTING_ENTITY_NAME_REQUIRED');
  if (name.length > 160) throw new Error('ACCOUNTING_ENTITY_NAME_TOO_LONG');
  return name;
}

function normalizeCurrency(value) {
  const currency = String(value || 'SAR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('ACCOUNTING_ENTITY_CURRENCY_INVALID');
  return currency;
}

function normalizeIdempotencyKey(value) {
  const key = String(value == null ? '' : value).trim();
  if (!key) return null;
  if (key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new Error('ACCOUNTING_ENTITY_IDEMPOTENCY_KEY_INVALID');
  }
  return key;
}

class AccountingEntityUserService {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('ACCOUNTING_ENTITY_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async listForUser(userId) {
    const user = String(userId || '').trim();
    if (!user) throw new Error('ACCOUNTING_ENTITY_USER_REQUIRED');

    const membershipResult = await this.supabase
      .from('accounting_entity_members')
      .select('accounting_entity_id,role,status,created_at')
      .eq('user_id', user)
      .eq('status', 'active');

    if (membershipResult.error) {
      throw new Error(String(membershipResult.error.message || 'ACCOUNTING_ENTITY_MEMBERSHIP_READ_FAILED'));
    }

    const memberships = Array.isArray(membershipResult.data) ? membershipResult.data : [];
    const ids = [...new Set(memberships.map(row => row.accounting_entity_id).filter(Boolean))];
    if (!ids.length) return [];

    const entityResult = await this.supabase
      .from('accounting_entities')
      .select('id,name,base_currency,status,organization_id,metadata,created_at,updated_at')
      .in('id', ids)
      .eq('status', 'active');

    if (entityResult.error) {
      throw new Error(String(entityResult.error.message || 'ACCOUNTING_ENTITY_READ_FAILED'));
    }

    const roleByEntity = new Map(memberships.map(row => [row.accounting_entity_id, row.role]));
    return (entityResult.data || []).map(entity => ({
      ...entity,
      role: roleByEntity.get(entity.id) || null
    }));
  }

  async createForUser(userId, input = {}, idempotencyKey = null) {
    const user = String(userId || '').trim();
    if (!user) throw new Error('ACCOUNTING_ENTITY_USER_REQUIRED');

    const name = normalizeEntityName(input.name);
    const baseCurrency = normalizeCurrency(input.base_currency || input.baseCurrency);
    const requestId = normalizeIdempotencyKey(idempotencyKey);

    if (requestId) {
      const existingResult = await this.supabase
        .from('accounting_entities')
        .select('id,name,base_currency,status,organization_id,metadata,created_at,updated_at')
        .eq('created_by', user)
        .contains('metadata', { creation_request_id: requestId })
        .maybeSingle();
      if (existingResult.error) {
        throw new Error(String(existingResult.error.message || 'ACCOUNTING_ENTITY_IDEMPOTENCY_LOOKUP_FAILED'));
      }
      if (existingResult.data) {
        if (existingResult.data.name !== name || existingResult.data.base_currency !== baseCurrency) {
          throw new Error('ACCOUNTING_ENTITY_IDEMPOTENCY_CONFLICT');
        }
        const existingMembership = await this.supabase
          .from('accounting_entity_members')
          .select('accounting_entity_id,user_id,role,status,created_at')
          .eq('accounting_entity_id', existingResult.data.id)
          .eq('user_id', user)
          .eq('status', 'active')
          .maybeSingle();
        if (existingMembership.error || !existingMembership.data || existingMembership.data.role !== 'owner') {
          throw new Error('ACCOUNTING_ENTITY_OWNER_MEMBERSHIP_NOT_SEEDED');
        }
        return { ...existingResult.data, role: existingMembership.data.role, idempotent_replay: true };
      }
    }

    const insertResult = await this.supabase
      .from('accounting_entities')
      .insert({
        name,
        base_currency: baseCurrency,
        status: 'active',
        created_by: user,
        metadata: {
          ...(input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
            ? input.metadata
            : {}),
          created_via: 'services.accounting.entities',
          ...(requestId ? { creation_request_id: requestId } : {})
        }
      })
      .select('id,name,base_currency,status,organization_id,metadata,created_at,updated_at')
      .single();

    if (insertResult.error || !insertResult.data) {
      if (requestId && String(insertResult.error?.code || '') === '23505') {
        const replayResult = await this.supabase
          .from('accounting_entities')
          .select('id,name,base_currency,status,organization_id,metadata,created_at,updated_at')
          .eq('created_by', user)
          .contains('metadata', { creation_request_id: requestId })
          .maybeSingle();
        if (replayResult.error || !replayResult.data) {
          throw new Error(String(replayResult.error?.message || 'ACCOUNTING_ENTITY_IDEMPOTENCY_REPLAY_FAILED'));
        }
        if (replayResult.data.name !== name || replayResult.data.base_currency !== baseCurrency) {
          throw new Error('ACCOUNTING_ENTITY_IDEMPOTENCY_CONFLICT');
        }
        const replayMembership = await this.supabase
          .from('accounting_entity_members')
          .select('accounting_entity_id,user_id,role,status,created_at')
          .eq('accounting_entity_id', replayResult.data.id)
          .eq('user_id', user)
          .eq('status', 'active')
          .maybeSingle();
        if (replayMembership.error || !replayMembership.data || replayMembership.data.role !== 'owner') {
          throw new Error('ACCOUNTING_ENTITY_OWNER_MEMBERSHIP_NOT_SEEDED');
        }
        return { ...replayResult.data, role: replayMembership.data.role, idempotent_replay: true };
      }
      throw new Error(String(insertResult.error?.message || 'ACCOUNTING_ENTITY_CREATE_FAILED'));
    }

    const membershipResult = await this.supabase
      .from('accounting_entity_members')
      .select('accounting_entity_id,user_id,role,status,created_at')
      .eq('accounting_entity_id', insertResult.data.id)
      .eq('user_id', user)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipResult.error || !membershipResult.data || membershipResult.data.role !== 'owner') {
      try {
        await this.supabase
          .from('accounting_entities')
          .delete()
          .eq('id', insertResult.data.id)
          .eq('created_by', user);
      } catch (_) {}

      if (membershipResult.error) {
        throw new Error(String(membershipResult.error.message || 'ACCOUNTING_ENTITY_MEMBERSHIP_VERIFY_FAILED'));
      }
      throw new Error('ACCOUNTING_ENTITY_OWNER_MEMBERSHIP_NOT_SEEDED');
    }

    return {
      ...insertResult.data,
      role: membershipResult.data.role
    };
  }
}

module.exports = {
  normalizeEntityName,
  normalizeCurrency,
  normalizeIdempotencyKey,
  AccountingEntityUserService
};
