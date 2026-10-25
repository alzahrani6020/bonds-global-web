'use strict';

const { normalizeFinancialEvent } = require('./financial-event');

function money(value, code = 'FIXED_ASSET_AMOUNT_INVALID') {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(code);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function textRequired(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

function dateOnly(value, code) {
  const text = textRequired(value, code).slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text + 'T00:00:00Z'))) {
    throw new Error(code);
  }
  return text;
}

function firstOfMonth(date) {
  return date.slice(0,7) + '-01';
}

function lastOfMonth(date) {
  const [year, month] = date.slice(0,7).split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0,10);
}

function monthOrdinal(date) {
  const [year, month] = date.slice(0,7).split('-').map(Number);
  return year * 12 + (month - 1);
}

function normalizeFixedAsset(asset = {}) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    throw new Error('FIXED_ASSET_OBJECT_REQUIRED');
  }

  const acquisitionCost = money(asset.acquisition_cost);
  const residualValue = money(asset.residual_value || 0);
  const usefulLifeMonths = Number(asset.useful_life_months);

  if (acquisitionCost <= 0) throw new Error('FIXED_ASSET_COST_INVALID');
  if (residualValue < 0 || residualValue > acquisitionCost) {
    throw new Error('FIXED_ASSET_RESIDUAL_INVALID');
  }
  if (!Number.isInteger(usefulLifeMonths) || usefulLifeMonths <= 0) {
    throw new Error('FIXED_ASSET_USEFUL_LIFE_INVALID');
  }

  const method = String(asset.depreciation_method || 'straight_line').trim();
  const convention = String(asset.depreciation_convention || 'full_month').trim();
  if (method !== 'straight_line') throw new Error('FIXED_ASSET_METHOD_UNSUPPORTED');
  if (convention !== 'full_month') throw new Error('FIXED_ASSET_CONVENTION_UNSUPPORTED');

  const acquisitionDate = dateOnly(asset.acquisition_date, 'FIXED_ASSET_ACQUISITION_DATE_INVALID');
  const inServiceDate = dateOnly(asset.in_service_date, 'FIXED_ASSET_IN_SERVICE_DATE_INVALID');
  if (inServiceDate < acquisitionDate) throw new Error('FIXED_ASSET_SERVICE_DATE_INVALID');

  const currency = String(asset.currency || 'SAR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('FIXED_ASSET_CURRENCY_INVALID');

  return Object.freeze({
    id:textRequired(asset.id,'FIXED_ASSET_ID_REQUIRED'),
    accounting_entity_id:textRequired(asset.accounting_entity_id,'ACCOUNTING_ENTITY_REQUIRED'),
    bonds_asset_id:asset.bonds_asset_id || null,
    asset_code:textRequired(asset.asset_code,'FIXED_ASSET_CODE_REQUIRED'),
    name:textRequired(asset.name,'FIXED_ASSET_NAME_REQUIRED'),
    acquisition_date:acquisitionDate,
    in_service_date:inServiceDate,
    acquisition_cost:acquisitionCost,
    residual_value:residualValue,
    useful_life_months:usefulLifeMonths,
    depreciation_method:method,
    depreciation_convention:convention,
    currency,
    depreciation_expense_account_code:textRequired(
      asset.depreciation_expense_account_code,
      'DEPRECIATION_EXPENSE_ACCOUNT_CODE_REQUIRED'
    ),
    depreciation_expense_account_name:String(
      asset.depreciation_expense_account_name || asset.depreciation_expense_account_code
    ).trim(),
    accumulated_depreciation_account_code:textRequired(
      asset.accumulated_depreciation_account_code,
      'ACCUMULATED_DEPRECIATION_ACCOUNT_CODE_REQUIRED'
    ),
    accumulated_depreciation_account_name:String(
      asset.accumulated_depreciation_account_name || asset.accumulated_depreciation_account_code
    ).trim(),
    cost_center_id:asset.cost_center_id || null
  });
}

function normalizePeriod(period = {}) {
  const startsOn = dateOnly(period.starts_on,'ACCOUNTING_PERIOD_START_INVALID');
  const endsOn = dateOnly(period.ends_on,'ACCOUNTING_PERIOD_END_INVALID');

  if (startsOn !== firstOfMonth(startsOn) || endsOn !== lastOfMonth(startsOn)) {
    throw new Error('DEPRECIATION_MONTHLY_PERIOD_REQUIRED');
  }

  return Object.freeze({
    id:textRequired(period.id,'ACCOUNTING_PERIOD_ID_REQUIRED'),
    period_code:String(period.period_code || '').trim() || startsOn.slice(0,7),
    starts_on:startsOn,
    ends_on:endsOn,
    status:String(period.status || '').trim() || null
  });
}

function buildStraightLineDepreciationSchedule({ asset, periods = [] } = {}) {
  const normalizedAsset = normalizeFixedAsset(asset);
  if (!Array.isArray(periods)) throw new Error('ACCOUNTING_PERIODS_ARRAY_REQUIRED');

  const basis = money(normalizedAsset.acquisition_cost - normalizedAsset.residual_value);
  const rawMonthly = basis / normalizedAsset.useful_life_months;
  const serviceOrdinal = monthOrdinal(normalizedAsset.in_service_date);

  const rows = periods
    .map(normalizePeriod)
    .sort((a,b) => a.starts_on.localeCompare(b.starts_on))
    .map(period => {
      const monthIndex = monthOrdinal(period.starts_on) - serviceOrdinal;
      if (monthIndex < 0 || monthIndex >= normalizedAsset.useful_life_months) return null;

      const accumulatedBefore = Math.min(basis, rawMonthly * monthIndex);
      const accumulatedAfter = Math.min(basis, rawMonthly * (monthIndex + 1));
      const depreciationAmount = money(accumulatedAfter - accumulatedBefore);
      const accumulated = money(accumulatedAfter);
      const endingBookValue = money(
        normalizedAsset.acquisition_cost - accumulated
      );

      return Object.freeze({
        accounting_entity_id:normalizedAsset.accounting_entity_id,
        fixed_asset_id:normalizedAsset.id,
        period_id:period.id,
        period_code:period.period_code,
        period_status:period.status,
        effective_date:period.ends_on,
        month_index:monthIndex,
        depreciation_amount:depreciationAmount,
        accumulated_depreciation:accumulated,
        ending_book_value:Math.max(normalizedAsset.residual_value, endingBookValue),
        status:'scheduled'
      });
    })
    .filter(Boolean);

  return {
    ok:true,
    asset:normalizedAsset,
    depreciable_basis:basis,
    monthly_depreciation:money(rawMonthly),
    schedule:rows,
    provenance:{
      source:'accounting_fixed_assets',
      method:'straight_line',
      convention:'full_month',
      deterministic:true,
      ai_generated:false
    }
  };
}

function buildDepreciationPosting({ asset, scheduleRow } = {}) {
  const normalizedAsset = normalizeFixedAsset(asset);
  if (!scheduleRow || typeof scheduleRow !== 'object') {
    throw new Error('DEPRECIATION_SCHEDULE_ROW_REQUIRED');
  }

  if (scheduleRow.accounting_entity_id !== normalizedAsset.accounting_entity_id ||
      scheduleRow.fixed_asset_id !== normalizedAsset.id) {
    throw new Error('DEPRECIATION_SCHEDULE_ASSET_MISMATCH');
  }
  if (String(scheduleRow.period_status || '') !== 'open') {
    throw new Error('ACCOUNTING_PERIOD_NOT_OPEN');
  }

  const amount = money(scheduleRow.depreciation_amount);
  if (amount <= 0) throw new Error('DEPRECIATION_AMOUNT_INVALID');

  const scheduleId = textRequired(scheduleRow.id,'DEPRECIATION_SCHEDULE_ID_REQUIRED');
  const periodId = textRequired(scheduleRow.period_id,'ACCOUNTING_PERIOD_ID_REQUIRED');
  const effectiveDate = dateOnly(scheduleRow.effective_date,'DEPRECIATION_EFFECTIVE_DATE_INVALID');

  const event = normalizeFinancialEvent({
    type:'asset.depreciation.recorded',
    accounting_entity_id:normalizedAsset.accounting_entity_id,
    occurred_at:effectiveDate + 'T23:59:59Z',
    effective_date:effectiveDate + 'T23:59:59Z',
    amount,
    currency:normalizedAsset.currency,
    source:{
      system:'accounting_fixed_assets',
      record_id:scheduleId
    },
    payload:{
      fixed_asset_id:normalizedAsset.id,
      period_id:periodId,
      schedule_id:scheduleId,
      bonds_asset_id:normalizedAsset.bonds_asset_id,
      method:normalizedAsset.depreciation_method,
      convention:normalizedAsset.depreciation_convention
    },
    evidence:[]
  });

  const dimensions = normalizedAsset.cost_center_id
    ? { cost_center_id:normalizedAsset.cost_center_id }
    : {};

  const posting = {
    description:'Depreciation - ' + normalizedAsset.asset_code + ' - ' + scheduleRow.period_code,
    subledger:{
      code:'asset.depreciation',
      source_record_id:scheduleId
    },
    journal:{
      total_debit:amount,
      total_credit:amount,
      lines:[
        {
          line_no:1,
          account_code:normalizedAsset.depreciation_expense_account_code,
          account_name:normalizedAsset.depreciation_expense_account_name,
          debit:amount,
          credit:0,
          dimensions
        },
        {
          line_no:2,
          account_code:normalizedAsset.accumulated_depreciation_account_code,
          account_name:normalizedAsset.accumulated_depreciation_account_name,
          debit:0,
          credit:amount,
          dimensions
        }
      ]
    }
  };

  return {
    schedule_id:scheduleId,
    event,
    posting
  };
}

module.exports = {
  money,
  normalizeFixedAsset,
  normalizePeriod,
  buildStraightLineDepreciationSchedule,
  buildDepreciationPosting
};
