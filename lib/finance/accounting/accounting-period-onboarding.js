'use strict';

function requiredIsoDate(value, code) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(code);
  const date = new Date(text + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== text) {
    throw new Error(code);
  }
  return date;
}

function iso(date) {
  return date.toISOString().slice(0,10);
}

function monthEnd(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function buildMonthlyAccountingPeriods(startValue, endValue) {
  const start = requiredIsoDate(startValue, 'ACCOUNTING_PERIOD_START_INVALID');
  const end = requiredIsoDate(endValue, 'ACCOUNTING_PERIOD_END_INVALID');

  if (start.getUTCDate() !== 1) throw new Error('ACCOUNTING_PERIOD_START_NOT_MONTH_BOUNDARY');
  if (iso(monthEnd(end)) !== iso(end)) throw new Error('ACCOUNTING_PERIOD_END_NOT_MONTH_BOUNDARY');
  if (start > end) throw new Error('ACCOUNTING_PERIOD_RANGE_INVALID');

  const rows = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const periodStart = new Date(cursor);
    const periodEnd = monthEnd(cursor);
    if (periodEnd > end) throw new Error('ACCOUNTING_PERIOD_RANGE_NOT_MONTHLY');
    rows.push({
      period_code:`${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth()+1).padStart(2,'0')}`,
      starts_on:iso(periodStart),
      ends_on:iso(periodEnd),
      status:'open'
    });
    if (rows.length > 24) throw new Error('ACCOUNTING_PERIOD_RANGE_TOO_LARGE');
    cursor = new Date(Date.UTC(
      periodStart.getUTCFullYear(),
      periodStart.getUTCMonth() + 1,
      1
    ));
  }

  if (!rows.length) throw new Error('ACCOUNTING_PERIOD_RANGE_EMPTY');
  return rows;
}

async function ensureMonthlyAccountingPeriods(db, input = {}) {
  if (!db || typeof db.from !== 'function') {
    throw new Error('ACCOUNTING_PERIOD_DATABASE_REQUIRED');
  }
  const accountingEntityId = String(input.accountingEntityId || '').trim();
  const actorUserId = String(input.actorUserId || '').trim();
  if (!accountingEntityId) throw new Error('ACCOUNTING_ENTITY_REQUIRED');
  if (!actorUserId) throw new Error('ACCOUNTING_PERIOD_ACTOR_REQUIRED');

  const desired = buildMonthlyAccountingPeriods(input.startsOn, input.endsOn);
  const rangeStart = desired[0].starts_on;
  const rangeEnd = desired[desired.length - 1].ends_on;

  const { data:existing, error:readError } = await db
    .from('accounting_periods')
    .select('id,period_code,starts_on,ends_on,status')
    .eq('accounting_entity_id', accountingEntityId)
    .order('starts_on');

  if (readError) {
    throw new Error(String(readError.message || readError.code || 'ACCOUNTING_PERIOD_READ_FAILED'));
  }

  const all = existing || [];
  const overlaps = all.filter(row =>
    String(row.starts_on) <= rangeEnd && String(row.ends_on) >= rangeStart
  );

  if (overlaps.length) {
    const exact = desired.every(period =>
      overlaps.some(row =>
        row.period_code === period.period_code &&
        String(row.starts_on) === period.starts_on &&
        String(row.ends_on) === period.ends_on
      )
    ) && overlaps.every(row =>
      desired.some(period =>
        row.period_code === period.period_code &&
        String(row.starts_on) === period.starts_on &&
        String(row.ends_on) === period.ends_on
      )
    );

    if (!exact) throw new Error('ACCOUNTING_PERIOD_RANGE_CONFLICT');
    return {
      ok:true,
      state:'replayed',
      accounting_entity_id:accountingEntityId,
      period_count:overlaps.length,
      periods:overlaps
    };
  }

  const rows = desired.map(period => ({
    accounting_entity_id:accountingEntityId,
    ...period,
    metadata:{
      source:'accounting_period_onboarding',
      initialized_by:actorUserId
    }
  }));

  const { data, error } = await db
    .from('accounting_periods')
    .insert(rows)
    .select('id,period_code,starts_on,ends_on,status');

  if (error) {
    throw new Error(String(error.message || error.code || 'ACCOUNTING_PERIOD_CREATE_FAILED'));
  }

  return {
    ok:true,
    state:'created',
    accounting_entity_id:accountingEntityId,
    period_count:(data || []).length,
    periods:data || []
  };
}

module.exports = {
  buildMonthlyAccountingPeriods,
  ensureMonthlyAccountingPeriods
};
