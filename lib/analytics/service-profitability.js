'use strict';

const REVENUE_EVENT_TYPES = new Set([
  'invoice.issued',
  'service_fee.accrued',
  'rent.due'
]);

const DIRECT_COST_EVENT_TYPES = new Set([
  'expense.approved'
]);

function text(value,max=240){
  return String(value==null?'':value).trim().slice(0,max);
}
function finite(value){
  if(value===null||value===undefined||value==='') return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function round(value){
  return Math.round((Number(value)+Number.EPSILON)*100)/100;
}
function pct(n,d){
  if(!Number.isFinite(n)||!Number.isFinite(d)||d===0) return null;
  return round((n/d)*100);
}

function buildServiceProfitability({catalog=[],serviceRequests=[],financialEvents=[]}={}){
  const services=new Map();
  for(const row of catalog||[]){
    const id=text(row.id,80);
    const code=text(row.code,120);
    if(!id||!code) continue;
    services.set(id,{
      id,
      code,
      name_ar:text(row.name_ar,240)||null,
      name_en:text(row.name_en,240)||null
    });
  }

  const requestCounts=new Map();
  for(const row of serviceRequests||[]){
    const serviceId=text(row.service_id,80);
    if(!serviceId) continue;
    requestCounts.set(serviceId,(requestCounts.get(serviceId)||0)+1);
  }

  const grouped=new Map();
  let ignoredUnposted=0,ignoredUnsupported=0,ignoredMissingService=0;
  for(const event of financialEvents||[]){
    if(text(event.status,40)!=='posted'){ignoredUnposted++;continue;}
    const serviceCode=text(event.service_code,120);
    if(!serviceCode){ignoredMissingService++;continue;}
    const type=text(event.event_type,80);
    const isRevenue=REVENUE_EVENT_TYPES.has(type);
    const isCost=DIRECT_COST_EVENT_TYPES.has(type);
    if(!isRevenue&&!isCost){ignoredUnsupported++;continue;}
    const amount=finite(event.amount);
    const currency=text(event.currency,8).toUpperCase();
    if(amount==null||amount<0||!/^[A-Z]{3}$/.test(currency)){ignoredUnsupported++;continue;}
    const key=serviceCode+'|'+currency;
    const row=grouped.get(key)||{
      serviceCode,currency,recognizedRevenue:0,directCost:0,
      revenueEvents:0,costEvents:0,postedEvents:0
    };
    row.postedEvents++;
    if(isRevenue){row.recognizedRevenue+=amount;row.revenueEvents++;}
    if(isCost){row.directCost+=amount;row.costEvents++;}
    grouped.set(key,row);
  }

  const byCode=new Map([...services.values()].map(s=>[s.code,s]));
  const rows=[...grouped.values()].map(row=>{
    const svc=byCode.get(row.serviceCode)||null;
    const requestCount=svc?requestCounts.get(svc.id)||0:0;
    const observedDirectProfit=round(row.recognizedRevenue-row.directCost);
    return {
      serviceCode:row.serviceCode,
      serviceName:svc?.name_ar||svc?.name_en||row.serviceCode,
      currency:row.currency,
      requestCount,
      postedEvents:row.postedEvents,
      revenueEvents:row.revenueEvents,
      costEvents:row.costEvents,
      recognizedRevenue:round(row.recognizedRevenue),
      directCost:round(row.directCost),
      observedDirectProfit,
      observedDirectMarginPct:pct(observedDirectProfit,row.recognizedRevenue),
      dataState:row.revenueEvents>0&&row.costEvents>0?'observed_direct_margin':'partial_evidence'
    };
  }).sort((a,b)=>b.observedDirectProfit-a.observedDirectProfit||b.recognizedRevenue-a.recognizedRevenue);

  const requestedWithoutFinancials=[];
  for(const [serviceId,count] of requestCounts.entries()){
    const svc=services.get(serviceId);
    if(!svc) continue;
    const hasFinancial=rows.some(r=>r.serviceCode===svc.code);
    if(!hasFinancial){
      requestedWithoutFinancials.push({
        serviceCode:svc.code,
        serviceName:svc.name_ar||svc.name_en||svc.code,
        requestCount:count,
        dataState:'unknown_no_posted_financial_events'
      });
    }
  }

  const currencies=[...new Set(rows.map(r=>r.currency))].sort();
  return {
    status:'partial',
    dataState:rows.length?'partial':'unknown',
    reason:rows.length
      ? 'Observed direct margin uses posted revenue-recognition and direct-expense events only; allocated costs are not yet attributed by service.'
      : 'No posted financial events with service_code are available; service profitability remains UNKNOWN.',
    methodology:'posted_service_financial_events_v1',
    semantics:'observed_direct_margin_not_full_operating_profit',
    rows,
    requestedWithoutFinancials:requestedWithoutFinancials.sort((a,b)=>b.requestCount-a.requestCount),
    currencies,
    totals:currencies.length===1?{
      currency:currencies[0],
      recognizedRevenue:round(rows.reduce((s,r)=>s+r.recognizedRevenue,0)),
      directCost:round(rows.reduce((s,r)=>s+r.directCost,0)),
      observedDirectProfit:round(rows.reduce((s,r)=>s+r.observedDirectProfit,0))
    }:null,
    coverage:{
      servicesWithObservedFinancials:new Set(rows.map(r=>r.serviceCode)).size,
      requestedServicesWithoutFinancials:requestedWithoutFinancials.length,
      ignoredUnposted,
      ignoredUnsupported,
      ignoredMissingService
    },
    generatedAt:new Date().toISOString()
  };
}

module.exports={
  REVENUE_EVENT_TYPES,
  DIRECT_COST_EVENT_TYPES,
  buildServiceProfitability
};
