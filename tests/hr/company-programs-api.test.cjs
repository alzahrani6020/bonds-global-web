'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../api/company-programs.js'),'utf8');
const owner='10000000-0000-4000-8000-000000000001';
function fixture(eventType='customer.subscription.updated'){
 const calls={checkouts:[],rpc:[],signature:[],subscriptions:[]};
 const subscription={id:'sub_hr_001',status:'active',current_period_end:Math.floor(Date.now()/1000)+86400,
  metadata:{bonds_owner_id:owner,bonds_program_code:'hr'},
  items:{data:[{price:{id:'price_hr_001'},quantity:1}]}};
 const stripe={checkout:{sessions:{create:async args=>{calls.checkouts.push(args);return {id:'cs_test_1',url:'https://checkout.stripe.com/c/test'};}}},
  subscriptions:{retrieve:async id=>{calls.subscriptions.push(id);return subscription;}},
  invoices:{retrieve:async id=>({id,subscription:'sub_hr_001',currency:'sar',status:'paid',amount_due:10000,amount_paid:10000,status_transitions:{paid_at:Math.floor(Date.now()/1000)}})},
  webhooks:{constructEvent:(raw,sig,secret)=>{calls.signature.push({raw,sig,secret});if(sig!=='test-signed')throw Error('Invalid signature');
   return {id:'evt_hr_001',type:eventType,created:Math.floor(Date.now()/1000),data:{object:{id:eventType.startsWith('invoice.')?'in_hr_001':'sub_hr_001',subscription:'sub_hr_001'}}};}}};
 const modules={
  '../lib/api/auth-helper':{verifyBearerAndUser:async()=>({id:owner,email:'person@example.test',email_confirmed_at:'2026-01-01'})},
  '../lib/api/supabase':()=>({rpc:async(name,args)=>{calls.rpc.push({name,args});return {data:name==='company_program_record_stripe_invoice'?'recorded':'applied',error:null};}}),
  '../lib/api/cors':{setAllowedOrigin(){}},
  '../lib/api/rate-limit':{checkRateLimit:async()=>false},
  '../lib/hr/stripe-programs.cjs':require('../../lib/hr/stripe-programs.cjs'),
  'stripe':()=>stripe
 };
 const env={STRIPE_SECRET_KEY:'sk_mock_not_real',STRIPE_COMPANY_PROGRAM_WEBHOOK_SECRET:'whsec_mock',
  SUPABASE_SERVICE_ROLE_KEY:'test_mock_role',
  STRIPE_COMPANY_PRICE_HR:'price_hr_001',STRIPE_COMPANY_PRICE_CRM:'price_crm_001',STRIPE_COMPANY_PRICE_SUITE:'price_suite_001'};
 const m={exports:{}};
 vm.runInNewContext(source,{module:m,exports:m.exports,require:name=>{if(!modules[name])throw Error('unexpected dependency '+name);return modules[name];},
  process:{env},Buffer,URL,console},{filename:'company-programs.js'});
 async function call(action,body,headers={}){
  const res={statusCode:200,payload:null,headers:{},status(code){this.statusCode=code;return this;},
   setHeader(k,v){this.headers[k]=v;},json(obj){this.payload=obj;return this;},end(){return this;}};
  await m.exports({method:'POST',url:'/api/company-programs?action='+action,body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)),headers},res);
  return res;
 }
 return {call,calls,subscription,env};
}
test('checkout takes only server-approved product price and verified user',async()=>{
 const f=fixture();const response=await f.call('checkout',{product_code:'hr',priceId:'price_attacker'});
 assert.equal(response.statusCode,200);assert.equal(f.calls.checkouts[0].line_items[0].price,'price_hr_001');
 assert.equal(f.calls.checkouts[0].subscription_data.metadata.bonds_owner_id,owner);
 assert.equal(f.calls.rpc.length,0,'Starting checkout must never grant entitlement');
});
test('unknown program and missing server billing configuration fail closed',async()=>{
 const f=fixture();
 const denied=await f.call('checkout',{product_code:'finance'});
 assert.equal(denied.statusCode,400);assert.equal(f.calls.checkouts.length,0);
 delete f.env.STRIPE_COMPANY_PROGRAM_WEBHOOK_SECRET;
 const disabled=await f.call('checkout',{product_code:'hr'});
 assert.equal(disabled.statusCode,503);assert.equal(f.calls.checkouts.length,0);
});
test('unsigned webhook cannot grant entitlement',async()=>{
 const f=fixture();const denied=await f.call('webhook',{id:'evt_fake'}, {'stripe-signature':'forged'});
 assert.equal(denied.statusCode,400);assert.equal(f.calls.rpc.length,0);
});
test('valid signed webhook requires live subscription and atomic database RPC',async()=>{
 const f=fixture();const response=await f.call('webhook',{id:'evt_hr_001'}, {'stripe-signature':'test-signed'});
 assert.equal(response.statusCode,200);assert.equal(response.payload.result,'applied');
 assert.equal(f.calls.subscriptions[0],'sub_hr_001');
 assert.equal(f.calls.rpc.length,1);
 assert.equal(f.calls.rpc[0].args.p_product_code,'hr');
 assert.equal(f.calls.rpc[0].args.p_owner_user_id,owner);
 assert.equal(f.calls.rpc[0].args.p_price_id,'price_hr_001');
});

test('provider-verified invoice is stored only by server after subscription reconciliation',async()=>{
 const f=fixture('invoice.paid');const response=await f.call('webhook',{id:'in_hr_001'},{'stripe-signature':'test-signed'});
 assert.equal(response.statusCode,200);
 assert.equal(f.calls.rpc.length,2);
 assert.equal(f.calls.rpc[1].name,'company_program_record_stripe_invoice');
 assert.equal(f.calls.rpc[1].args.p_amount_paid_minor,10000);
 assert.equal(f.calls.rpc[1].args.p_currency,'SAR');
});
