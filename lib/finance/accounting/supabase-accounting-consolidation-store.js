'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

function finite(value, code) {
  const out = Number(value);
  if (!Number.isFinite(out)) throw new Error(code);
  return out;
}

function array(value, code) {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function lineAmount(row) {
  const debit = Number(row?.debit || 0);
  const credit = Number(row?.credit || 0);
  if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
    throw new Error('INTERCOMPANY_LINE_AMOUNT_INVALID');
  }
  return Math.abs(debit) + Math.abs(credit);
}

function eliminationAccounts(rows, pairKey) {
  if (rows.length !== 2) {
    throw new Error(`INTERCOMPANY_PAIR_INCOMPLETE:${pairKey}`);
  }

  const [a,b] = rows;
  if (
    String(a.accounting_entity_id) !== String(b.counterparty_accounting_entity_id) ||
    String(b.accounting_entity_id) !== String(a.counterparty_accounting_entity_id)
  ) {
    throw new Error(`INTERCOMPANY_PAIR_NOT_RECIPROCAL:${pairKey}`);
  }

  const types = new Set([a.account_type,b.account_type]);

  if (types.has('asset') && types.has('liability')) {
    const asset = a.account_type === 'asset' ? a : b;
    const liability = a.account_type === 'liability' ? a : b;
    return {
      type:'balance',
      debit_account_code:liability.account_code,
      credit_account_code:asset.account_code,
      source_amount:lineAmount(a),
      counterparty_amount:lineAmount(b)
    };
  }

  if (types.has('asset') && types.has('contra_asset')) {
    const asset = a.account_type === 'asset' ? a : b;
    const contra = a.account_type === 'contra_asset' ? a : b;
    return {
      type:'balance',
      debit_account_code:contra.account_code,
      credit_account_code:asset.account_code,
      source_amount:lineAmount(a),
      counterparty_amount:lineAmount(b)
    };
  }

  if (types.has('revenue') && types.has('expense')) {
    const revenue = a.account_type === 'revenue' ? a : b;
    const expense = a.account_type === 'expense' ? a : b;
    return {
      type:'income',
      debit_account_code:revenue.account_code,
      credit_account_code:expense.account_code,
      source_amount:lineAmount(a),
      counterparty_amount:lineAmount(b)
    };
  }

  throw new Error(`INTERCOMPANY_PAIR_ACCOUNT_TYPES_UNSUPPORTED:${pairKey}`);
}

class SupabaseAccountingConsolidationStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function' ||
        typeof supabase.from !== 'function') {
      throw new Error('ACCOUNTING_CONSOLIDATION_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async configureGroup(input = {}) {
    const members = array(input.members || [], 'ACCOUNTING_GROUP_MEMBERS_ARRAY_REQUIRED');

    const { data, error } = await this.supabase.rpc(
      'accounting_configure_group',
      {
        p_parent_accounting_entity_id:requiredText(
          input.parentAccountingEntityId,
          'ACCOUNTING_GROUP_PARENT_REQUIRED'
        ),
        p_code:requiredText(input.code,'ACCOUNTING_GROUP_CODE_REQUIRED'),
        p_name:requiredText(input.name,'ACCOUNTING_GROUP_NAME_REQUIRED'),
        p_presentation_currency:requiredText(
          input.presentationCurrency,
          'ACCOUNTING_GROUP_CURRENCY_REQUIRED'
        ).toUpperCase(),
        p_members:members.map(member=>({
          accounting_entity_id:requiredText(
            member.accounting_entity_id || member.accountingEntityId,
            'ACCOUNTING_GROUP_MEMBER_ID_REQUIRED'
          ),
          ownership_pct:finite(
            member.ownership_pct ?? member.ownershipPct,
            'ACCOUNTING_GROUP_OWNERSHIP_INVALID'
          ),
          effective_from:member.effective_from || member.effectiveFrom || null,
          effective_to:member.effective_to || member.effectiveTo || null,
          status:member.status || 'active',
          metadata:member.metadata || {}
        })),
        p_actor_id:input.actorId || null,
        p_metadata:input.metadata || {}
      }
    );

    if (error) throw new Error(String(
      error.message || error.code || 'ACCOUNTING_GROUP_SAVE_FAILED'
    ));

    return Array.isArray(data) ? data[0] : data;
  }

  async linkIntercompany(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_link_intercompany',
      {
        p_group_id:requiredText(input.groupId,'ACCOUNTING_GROUP_REQUIRED'),
        p_accounting_entity_id:requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_journal_line_id:requiredText(
          input.journalLineId,
          'ACCOUNTING_JOURNAL_LINE_REQUIRED'
        ),
        p_counterparty_accounting_entity_id:requiredText(
          input.counterpartyAccountingEntityId,
          'INTERCOMPANY_COUNTERPARTY_REQUIRED'
        ),
        p_pair_key:requiredText(input.pairKey,'INTERCOMPANY_PAIR_KEY_REQUIRED'),
        p_intercompany_class:requiredText(
          input.intercompanyClass,
          'INTERCOMPANY_CLASS_REQUIRED'
        ),
        p_actor_id:input.actorId || null,
        p_metadata:input.metadata || {}
      }
    );

    if (error) throw new Error(String(
      error.message || error.code || 'INTERCOMPANY_LINK_SAVE_FAILED'
    ));

    return Array.isArray(data) ? data[0] : data;
  }

  async groupMembers(groupId) {
    const id = requiredText(groupId,'ACCOUNTING_GROUP_REQUIRED');

    const { data:group, error:groupError } = await this.supabase
      .from('accounting_groups')
      .select('id,parent_accounting_entity_id,code,name,presentation_currency,status')
      .eq('id',id)
      .eq('status','active')
      .maybeSingle();

    if (groupError) throw new Error(String(
      groupError.message || 'ACCOUNTING_GROUP_READ_FAILED'
    ));
    if (!group) throw new Error('ACCOUNTING_GROUP_NOT_FOUND');

    const { data:members, error:memberError } = await this.supabase
      .from('accounting_group_members')
      .select('group_id,accounting_entity_id,role,ownership_pct,effective_from,effective_to,status')
      .eq('group_id',id)
      .eq('status','active');

    if (memberError) throw new Error(String(
      memberError.message || 'ACCOUNTING_GROUP_MEMBERS_READ_FAILED'
    ));

    return { group, members:members || [] };
  }

  async consolidationSource(input = {}) {
    const groupId = requiredText(input.groupId,'ACCOUNTING_GROUP_REQUIRED');

    const { data, error } = await this.supabase.rpc(
      'accounting_group_consolidation_source',
      {
        p_group_id:groupId,
        p_from:input.from || null,
        p_to:input.to || null
      }
    );

    if (error) throw new Error(String(
      error.message || error.code || 'ACCOUNTING_CONSOLIDATION_SOURCE_FAILED'
    ));

    const source = Array.isArray(data) ? data[0] : data;
    if (!source || typeof source !== 'object') {
      throw new Error('ACCOUNTING_CONSOLIDATION_SOURCE_INVALID');
    }

    return source;
  }

  async engineInput(input = {}) {
    const source = await this.consolidationSource(input);
    const members = array(source.members || [],'ACCOUNTING_GROUP_MEMBERS_INVALID');
    const balanceRows = array(source.balance_rows || [],'ACCOUNTING_GROUP_BALANCE_ROWS_INVALID');
    const periodRows = array(source.period_rows || [],'ACCOUNTING_GROUP_PERIOD_ROWS_INVALID');
    const links = array(source.intercompany_links || [],'ACCOUNTING_GROUP_INTERCOMPANY_LINKS_INVALID');

    const nciOverrides = new Map(
      array(input.nciOverrides || [],'ACCOUNTING_GROUP_NCI_OVERRIDES_ARRAY_REQUIRED')
        .map(row=>[
          String(row.accounting_entity_id || row.accountingEntityId || '').trim(),
          {
            equity:finite(row.equity,'ACCOUNTING_GROUP_NCI_EQUITY_INVALID'),
            period_income:finite(
              row.period_income ?? row.periodIncome,
              'ACCOUNTING_GROUP_NCI_PERIOD_INCOME_INVALID'
            )
          }
        ])
    );

    const entities = members.map(member=>{
      const id = String(member.entity_id || member.accounting_entity_id || '').trim();
      const ownershipPct = Number(member.ownership_pct);
      const entity = {
        id,
        role:member.role,
        ownership_pct:ownershipPct,
        balance_rows:balanceRows
          .filter(row=>String(row.entity_id)===id)
          .map(row=>({
            account_code:row.account_code,
            account_name:row.account_name,
            account_type:row.account_type,
            debit:Number(row.debit || 0),
            credit:Number(row.credit || 0)
          })),
        period_rows:periodRows
          .filter(row=>String(row.entity_id)===id)
          .map(row=>({
            account_code:row.account_code,
            account_name:row.account_name,
            account_type:row.account_type,
            debit:Number(row.debit || 0),
            credit:Number(row.credit || 0)
          }))
      };

      if (member.role === 'subsidiary' && ownershipPct < 100) {
        const nci = nciOverrides.get(id);
        if (nci) entity.nci = nci;
      }

      return entity;
    });

    const byPair = new Map();
    for (const link of links) {
      const key = String(link.pair_key || '').trim();
      if (!key) throw new Error('INTERCOMPANY_PAIR_KEY_MISSING');
      if (!byPair.has(key)) byPair.set(key,[]);
      byPair.get(key).push(link);
    }

    const intercompanyPairs = [];
    for (const [pairKey,rows] of byPair.entries()) {
      const mapped = eliminationAccounts(rows,pairKey);
      intercompanyPairs.push({
        id:pairKey,
        ...mapped
      });
    }

    return {
      group:source.group,
      engine_input:{
        entities,
        intercompany_pairs:intercompanyPairs,
        adjustments:Array.isArray(input.adjustments) ? input.adjustments : [],
        match_tolerance:input.matchTolerance ?? 0.01
      }
    };
  }
}

module.exports = {
  lineAmount,
  eliminationAccounts,
  SupabaseAccountingConsolidationStore
};
