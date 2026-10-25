'use strict';

const { SupabaseLedgerReportingStore } = require('./supabase-ledger-reporting-store');
const { buildFinancialStatements } = require('./ledger-report-engine');
const { buildPosting } = require('./posting-engine');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value, code) {
  const out = String(value || '').trim();
  if (!UUID_RE.test(out)) throw new Error(code);
  return out;
}
function dateOnly(value, code) {
  const out = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out)) throw new Error(code);
  return out;
}
function positiveMoney(value, code) {
  const out = Number(value);
  if (!Number.isFinite(out) || out <= 0) throw new Error(code);
  return Math.round((out + Number.EPSILON) * 100) / 100;
}
function requestKey(value) {
  const out = String(value || '').trim();
  if (!out || out.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(out)) throw new Error('FINANCE_REFUND_REQUEST_KEY_INVALID');
  return out;
}

class FinanceWorkspaceService {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function' || typeof supabase.rpc !== 'function') throw new Error('FINANCE_WORKSPACE_DATABASE_REQUIRED');
    this.supabase = supabase;
  }
  async assertEntityAccess(userId, accountingEntityId) {
    const user = uuid(userId, 'FINANCE_WORKSPACE_USER_INVALID');
    const entityId = uuid(accountingEntityId, 'ACCOUNTING_ENTITY_REQUIRED');
    const [membershipResult, entityResult] = await Promise.all([
      this.supabase.from('accounting_entity_members').select('accounting_entity_id,user_id,role,status').eq('accounting_entity_id', entityId).eq('user_id', user).eq('status', 'active').maybeSingle(),
      this.supabase.from('accounting_entities').select('id,name,base_currency,status').eq('id', entityId).eq('status', 'active').maybeSingle()
    ]);
    if (membershipResult.error || entityResult.error) throw new Error(String(membershipResult.error?.message || entityResult.error?.message || 'FINANCE_WORKSPACE_ACCESS_LOOKUP_FAILED'));
    if (!membershipResult.data || !entityResult.data) throw new Error('ACCOUNTING_ENTITY_ACCESS_DENIED');
    return { membership: membershipResult.data, entity: entityResult.data };
  }
  async overview({ userId, accountingEntityId, from, to } = {}) {
    const access = await this.assertEntityAccess(userId, accountingEntityId);
    const today = new Date().toISOString().slice(0, 10);
    const startsOn = dateOnly(from || today.slice(0,4) + '-01-01', 'FINANCE_WORKSPACE_FROM_DATE_INVALID');
    const endsOn = dateOnly(to || today, 'FINANCE_WORKSPACE_TO_DATE_INVALID');
    if (startsOn > endsOn) throw new Error('FINANCE_WORKSPACE_DATE_RANGE_INVALID');
    const ledgerStore = new SupabaseLedgerReportingStore(this.supabase);
    const statements = buildFinancialStatements(await ledgerStore.statementRows({ accountingEntityId: access.entity.id, startsOn, endsOn }));
    const [refundsRes,reconciliationRes,collectionsRes,contractsRes,exceptionsRes] = await Promise.all([
      this.supabase.from('finance_refunds').select('*').eq('accounting_entity_id', access.entity.id).order('created_at',{ascending:false}).limit(200),
      this.supabase.from('finance_reconciliation_items').select('*').eq('accounting_entity_id', access.entity.id).order('created_at',{ascending:false}).limit(200),
      this.supabase.from('finance_collections').select('*').eq('accounting_entity_id', access.entity.id).order('due_date',{ascending:true}).limit(200),
      this.supabase.from('finance_contracts').select('*').eq('accounting_entity_id', access.entity.id).order('end_date',{ascending:true}).limit(200),
      this.supabase.from('finance_revenue_exceptions').select('*').eq('accounting_entity_id', access.entity.id).order('created_at',{ascending:false}).limit(200)
    ]);
    for (const result of [refundsRes,reconciliationRes,collectionsRes,contractsRes,exceptionsRes]) if (result.error) throw new Error(String(result.error.message || 'FINANCE_WORKSPACE_OPERATIONAL_READ_FAILED'));
    const trial = statements.trial_balance.period;
    return {
      success:true,
      accountingEntity:access.entity,
      period:{from:startsOn,to:endsOn},
      summary:{
        totalAssets:statements.balance_sheet.total_assets,
        totalLiabilities:statements.balance_sheet.total_liabilities,
        totalEquity:statements.balance_sheet.total_equity,
        revenue:statements.income_statement.revenue,
        expenses:statements.income_statement.expenses,
        netIncome:statements.income_statement.net_income,
        trialBalanceDifference:trial.difference,
        trialBalanceBalanced:trial.ok
      },
      trialBalance:trial,
      refunds:refundsRes.data||[],
      reconciliation:reconciliationRes.data||[],
      collections:collectionsRes.data||[],
      contracts:contractsRes.data||[],
      revenueExceptions:exceptionsRes.data||[]
    };
  }
  async createRefundRequest({ userId, accountingEntityId, sourceFinancialEventId, amount, reason, requestKey:key } = {}) {
    const access = await this.assertEntityAccess(userId, accountingEntityId);
    const sourceEventId = uuid(sourceFinancialEventId, 'FINANCE_REFUND_SOURCE_EVENT_INVALID');
    const refundAmount = positiveMoney(amount, 'FINANCE_REFUND_AMOUNT_INVALID');
    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) throw new Error('FINANCE_REFUND_REASON_REQUIRED');
    const { data, error } = await this.supabase.rpc('finance_create_refund_request',{
      p_accounting_entity_id:access.entity.id,
      p_source_financial_event_id:sourceEventId,
      p_amount:refundAmount,
      p_reason:normalizedReason,
      p_request_key:requestKey(key),
      p_requested_by:uuid(userId,'FINANCE_WORKSPACE_USER_INVALID')
    });
    if (error) throw new Error(String(error.message || error.code || 'FINANCE_REFUND_CREATE_FAILED'));
    if (!data?.refund) throw new Error('FINANCE_REFUND_CREATE_FAILED');
    return { refund:data.refund, replayed:data.state==='replayed' };
  }
  async completeRefund({ userId, refund, actorId } = {}) {
    if (!refund || typeof refund !== 'object') throw new Error('FINANCE_REFUND_REQUIRED');
    const access = await this.assertEntityAccess(userId, refund.accounting_entity_id);
    const posting = buildPosting({
      type:'refund.completed',
      accounting_entity_id:access.entity.id,
      effective_date:new Date().toISOString(),
      amount:positiveMoney(refund.amount,'FINANCE_REFUND_AMOUNT_INVALID'),
      currency:refund.currency,
      source:{system:'finance_refunds',record_id:refund.id},
      payload:{source_payment_event_id:refund.source_financial_event_id}
    });
    const { data, error } = await this.supabase.rpc('finance_complete_refund',{
      p_refund_id:uuid(refund.id,'FINANCE_REFUND_ID_INVALID'),
      p_actor_id:uuid(actorId,'FINANCE_WORKSPACE_USER_INVALID'),
      p_event:posting.event,
      p_posting:posting
    });
    if (error) throw new Error(String(error.message || error.code || 'FINANCE_REFUND_COMPLETE_FAILED'));
    if (!data?.refund) throw new Error('FINANCE_REFUND_COMPLETE_FAILED');
    return { refund:data.refund, replayed:data.state==='replayed' };
  }
}
module.exports={uuid,dateOnly,positiveMoney,requestKey,FinanceWorkspaceService};
