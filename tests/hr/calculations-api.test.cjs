'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const original=fs.readFileSync(path.join(__dirname,'../../api/hr-calculations.js'),'utf8');
const owner='10000000-0000-4000-8000-000000000001';
const workspaceId='20000000-0000-4000-8000-000000000001';
const employeeId='20000000-0000-4000-8000-000000000002';
const policyId='20000000-0000-4000-8000-000000000003';
function fixture({employeeWorkspace=workspaceId,policyStatus='approved',userId=owner,brokenSave=false}={}){
 const writes=[],tables={
  hr_saas_workspaces:[{id:workspaceId,owner_user_id:owner}],
  hr_saas_employees:[{id:employeeId,workspace_id:employeeWorkspace}],
  hr_saas_rule_sets:[{id:policyId,workspace_id:workspaceId,jurisdiction:'SA',status:policyStatus,
   effective_from:'2026-01-01',effective_to:'2027-12-31',
   annual_leave_days:30,accrual_year_days:365,
   service_tiers:[{through_days:3650,wage_days_per_service_day:0.002}]}],
  hr_saas_calculation_drafts:[]
 };
 const from=(table)=>{
  if(!Object.hasOwn(tables,table))throw Error('Unexpected HR table '+table);
  let action='read',insert=null,filters=[];
  const builder={select(){return builder;},eq(k,v){filters.push(x=>x[k]===v);return builder;},
   insert(value){action='insert';insert=value;return builder;},
   async execute(single=false){
    let data=tables[table].filter(x=>filters.every(filter=>filter(x)));
    if(action==='insert'){
     if(brokenSave)return {data:null,error:{message:'blocked'}};
     const created={...insert,id:'20000000-0000-4000-8000-000000000008'};
     writes.push({table,record:created});tables[table].push(created);data=[created];
    }
    return {data:single?(data[0]||null):data,error:null};
   },
   single(){return builder.execute(true);},
   then(resolve,reject){return builder.execute().then(resolve,reject);}
  };
  return builder;
 };
 const modules={
  '@supabase/supabase-js':{createClient:()=>({from})},
  '../lib/api/auth-helper':{verifyBearerAndUser:async()=>({id:userId})},
  '../lib/api/rate-limit':{checkRateLimit:async()=>false},
  '../lib/api/cors':{setAllowedOrigin(){}},
  '../lib/hr/policy-calculator.cjs':require('../../lib/hr/policy-calculator.cjs')
 };
 const m={exports:{}};
 const env={NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon-test-only'};
 vm.runInNewContext(original,{module:m,exports:m.exports,require:key=>{if(!modules[key])throw Error('Unexpected require '+key);return modules[key];},
  process:{env},console,URL},{filename:'hr-calculations.js'});
 const body={workspace_id:workspaceId,employee_id:employeeId,policy_id:policyId,kind:'leave_accrual',
  inputs:{as_of:'2026-11-17',eligible_days:365}};
 async function call(override=body){
  const res={statusCode:200,payload:null,setHeader(){},status(x){this.statusCode=x;return this;},
   json(x){this.payload=x;return this;},end(){return this;}};
  await m.exports({method:'POST',url:'/api/hr-calculations',headers:{authorization:'Bearer mocked'},body:override},res);
  return res;
 }
 return {call,body,writes,tables};
}
test('owner can persist only draft computed from approved policy and same-tenant employee',async()=>{
 const f=fixture();const result=await f.call();
 assert.equal(result.statusCode,200);
 assert.equal(result.payload.status,'draft');
 assert.equal(result.payload.result.accrued_days,30);
 assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].table,'hr_saas_calculation_drafts');
 assert.equal(f.writes[0].record.result.status,'draft_review_required');
});
test('user must be owner; cross-workspace employee cannot be read or paid',async()=>{
 for(const config of [{userId:'90000000-0000-4000-8000-000000000005'},
   {employeeWorkspace:'90000000-0000-4000-8000-000000000005'}]){
  const f=fixture(config);const result=await f.call();
  assert.equal(result.statusCode,403);assert.equal(f.writes.length,0);
 }
});
test('unapproved rule and invalid service inputs fail without a stored record',async()=>{
 const draft=fixture({policyStatus:'draft'});
 assert.equal((await draft.call()).statusCode,422);
 assert.equal(draft.writes.length,0);
 const invalid=fixture();
 assert.equal((await invalid.call({...invalid.body,inputs:{...invalid.body.inputs,eligible_days:-3}})).statusCode,422);
 assert.equal(invalid.writes.length,0);
});
test('database insert errors never result in apparent calculation success',async()=>{
 const f=fixture({brokenSave:true});const res=await f.call();
 assert.equal(res.statusCode,503);assert.equal(f.writes.length,0);
});
