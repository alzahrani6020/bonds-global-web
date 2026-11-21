'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {computeAccrual,computeEndOfService}=require('../../lib/hr/policy-calculator.cjs');
const policy={id:'policy-reviewed-001',status:'approved',jurisdiction:'SA',effective_from:'2026-01-01',effective_to:'2026-12-31',annual_leave_days:30,accrual_year_days:365,
 service_tiers:[{through_days:365,wage_days_per_service_day:0.5/365},{through_days:3650,wage_days_per_service_day:1/365}]};
test('accrual references the approved, effective-dated policy, remains draft',()=>{
 assert.deepEqual(computeAccrual({policy,jurisdiction:'SA',as_of:'2026-11-17',eligible_days:365}),{
 policy_id:policy.id,jurisdiction:'SA',as_of:'2026-11-17',eligible_days:365,accrued_days:30,unit:'days',status:'draft_review_required'});
});
test('end-of-service tier arithmetic and identity, no payment is issued',()=>{
 const result=computeEndOfService({policy,jurisdiction:'SA',start_date:'2026-01-01',end_date:'2026-12-31',eligible_daily_wage:100,currency:'SAR'});
 assert.equal(result.service_days,364);
 assert.equal(result.amount,49.86);
 assert.equal(result.status,'draft_review_required');
 assert.equal(Object.hasOwn(result,'payment_id'),false);
});
test('reject missing, inactive, wrong-jurisdiction or expired policy',()=>{
 const draft={...policy,status:'draft'};
 for(const p of [null,draft,{...policy,jurisdiction:'EG'},{...policy,effective_to:'2026-01-01'}])
  assert.throws(()=>computeAccrual({policy:p,jurisdiction:'SA',as_of:'2026-11-17',eligible_days:30}));
});
test('reject invalid dates and negative, nonfinite, impossible figures',()=>{
 for(const date of ['2026-02-30','2026-13-01','17-11-2026'])
  assert.throws(()=>computeAccrual({policy,jurisdiction:'SA',as_of:date,eligible_days:10}));
 for(const days of [-1,1.5,NaN,Infinity])
  assert.throws(()=>computeAccrual({policy,jurisdiction:'SA',as_of:'2026-11-17',eligible_days:days}));
 assert.throws(()=>computeEndOfService({policy,jurisdiction:'SA',start_date:'2026-12-31',end_date:'2026-01-01',eligible_daily_wage:100,currency:'SAR'}));
 assert.throws(()=>computeEndOfService({policy:{...policy,service_tiers:[{through_days:30,wage_days_per_service_day:1}]},jurisdiction:'SA',start_date:'2026-01-01',end_date:'2026-12-31',eligible_daily_wage:100,currency:'SAR'}));
});
