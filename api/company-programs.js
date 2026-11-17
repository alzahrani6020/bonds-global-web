'use strict';
/**
 * Separate checkout and webhook for independently licensed company programs.
 * Never reuses the legacy Pro/Enterprise subscription entitlement or prices.
 * A checkout redirects to Stripe; only a Stripe-verified subscription webhook
 * can call the privileged atomic database entitlement RPC.
 */
const {verifyBearerAndUser}=require('../lib/api/auth-helper');
const getSupabase=require('../lib/api/supabase');
const {setAllowedOrigin}=require('../lib/api/cors');
const {checkRateLimit}=require('../lib/api/rate-limit');
const {selectedProduct,verifiedSubscriptionData}=require('../lib/hr/stripe-programs.cjs');
const HANDLED_EVENTS=new Set([
 'checkout.session.completed','customer.subscription.created',
 'customer.subscription.updated','customer.subscription.deleted',
 'invoice.paid','invoice.payment_failed'
]);
function requireConfiguration(){
 if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_COMPANY_PROGRAM_WEBHOOK_SECRET||
    !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw Object.assign(new Error('Company billing is not configured'),{status:503});
}
function readRaw(req){
 if(Buffer.isBuffer(req.body)){
  if(req.body.length>131072)throw Object.assign(new Error('Payload too large'),{status:413});
  return Promise.resolve(req.body);
 }
 if(typeof req.body==='string'){
  if(Buffer.byteLength(req.body)>131072)throw Object.assign(new Error('Payload too large'),{status:413});
  return Promise.resolve(Buffer.from(req.body));
 }
 return new Promise((resolve,reject)=>{
  const chunks=[];let length=0;
  req.on('data',part=>{length+=part.length;if(length>131072){reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy();return;}chunks.push(part);});
  req.on('end',()=>resolve(Buffer.concat(chunks)));
  req.on('error',reject);
 });
}
async function checkout(req,res){
 if(await checkRateLimit('auth',req,res))return;
 const raw=await readRaw(req);
 let body;
 try{body=JSON.parse(raw.toString('utf8'));}catch(_){return res.status(400).json({error:'Invalid JSON'});}
 if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Invalid payload'});
 req.body=body;
 const user=await verifyBearerAndUser(req);
 if(!user.email||!user.email_confirmed_at)return res.status(403).json({error:'Verified email required'});
 let selected;
 try{selected=selectedProduct(body.product_code,process.env);}
 catch(_){return res.status(400).json({error:'Unapproved company program or price'});}
 const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY);
 const redirect='https://bonds-global.com/my-bonds/crm/?program='+encodeURIComponent(selected.product);
 const session=await stripe.checkout.sessions.create({
  mode:'subscription',customer_email:user.email,client_reference_id:user.id,
  payment_method_types:['card'],
  line_items:[{price:selected.priceId,quantity:1}],
  subscription_data:{metadata:{bonds_owner_id:user.id,bonds_program_code:selected.product}},
  metadata:{bonds_owner_id:user.id,bonds_program_code:selected.product},
  success_url:redirect+'&checkout=return',
  cancel_url:redirect+'&checkout=cancelled'
 });
 if(!session?.url||!session?.id)throw new Error('Stripe checkout response invalid');
 return res.status(200).json({url:session.url,checkout_id:session.id});
}
function subscriptionReference(event){
 const object=event?.data?.object||{};
 switch(event.type){
  case 'customer.subscription.created':
  case 'customer.subscription.updated':
  case 'customer.subscription.deleted':return object.id;
  case 'checkout.session.completed':return object.subscription;
  case 'invoice.paid':
  case 'invoice.payment_failed':
   return typeof object.subscription==='string'?object.subscription:
    object.parent?.subscription_details?.subscription||null;
  default:return null;
 }
}
async function webhook(req,res){
 if(await checkRateLimit('webhook',req,res))return;
 const raw=await readRaw(req);
 const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY);
 let event;
 try{event=stripe.webhooks.constructEvent(raw,req.headers['stripe-signature'],
   process.env.STRIPE_COMPANY_PROGRAM_WEBHOOK_SECRET);}
 catch(_){return res.status(400).json({error:'Invalid Stripe signature'});}
 if(!HANDLED_EVENTS.has(event.type))return res.status(200).json({received:true,ignored:true});
 const subscriptionId=subscriptionReference(event);
 if(typeof subscriptionId!=='string'||!/^sub_[A-Za-z0-9_]+$/.test(subscriptionId))
  return res.status(200).json({received:true,ignored:true});
 const subscription=await stripe.subscriptions.retrieve(subscriptionId);
 // This endpoint is dedicated to company programs. Ignore unrelated legacy Stripe subscriptions.
 if(!subscription?.metadata?.bonds_program_code)return res.status(200).json({received:true,ignored:true});
 const verified=verifiedSubscriptionData(subscription,process.env);
 if(!Number.isSafeInteger(event.created)||event.created<=0||!/^evt_[A-Za-z0-9_]+$/.test(event.id))
  throw Object.assign(new Error('Invalid Stripe event identifier'),{status:422});
 const db=getSupabase();
 const {data,error}=await db.rpc('company_program_apply_stripe_event',{
  p_event_id:event.id,p_subscription_id:verified.subscriptionId,
  p_owner_user_id:verified.owner,p_product_code:verified.product,
  p_price_id:verified.priceId,p_provider_status:verified.status,
  p_event_created:new Date(event.created*1000).toISOString(),
  p_period_end:verified.periodEnd
 });
 if(error)throw Object.assign(new Error('Company entitlement ledger unavailable'),{status:503});
 if(!['applied','duplicate','stale'].includes(data))
  throw Object.assign(new Error('Company entitlement not confirmed'),{status:503});
 if(['invoice.paid','invoice.payment_failed'].includes(event.type)){
  const invoiceId=event.data?.object?.id;
  if(typeof invoiceId!=='string'||!/^in_[A-Za-z0-9_]+$/.test(invoiceId))
   throw Object.assign(new Error('Invalid invoice identifier'),{status:422});
  const invoice=await stripe.invoices.retrieve(invoiceId);
  const invoiceSubscription=typeof invoice.subscription==='string'?invoice.subscription:
   invoice.parent?.subscription_details?.subscription;
  if(invoiceSubscription!==verified.subscriptionId||
   !Number.isSafeInteger(invoice.amount_due)||invoice.amount_due<0||
   !Number.isSafeInteger(invoice.amount_paid)||invoice.amount_paid<0||
   typeof invoice.currency!=='string'||!['draft','open','paid','uncollectible','void'].includes(invoice.status))
   throw Object.assign(new Error('Stripe invoice verification failed'),{status:503});
  if(event.type==='invoice.paid'&&invoice.status!=='paid')
   throw Object.assign(new Error('Invoice is not paid'),{status:503});
  const paidSeconds=invoice.status_transitions?.paid_at;
  const paidAt=Number.isSafeInteger(paidSeconds)&&paidSeconds>0?new Date(paidSeconds*1000).toISOString():null;
  const {data:invoiceResult,error:invoiceError}=await db.rpc('company_program_record_stripe_invoice',{
   p_invoice_id:invoiceId,p_owner_user_id:verified.owner,p_product_code:verified.product,
   p_subscription_id:verified.subscriptionId,p_currency:invoice.currency.toUpperCase(),
   p_amount_due_minor:invoice.amount_due,p_amount_paid_minor:invoice.amount_paid,
   p_status:invoice.status,p_paid_at:paidAt
  });
  if(invoiceError||invoiceResult!=='recorded')
   throw Object.assign(new Error('Company invoice ledger unavailable'),{status:503});
 }
 return res.status(200).json({received:true,result:data});
}
module.exports=async function handler(req,res){
 setAllowedOrigin(res,req);
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, Stripe-Signature');
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  requireConfiguration();
  const action=new URL(req.url,'http://localhost').searchParams.get('action');
  if(action==='checkout')return await checkout(req,res);
  if(action==='webhook')return await webhook(req,res);
  return res.status(404).json({error:'Not found'});
 }catch(error){
  // Fail closed and allow provider retries; never leak billing credentials or raw payloads.
  return res.status(error.status&&[400,401,403,413,422,429,503].includes(error.status)?error.status:503)
   .json({error:'Company billing operation could not be confirmed'});
 }
};
module.exports.config={api:{bodyParser:false}};
