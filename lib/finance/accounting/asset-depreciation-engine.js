'use strict';

const { normalizeFinancialEvent } = require('./financial-event');

function money(value, code = 'ASSET_DEPRECIATION_AMOUNT_INVALID') {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(code);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

function dateOnly(value, code) {
  const text = requiredText(value, code).slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text + 'T00:00:00Z'))) {
    throw new Error(code);
  }
  return text;
}

function monthOrdinal(date) {
  const [year, month] = date.slice(0,7).split('-').map(Number);
  return year * 12 + month - 1;
}

function lastOfMonth(month) {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 0)).toISOString().slice(0,10);
}

function normalizeCanonicalAsset(asset = {}) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    throw new Error('CANONICAL_ASSET_REQUIRED');
  }

  const acquisitionCost = money(asset.acquisition_cost, 'CANONICAL_ASSET_ACQUISITION_COST_INVALID');
  const residualValue = money(asset.residual_value, 'CANONICAL_ASSET_RESIDUAL_VALUE_INVALID');
  const usefulLifeMonths = Number(asset.useful_life_months);
  const accountingEntityId = requiredText(asset.accounting_entity_id, 'ACCOUNTING_ENTITY_REQUIRED');
  const id = requiredText(asset.id, 'CANONICAL_ASSET_ID_REQUIRED');
  const acquisitionDate = dateOnly(asset.acquisition_date, 'CANONICAL_ASSET_ACQUISITION_DATE_INVALID');
  const currency = String(asset.currency || '').trim().toUpperCase();

  if (acquisitionCost <= 0) throw new Error('CANONICAL_ASSET_ACQUISITION_COST_INVALID');
  if (residualValue < 0 || residualValue > acquisitionCost) {
    throw new Error('CANONICAL_ASSET_RESIDUAL_VALUE_INVALID');
  }
  if (!Number.isInteger(usefulLifeMonths) || usefulLifeMonths <= 0) {
    throw new Error('CANONICAL_ASSET_USEFUL_LIFE_INVALID');
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('CANONICAL_ASSET_CURRENCY_INVALID');
  if (String(asset.lifecycle_status || '') !== 'active') throw new Error('CANONICAL_ASSET_NOT_ACTIVE');

  return Object.freeze({
    id,
    accounting_entity_id:accountingEntityId,
    asset_number:String(asset.asset_number || id).trim(),
    name:String(asset.name || asset.asset_number || id).trim(),
    acquisition_date:acquisitionDate,
    acquisition_cost:acquisitionCost,
    residual_value:residualValue,
    useful_life_months:usefulLifeMonths,
    currency
  });
}

function normalizeProfile(profile = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('DEPRECIATION_PROFILE_REQUIRED');
  }
  const method = String(profile.depreciation_method || 'straight_line').trim();
  const convention = String(profile.depreciation_convention || 'full_month').trim();
  if (method !== 'straight_line') throw new Error('DEPRECIATION_METHOD_UNSUPPORTED');
  if (convention !== 'full_month') throw new Error('DEPRECIATION_CONVENTION_UNSUPPORTED');
  if (String(profile.status || '') !== 'active') throw new Error('DEPRECIATION_PROFILE_NOT_ACTIVE');

  return Object.freeze({
    id:requiredText(profile.id,'DEPRECIATION_PROFILE_ID_REQUIRED'),
    accounting_entity_id:requiredText(profile.accounting_entity_id,'ACCOUNTING_ENTITY_REQUIRED'),
    asset_id:requiredText(profile.asset_id,'CANONICAL_ASSET_ID_REQUIRED'),
    in_service_date:dateOnly(profile.in_service_date,'DEPRECIATION_IN_SERVICE_DATE_INVALID'),
    depreciation_method:method,
    depreciation_convention:convention,
    depreciation_expense_account_code:requiredText(
      profile.depreciation_expense_account_code,
      'DEPRECIATION_EXPENSE_ACCOUNT_CODE_REQUIRED'
    ),
    depreciation_expense_account_name:String(
      profile.depreciation_expense_account_name || profile.depreciation_expense_account_code
    ).trim(),
    accumulated_depreciation_account_code:requiredText(
      profile.accumulated_depreciation_account_code,
      'ACCUMULATED_DEPRECIATION_ACCOUNT_CODE_REQUIRED'
    ),
    accumulated_depreciation_account_name:String(
      profile.accumulated_depreciation_account_name || profile.accumulated_depreciation_account_code
    ).trim(),
    cost_center_id:profile.cost_center_id || null
  });
}

function normalizePeriod(period = {}) {
  const startsOn = dateOnly(period.starts_on,'ACCOUNTING_PERIOD_START_INVALID');
  const endsOn = dateOnly(period.ends_on,'ACCOUNTING_PERIOD_END_INVALID');
  if (startsOn.slice(8) !== '01' || endsOn !== lastOfMonth(startsOn.slice(0,7))) {
    throw new Error('DEPRECIATION_MONTHLY_PERIOD_REQUIRED');
  }
  return Object.freeze({
    id:requiredText(period.id,'ACCOUNTING_PERIOD_ID_REQUIRED'),
    period_code:String(period.period_code || startsOn.slice(0,7)).trim(),
    starts_on:startsOn,
    ends_on:endsOn,
    status:String(period.status || '').trim()
  });
}

function normalizeAssetAndProfile(asset, profile) {
  const canonical = normalizeCanonicalAsset(asset);
  const accounting = normalizeProfile(profile);

  if (canonical.accounting_entity_id !== accounting.accounting_entity_id ||
      canonical.id !== accounting.asset_id) {
    throw new Error('DEPRECIATION_PROFILE_ASSET_MISMATCH');
  }
  if (accounting.in_service_date < canonical.acquisition_date) {
    throw new Error('DEPRECIATION_SERVICE_DATE_INVALID');
  }
  return { canonical, accounting };
}

function buildStraightLineDepreciationSchedule({ asset, profile, periods = [] } = {}) {
  const { canonical, accounting } = normalizeAssetAndProfile(asset, profile);
  if (!Array.isArray(periods)) throw new Error('ACCOUNTING_PERIODS_ARRAY_REQUIRED');

  const basis = money(canonical.acquisition_cost - canonical.residual_value);
  const rawMonthly = basis / canonical.useful_life_months;
  const serviceMonth = monthOrdinal(accounting.in_service_date);

  const schedule = periods
    .map(normalizePeriod)
    .sort((a,b) => a.starts_on.localeCompare(b.starts_on))
    .map(period => {
      const index = monthOrdinal(period.starts_on) - serviceMonth;
      if (index < 0 || index >= canonical.useful_life_months) return null;

      const before = Math.min(basis, rawMonthly * index);
      const after = Math.min(basis, rawMonthly * (index + 1));
      const depreciation = money(after - before);
      const accumulated = money(after);
      const ending = money(canonical.acquisition_cost - accumulated);

      return Object.freeze({
        accounting_entity_id:canonical.accounting_entity_id,
        depreciation_profile_id:accounting.id,
        asset_id:canonical.id,
        period_id:period.id,
        period_code:period.period_code,
        period_status:period.status,
        effective_date:period.ends_on,
        month_index:index,
        depreciation_amount:depreciation,
        accumulated_depreciation:accumulated,
        ending_book_value:Math.max(canonical.residual_value, ending),
        status:'scheduled'
      });
    })
    .filter(Boolean);

  return {
    ok:true,
    asset:canonical,
    profile:accounting,
    depreciable_basis:basis,
    monthly_depreciation:money(rawMonthly),
    schedule,
    provenance:{
      asset_source:'bonds_assets',
      policy_source:'accounting_asset_depreciation_profiles',
      method:'straight_line',
      convention:'full_month',
      deterministic:true,
      ai_generated:false
    }
  };
}

function buildDepreciationPosting({ asset, profile, scheduleRow } = {}) {
  const { canonical, accounting } = normalizeAssetAndProfile(asset, profile);
  if (!scheduleRow || typeof scheduleRow !== 'object') {
    throw new Error('DEPRECIATION_SCHEDULE_ROW_REQUIRED');
  }
  if (scheduleRow.accounting_entity_id !== canonical.accounting_entity_id ||
      scheduleRow.asset_id !== canonical.id ||
      scheduleRow.depreciation_profile_id !== accounting.id) {
    throw new Error('DEPRECIATION_SCHEDULE_ASSET_MISMATCH');
  }
  if (String(scheduleRow.period_status || '') !== 'open') {
    throw new Error('ACCOUNTING_PERIOD_NOT_OPEN');
  }

  const scheduleId = requiredText(scheduleRow.id,'DEPRECIATION_SCHEDULE_ID_REQUIRED');
  const periodId = requiredText(scheduleRow.period_id,'ACCOUNTING_PERIOD_ID_REQUIRED');
  const effectiveDate = dateOnly(scheduleRow.effective_date,'DEPRECIATION_EFFECTIVE_DATE_INVALID');
  const amount = money(scheduleRow.depreciation_amount);
  if (amount <= 0) throw new Error('DEPRECIATION_AMOUNT_INVALID');

  const event = normalizeFinancialEvent({
    type:'asset.depreciation.recorded',
    accounting_entity_id:canonical.accounting_entity_id,
    occurred_at:effectiveDate + 'T23:59:59Z',
    effective_date:effectiveDate + 'T23:59:59Z',
    amount,
    currency:canonical.currency,
    source:{system:'accounting_asset_depreciation',record_id:scheduleId},
    payload:{
      asset_id:canonical.id,
      depreciation_profile_id:accounting.id,
      period_id:periodId,
      schedule_id:scheduleId,
      method:accounting.depreciation_method,
      convention:accounting.depreciation_convention
    },
    evidence:[]
  });

  const dimensions = accounting.cost_center_id
    ? {cost_center_id:accounting.cost_center_id}
    : {};

  return {
    schedule_id:scheduleId,
    event,
    posting:{
      description:'Depreciation - ' + canonical.asset_number + ' - ' + scheduleRow.period_code,
      subledger:{code:'asset.depreciation',source_record_id:scheduleId},
      journal:{
        total_debit:amount,
        total_credit:amount,
        lines:[
          {
            line_no:1,
            account_code:accounting.depreciation_expense_account_code,
            account_name:accounting.depreciation_expense_account_name,
            debit:amount,
            credit:0,
            dimensions
          },
          {
            line_no:2,
            account_code:accounting.accumulated_depreciation_account_code,
            account_name:accounting.accumulated_depreciation_account_name,
            debit:0,
            credit:amount,
            dimensions
          }
        ]
      }
    }
  };
}

module.exports={
  money,
  normalizeCanonicalAsset,
  normalizeProfile,
  normalizePeriod,
  buildStraightLineDepreciationSchedule,
  buildDepreciationPosting
};
