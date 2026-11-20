'use strict';
const PRODUCTS=Object.freeze(['crm','hr','suite']);
function approvedPrices(env) {
 const config={crm:env.STRIPE_COMPANY_PRICE_CRM,hr:env.STRIPE_COMPANY_PRICE_HR,suite:env.STRIPE_COMPANY_PRICE_SUITE};
 const values=Object.values(config);
 if(values.some(v=>typeof v!=='string'||!/^price_[A-Za-z0-9_]+$/.test(v))||new Set(values).size!==values.length)
  throw new Error('Company program Stripe price configuration is missing or ambiguous');
 return config;
}
function selectedProduct(product,env){
 if(!PRODUCTS.includes(product))throw new Error('Unapproved company program');
 return {product,priceId:approvedPrices(env)[product]};
}
function verifiedSubscriptionData(subscription,env){
 const prices=approvedPrices(env);
 if(!subscription||typeof subscription.id!=='string'||!/^sub_[A-Za-z0-9_]+$/.test(subscription.id))
  throw new Error('Invalid Stripe subscription');
 const metadata=subscription.metadata||{};
 const owner=metadata.bonds_owner_id, product=metadata.bonds_program_code;
 if(typeof owner!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(owner))
  throw new Error('Missing verified subscription owner');
 if(!PRODUCTS.includes(product))throw new Error('Unknown company program');
 const items=subscription.items?.data;
 if(!Array.isArray(items)||items.length!==1||items[0].price?.id!==prices[product]||items[0].quantity!==1)
  throw new Error('Unapproved Stripe subscription price or quantity');
 const status=subscription.status;
 if(!['active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused'].includes(status))
  throw new Error('Unrecognized Stripe subscription state');
 const periodSeconds=subscription.current_period_end??items[0].current_period_end;
 const period=Number.isSafeInteger(periodSeconds)&&periodSeconds>0?
  new Date(periodSeconds*1000).toISOString():null;
 if(['active','trialing'].includes(status)&&(!period||Date.parse(period)<=Date.now()))
  throw new Error('Active Stripe subscription has no future period');
 return {owner,product,priceId:prices[product],subscriptionId:subscription.id,status,periodEnd:period};
}
module.exports={approvedPrices,selectedProduct,verifiedSubscriptionData};
