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

  async createForUser(userId, input = {}) {
    const user = String(userId || '').trim();
    if (!user) throw new Error('ACCOUNTING_ENTITY_USER_REQUIRED');

    const name = normalizeEntityName(input.name);
    const baseCurrency = normalizeCurrency(input.base_currency || input.baseCurrency);

    const insertResult = await this.supabase
      .from('accounting_entities')
      .insert({
        name,
        base_currency: baseCurrency,
        status: 'active',
        created_by: user,
        metadata: {
          created_via: 'services.accounting.entities',
          ...(input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
            ? input.metadata
            : {})
        }
      })
      .select('id,name,base_currency,status,organization_id,metadata,created_at,updated_at')
      .single();

    if (insertResult.error || !insertResult.data) {
      throw new Error(String(insertResult.error?.message || 'ACCOUNTING_ENTITY_CREATE_FAILED'));
    }

    const membershipResult = await this.supabase
      .from('accounting_entity_members')
      .select('accounting_entity_id,user_id,role,status,created_at')
      .eq('accounting_entity_id', insertResult.data.id)
      .eq('user_id', user)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipResult.error) {
      throw new Error(String(membershipResult.error.message || 'ACCOUNTING_ENTITY_MEMBERSHIP_VERIFY_FAILED'));
    }
    if (!membershipResult.data || membershipResult.data.role !== 'owner') {
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
  AccountingEntityUserService
};
