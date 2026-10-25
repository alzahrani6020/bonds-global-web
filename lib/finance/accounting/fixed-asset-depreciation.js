'use strict';

const crypto = require('crypto');
const { AccountingPolicyRegistry } = require('./accounting-policy');
const { postFinancialEvent } = require('./posting-engine');

function money(value, code) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(code);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

function isoDate(value, code) {
  const text = requiredText(value, code);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(text)) throw new Error(code);
  return text;
}

function monthIndex(dateText) {
  const [y,m] = dateText.split('-').map(Number);
  return y * 12 + (m - 1);
}

function straightLineMonthlyDepreciation({ acquisitionCost, residualValue = 0, usefulLifeMonths } = {}) {
  const cost = money(acquisitionCost, 'FIXED_ASSET_ACQUISITION_COST_INVALID');
  const residual = money(residualValue, 'FIXED_ASSET_RESIDUAL_VALUE_INVALID');
  const life = Number(usefulLifeMonths);
  if (!Number.isInteger(life) || life <= 0) throw new Error('FIXED_ASSET_USEFUL_LIFE_INVALID');
  if (residual > cost) throw new Error('FIXED_ASSET_RESIDUAL_EXCEEDS_COST');
  return money((cost - residual) / life, 'FIXED_ASSET_MONTHLY_DEPRECIATION_INVALID');
}

function buildDepreciationAccrual({ profile, asset, periodEnd } = {}) {
  if (!profile || !asset) throw new Error('FIXED_ASSET_PROFILE_AND_ASSET_REQUIRED');
  const accountingEntityId = requiredText(profile.accounting_entity_id || asset.accounting_entity_id, 'FIXED_ASSET_ACCOUNTING_ENTITY_REQUIRED');
  if (asset.accounting_entity_id && asset.accounting_entity_id !== accountingEntityId) throw new Error('FIXED_ASSET_ENTITY_MISMATCH');
  const assetId = requiredText(asset.id, 'FIXED_ASSET_ID_REQUIRED');
  const assetNumber = requiredText(asset.asset_number, 'FIXED_ASSET_NUMBER_REQUIRED');
  const inServiceDate = isoDate(profile.in_service_date, 'FIXED_ASSET_IN_SERVICE_DATE_INVALID');
  const endDate = isoDate(periodEnd, 'FIXED_ASSET_PERIOD_END_INVALID');
  const life = Number(profile.useful_life_months);
  if (!Number.isInteger(life) || life <= 0) throw new Error('FIXED_ASSET_USEFUL_LIFE_INVALID');
  const startMonth = monthIndex(inServiceDate);
  const endMonth = monthIndex(endDate);
  if (endMonth < startMonth) throw new Error('FIXED_ASSET_PERIOD_BEFORE_SERVICE');
  const elapsedMonths = Math.min(life, endMonth - startMonth + 1);
  const monthly = straightLineMonthlyDepreciation({ acquisitionCost:asset.acquisition_cost, residualValue:profile.residual_value, usefulLifeMonths:life });
  const depreciableBase = money(Number(asset.acquisition_cost) - Number(profile.residual_value || 0), 'FIXED_ASSET_DEPRECIABLE_BASE_INVALID');
  const accumulated = Math.min(depreciableBase, money(monthly * elapsedMonths, 'FIXED_ASSET_ACCUMULATED_DEPRECIATION_INVALID'));
  return {
    accounting_entity_id:accountingEntityId,
    asset_id:assetId,
    asset_number:assetNumber,
    period_end:endDate,
    monthly_depreciation:monthly,
    elapsed_months:elapsedMonths,
    accumulated_depreciation:accumulated,
    carrying_amount:money(Number(asset.acquisition_cost) - accumulated, 'FIXED_ASSET_CARRYING_AMOUNT_INVALID'),
    fully_depreciated:elapsedMonths >= life
  };
}

function createDepreciationPolicy(profile = {}) {
  const expenseCode = requiredText(profile.depreciation_expense_account_code, 'FIXED_ASSET_EXPENSE_ACCOUNT_REQUIRED');
  const accumulatedCode = requiredText(profile.accumulated_depreciation_account_code, 'FIXED_ASSET_ACCUMULATED_ACCOUNT_REQUIRED');
  if (expenseCode === accumulatedCode) throw new Error('FIXED_ASSET_SAME_ACCOUNT_FORBIDDEN');
  return new AccountingPolicyRegistry([{
    event_type:'asset.depreciation_accrued',
    debit_account:{code:expenseCode,name:'Depreciation Expense'},
    credit_account:{code:accumulatedCode,name:'Accumulated Depreciation'},
    description:'Accrue fixed asset depreciation'
  }]);
}

function buildDepreciationEvent({ profile, asset, periodEnd, sourceSystem = 'fixed-assets' } = {}) {
  const accrual = buildDepreciationAccrual({profile,asset,periodEnd});
  const keyMaterial = [accrual.accounting_entity_id,accrual.asset_id,accrual.period_end,accrual.monthly_depreciation].join('|');
  const idempotencyKey = crypto.createHash('sha256').update(keyMaterial).digest('hex');
  return {
    id:'depreciation:' + accrual.asset_id + ':' + accrual.period_end,
    type:'asset.depreciation_accrued',
    accounting_entity_id:accrual.accounting_entity_id,
    amount:accrual.monthly_depreciation,
    currency:String(asset.currency || 'SAR').toUpperCase(),
    occurred_at:accrual.period_end + 'T23:59:59.000Z',
    effective_date:accrual.period_end,
    idempotency_key:idempotencyKey,
    source:{system:sourceSystem,record_id:accrual.asset_id + ':' + accrual.period_end},
    evidence:[{type:'fixed_asset_profile',asset_id:accrual.asset_id,asset_number:accrual.asset_number,period_end:accrual.period_end,method:'straight_line',elapsed_months:accrual.elapsed_months}]
  };
}

async function postDepreciation({ profile, asset, periodEnd, store } = {}) {
  const event = buildDepreciationEvent({profile,asset,periodEnd});
  const policyRegistry = createDepreciationPolicy(profile);
  return postFinancialEvent({event,store,policyRegistry});
}

module.exports = { straightLineMonthlyDepreciation, buildDepreciationAccrual, createDepreciationPolicy, buildDepreciationEvent, postDepreciation };