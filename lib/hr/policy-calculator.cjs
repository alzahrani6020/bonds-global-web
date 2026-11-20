'use strict';
/**
 * HR policy calculator. A company's approved, effective-dated policy is mandatory.
 * This module does not assert that any policy is legally compliant.
 * No automatic payroll/payment, no implied country-specific rates.
 */
function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(label + ' must be finite');
  return value;
}
function isoDate(value,label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(label + ' must be YYYY-MM-DD');
  const time=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value) throw new TypeError(label+' is invalid');
  return time;
}
function assertPolicy(policy,date,jurisdiction) {
  if(!policy||policy.status!=='approved'||typeof policy.id!=='string'||!policy.id.trim())
    throw new Error('Approved policy identifier is required');
  if(!policy.jurisdiction||policy.jurisdiction!==jurisdiction) throw new Error('Policy jurisdiction mismatch');
  if(!policy.effective_from||isoDate(policy.effective_from,'effective_from')>date)
    throw new Error('Policy not yet effective');
  if(policy.effective_to&&isoDate(policy.effective_to,'effective_to')<date)
    throw new Error('Policy expired');
  return policy;
}
function roundHalfUp(value,decimals) {
  if(!Number.isFinite(value)||value<0) throw new RangeError('Calculated amount must be nonnegative');
  const factor=10**decimals;
  return Math.round((value+Number.EPSILON)*factor)/factor;
}
function computeAccrual(input) {
  const date=isoDate(input.as_of,'as_of');
  const policy=assertPolicy(input.policy,date,input.jurisdiction);
  const days=finiteNumber(input.eligible_days,'eligible_days');
  if(!Number.isInteger(days)||days<0)throw new RangeError('eligible_days must be nonnegative integer');
  const yearDays=finiteNumber(policy.accrual_year_days,'accrual_year_days');
  const annualDays=finiteNumber(policy.annual_leave_days,'annual_leave_days');
  if(yearDays<=0||!Number.isInteger(yearDays)||annualDays<0||annualDays>366)
   throw new RangeError('Invalid approved accrual rule');
  // This is a draft accrual; approved used leave is deducted separately.
  const accrued=roundHalfUp(days*annualDays/yearDays,4);
  return {policy_id:policy.id,as_of:input.as_of,jurisdiction:input.jurisdiction,
    eligible_days:days,accrued_days:accrued,unit:'days',status:'draft_review_required'};
}
function computeEndOfService(input) {
  const end=isoDate(input.end_date,'end_date'),start=isoDate(input.start_date,'start_date');
  if(end<start)throw new RangeError('end_date precedes start_date');
  const policy=assertPolicy(input.policy,end,input.jurisdiction);
  const daily=finiteNumber(input.eligible_daily_wage,'eligible_daily_wage');
  if(daily<0)throw new RangeError('eligible_daily_wage cannot be negative');
  if(!Array.isArray(policy.service_tiers)||!policy.service_tiers.length)
   throw new Error('Approved service_tiers required');
  const dayMs=86400000, serviceDays=Math.floor((end-start)/dayMs);
  let remaining=serviceDays,prior=0,total=0;
  for(const tier of policy.service_tiers){
    const through=finiteNumber(tier.through_days,'through_days');
    const multiplier=finiteNumber(tier.wage_days_per_service_day,'wage_days_per_service_day');
    if(!Number.isInteger(through)||through<=prior||multiplier<0||multiplier>365)
      throw new RangeError('Invalid tier order or multiplier');
    const span=Math.min(remaining,through-prior);
    if(span>0){total+=span*multiplier*daily;remaining-=span;}
    prior=through;
  }
  if(remaining>0)throw new Error('Policy does not cover full service period');
  const currency=input.currency;
  if(typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency))
    throw new TypeError('ISO currency required');
  return {policy_id:policy.id,jurisdiction:input.jurisdiction,currency,
   service_days:serviceDays,amount:roundHalfUp(total,2),status:'draft_review_required'};
}
module.exports={computeAccrual,computeEndOfService};
