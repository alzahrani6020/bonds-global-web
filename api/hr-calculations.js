'use strict';
/**
 * Draft-only HR entitlement calculator. Policy and employee must be readable by
 * this authenticated company owner through RLS. No rate is defaulted and no
 * payroll, bank disbursement or statutory submission is triggered.
 */
const {createClient}=require('@supabase/supabase-js');
const {verifyBearerAndUser}=require('../lib/api/auth-helper');
const {checkRateLimit}=require('../lib/api/rate-limit');
const {setAllowedOrigin}=require('../lib/api/cors');
const {computeAccrual,computeEndOfService}=require('../lib/hr/policy-calculator.cjs');
module.exports=async function handler(req,res){
 setAllowedOrigin(res,req);
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  if(await checkRateLimit('auth',req,res))return;
  const user=await verifyBearerAndUser(req);
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body))
   return res.status(400).json({error:'JSON object required'});
  const {workspace_id,employee_id,policy_id,kind,inputs}=body;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(![workspace_id,employee_id,policy_id].every(x=>typeof x==='string'&&uuid.test(x))||
   !['leave_accrual','end_of_service'].includes(kind)||!inputs||
   typeof inputs!=='object'||Array.isArray(inputs))
   return res.status(400).json({error:'Invalid HR calculation input'});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
  if(!url||!key)throw new Error('User-scoped database not configured');
  const db=createClient(url,key,{global:{headers:{Authorization:req.headers.authorization}}});
  const {data:workspace,error:workspaceError}=await db.from('hr_saas_workspaces')
   .select('id,owner_user_id').eq('id',workspace_id).single();
  if(workspaceError||workspace?.owner_user_id!==user.id)
   return res.status(403).json({error:'HR workspace access denied'});
  const {data:employee,error:employeeError}=await db.from('hr_saas_employees')
   .select('id').eq('workspace_id',workspace_id).eq('id',employee_id).single();
  if(employeeError||!employee)
   return res.status(403).json({error:'Employee is not available in this workspace'});
  const {data:policy,error:policyError}=await db.from('hr_saas_rule_sets')
   .select('id,jurisdiction,status,effective_from,effective_to,annual_leave_days,accrual_year_days,service_tiers')
   .eq('id',policy_id).eq('workspace_id',workspace_id).eq('status','approved').single();
  if(policyError||!policy)return res.status(422).json({error:'Approved effective HR policy required'});
  const reviewedPolicy={...policy,annual_leave_days:Number(policy.annual_leave_days),
   accrual_year_days:Number(policy.accrual_year_days)};
  const calculation=kind==='leave_accrual'?
   computeAccrual({policy:reviewedPolicy,jurisdiction:policy.jurisdiction,
    as_of:inputs.as_of,eligible_days:inputs.eligible_days}):
   computeEndOfService({policy:reviewedPolicy,jurisdiction:policy.jurisdiction,
    start_date:inputs.start_date,end_date:inputs.end_date,
    eligible_daily_wage:inputs.eligible_daily_wage,currency:inputs.currency});
  const {data:saved,error:saveError}=await db.from('hr_saas_calculation_drafts').insert({
   workspace_id,employee_id,policy_id,kind,jurisdiction:policy.jurisdiction,
   inputs,result:calculation,status:'draft',created_by:user.id
  }).select('id').single();
  if(saveError||!saved?.id)throw new Error('HR calculation draft could not be stored');
  return res.status(200).json({id:saved.id,result:calculation,policy_id,status:'draft'});
 }catch(error){
  if(error?.status===401||error?.status===403)
   return res.status(error.status).json({error:'Unauthorized'});
  if(error instanceof RangeError||error instanceof TypeError)
   return res.status(422).json({error:'Invalid calculation inputs'});
  if(/policy|jurisdiction|service_tiers|effective|start_date|end_date/i.test(error.message||''))
   return res.status(422).json({error:'Approved policy does not cover the requested calculation'});
  return res.status(503).json({error:'HR draft calculation could not be confirmed'});
 }
};
module.exports.config={api:{bodyParser:{sizeLimit:'16kb'}}};
