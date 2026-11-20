'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {approvedPrices,selectedProduct,verifiedSubscriptionData}=require('../../lib/hr/stripe-programs.cjs');
const env={STRIPE_COMPANY_PRICE_HR:'price_hr_001',STRIPE_COMPANY_PRICE_CRM:'price_crm_001',STRIPE_COMPANY_PRICE_SUITE:'price_suite_001'};
const owner='10000000-0000-4000-8000-000000000001';
const subscription={id:'sub_hr_001',status:'active',current_period_end:Math.floor(Date.now()/1000)+86400,
 metadata:{bonds_owner_id:owner,bonds_program_code:'hr'},items:{data:[{price:{id:'price_hr_001'},quantity:1}]}};
test('checkout only selects reviewed server-side program prices',()=>{
 assert.deepEqual(selectedProduct('hr',env),{product:'hr',priceId:'price_hr_001'});
 assert.throws(()=>selectedProduct('finance',env),/Unapproved/);
 assert.throws(()=>selectedProduct('hr',{...env,STRIPE_COMPANY_PRICE_HR:'price_suite_001'}),/ambiguous/);
 assert.throws(()=>approvedPrices({}),/missing/);
});
test('signed event may provision only an exact one-item approved subscription',()=>{
 const data=verifiedSubscriptionData(subscription,env);
 assert.equal(data.owner,owner);assert.equal(data.product,'hr');assert.equal(data.status,'active');
 for(const changed of [
  {...subscription,metadata:{...subscription.metadata,bonds_program_code:'crm'}},
  {...subscription,items:{data:[{price:{id:'price_other'},quantity:1}]}},
  {...subscription,items:{data:[{price:{id:'price_hr_001'},quantity:2}]}},
  {...subscription,metadata:{...subscription.metadata,bonds_owner_id:'not-a-uuid'}},
  {...subscription,status:'free'}
 ]) assert.throws(()=>verifiedSubscriptionData(changed,env));
});
test('do not open entitlement on expired or unknown payment period',()=>{
 assert.throws(()=>verifiedSubscriptionData({...subscription,current_period_end:1},env),/future period/);
 assert.throws(()=>verifiedSubscriptionData({...subscription,current_period_end:null,items:{data:[{price:{id:'price_hr_001'},quantity:1}]}},env),/future period/);
 const inactive=verifiedSubscriptionData({...subscription,status:'canceled',current_period_end:null},env);
 assert.equal(inactive.status,'canceled');
 assert.equal(inactive.periodEnd,null);
});
