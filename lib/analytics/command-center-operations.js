'use strict';

const { buildServiceProfitability } = require('./service-profitability');

const DECISION_STATUSES = new Set(['open','approved','rejected','implemented','measured','cancelled']);
const DECISION_CONFIDENCE = new Set(['high','medium','low','unknown']);
const ACTION_STATUSES = new Set(['open','in_progress','blocked','done','cancelled']);
const ACTION_PRIORITIES = new Set(['low','medium','high','critical']);
const VIEW_SCOPES = new Set(['private','role','global']);
const WATCH_TYPES = new Set(['metric','crm_opportunity','funding_case']);

function text(value,max=500){
  return String(value==null?'':value).trim().slice(0,max);
}
function finite(value){
  if(value===null||value===undefined||value==='') return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function object(value){
  return value && typeof value==='object' && !Array.isArray(value) ? value : {};
}
function array(value){
  return Array.isArray(value) ? value : [];
}
function requireUuid(value,field='id'){
  const v=text(value,80);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
    throw new Error('invalid '+field);
  }
  return v;
}
function requireMetricKey(value){
  const v=text(value,80);
  if(!/^[a-z0-9_]{2,80}$/.test(v)) throw new Error('invalid metric_key');
  return v;
}
function isoOrNull(value,field){
  if(value==null||value==='') return null;
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) throw new Error('invalid '+field);
  return d.toISOString();
}
function evaluateExpectation(actual,expected,comparison='gte'){
  const a=finite(actual), e=finite(expected);
  if(a==null||e==null) return null;
  if(comparison==='lte') return a<=e;
  if(comparison==='eq') return a===e;
  return a>=e;
}

function validateDecisionInput(body={},metricSnapshot={}){
  const title=text(body.title,240);
  if(!title) throw new Error('title required');
  const metricKey=requireMetricKey(body.metric_key);
  const expectedValue=finite(body.expected_value);
  if(expectedValue==null) throw new Error('expected_value must be numeric');
  const comparison=['gte','lte','eq'].includes(body.comparison)?body.comparison:'gte';
  const confidence=DECISION_CONFIDENCE.has(body.confidence)?body.confidence:'unknown';
  const actual=Object.prototype.hasOwnProperty.call(metricSnapshot,metricKey)?finite(metricSnapshot[metricKey]):null;
  return {
    title,
    rationale:text(body.rationale,3000)||null,
    status:'open',
    decision_type:text(body.decision_type,80)||'management',
    expected_outcome:{metric_key:metricKey,target_value:expectedValue,comparison},
    baseline:{metric_key:metricKey,actual_value:actual,captured_at:new Date().toISOString()},
    measured_outcome:{},
    confidence,
    review_at:isoOrNull(body.review_at,'review_at')
  };
}

function validateDecisionStatus(body={}){
  const id=requireUuid(body.id);
  const status=text(body.status,40);
  if(!DECISION_STATUSES.has(status)) throw new Error('invalid status');
  return {id,status};
}

function validateActionInput(body={}){
  const titleValue=text(body.title,240);
  if(!titleValue) throw new Error('title required');
  const priority=ACTION_PRIORITIES.has(body.priority)?body.priority:'medium';
  return {
    title:titleValue,
    decision_id:body.decision_id?requireUuid(body.decision_id,'decision_id'):null,
    status:ACTION_STATUSES.has(body.status)?body.status:'open',
    priority,
    due_at:isoOrNull(body.due_at,'due_at'),
    evidence:object(body.evidence)
  };
}

function validateSavedView(body={}){
  const name=text(body.name,160);
  if(!name) throw new Error('name required');
  const scope=VIEW_SCOPES.has(body.scope)?body.scope:'private';
  return {
    name,
    scope,
    role_name:scope==='role'?(text(body.role_name,80)||null):null,
    definition:object(body.definition)
  };
}

function validateWatchlist(body={}){
  const name=text(body.name,160);
  if(!name) throw new Error('name required');
  const entityType=text(body.entity_type,80);
  if(!WATCH_TYPES.has(entityType)) throw new Error('invalid entity_type');
  const refs=array(body.entity_refs).map(x=>text(x,120)).filter(Boolean).slice(0,100);
  if(!refs.length) throw new Error('entity_refs required');
  return {name,entity_type:entityType,entity_refs:refs};
}

async function loadDecisionOperations(sb,metricSnapshot={}){
  const [decisionsRes,actionsRes,viewsRes,watchRes,fundingRes,oppsRes,invoicesRes,servicesRes,serviceRequestsRes,financialEventsRes] = await Promise.all([
    sb.from('analytics_decisions').select('*').order('created_at',{ascending:false}).limit(200),
    sb.from('analytics_actions').select('*').order('created_at',{ascending:false}).limit(300),
    sb.from('analytics_saved_views').select('*').order('created_at',{ascending:false}).limit(200),
    sb.from('analytics_watchlists').select('*').order('created_at',{ascending:false}).limit(200),
    sb.from('funding_cases').select('id,case_reference,status,source,amount,financing_type,readiness_score,submitted_at,approved_at,declined_at,closed_at,created_at').order('created_at',{ascending:false}).limit(1000),
    sb.from('crm_opportunities').select('id,title,stage,value_amount,currency,probability,source,expected_close_date,created_at').order('created_at',{ascending:false}).limit(1000),
    sb.from('moyasar_invoices').select('amount,currency,status,metadata,paid_at,created_at').order('created_at',{ascending:false}).limit(5000),
    sb.from('service_catalog').select('id,code,name_ar,name_en,is_active,status').eq('is_active',true).limit(1000),
    sb.from('service_requests').select('id,service_id,status,created_at').order('created_at',{ascending:false}).limit(5000),
    sb.from('financial_events').select('service_code,event_type,amount,currency,status,effective_at,created_at').order('created_at',{ascending:false}).limit(10000)
  ]);
  for(const r of [decisionsRes,actionsRes,viewsRes,watchRes,fundingRes,oppsRes,invoicesRes,servicesRes,serviceRequestsRes,financialEventsRes]) if(r.error) throw r.error;

  const funding=fundingRes.data||[];
  const opps=oppsRes.data||[];
  const invoices=invoicesRes.data||[];

  const fundingByStatus={}, fundingBySource={};
  let fundingAmount=0, readinessCount=0, readinessSum=0;
  for(const row of funding){
    const status=text(row.status,80)||'unknown';
    const source=text(row.source,120)||'unknown';
    fundingByStatus[status]=(fundingByStatus[status]||0)+1;
    const s=fundingBySource[source]||(fundingBySource[source]={source,cases:0,amount:0});
    s.cases++; s.amount+=finite(row.amount)||0;
    fundingAmount+=finite(row.amount)||0;
    const readiness=finite(row.readiness_score);
    if(readiness!=null){readinessCount++;readinessSum+=readiness;}
  }

  const attribution={};
  for(const row of opps){
    const source=text(row.source,120)||'unknown';
    const a=attribution[source]||(attribution[source]={source,opportunities:0,pipelineValue:0,wonValue:0,paidRevenue:0,paidInvoices:0});
    a.opportunities++;
    const value=finite(row.value_amount)||0;
    if(!['won','lost'].includes(row.stage)) a.pipelineValue+=value;
    if(row.stage==='won') a.wonValue+=value;
  }
  let explicitRevenueSourceCount=0;
  for(const row of invoices){
    if(row.status!=='paid') continue;
    const meta=object(row.metadata);
    const source=text(meta.source||meta.utm_source||meta.referrer,120);
    if(!source) continue;
    explicitRevenueSourceCount++;
    const a=attribution[source]||(attribution[source]={source,opportunities:0,pipelineValue:0,wonValue:0,paidRevenue:0,paidInvoices:0});
    a.paidInvoices++;
    a.paidRevenue+=(finite(row.amount)||0)/100;
  }

  const revenueRows=Object.values(attribution).sort((a,b)=>(b.paidRevenue-a.paidRevenue)||(b.pipelineValue-a.pipelineValue));
  const fundingRows=Object.values(fundingBySource).sort((a,b)=>b.amount-a.amount||b.cases-a.cases);

  const serviceProfitability=buildServiceProfitability({
    catalog:servicesRes.data||[],
    serviceRequests:serviceRequestsRes.data||[],
    financialEvents:financialEventsRes.data||[]
  });

  const decisions=(decisionsRes.data||[]).map(d=>{
    const exp=object(d.expected_outcome);
    const measured=object(d.measured_outcome);
    const actual=finite(measured.actual_value);
    const target=finite(exp.target_value);
    return {
      ...d,
      outcome_evaluation:actual==null||target==null?null:evaluateExpectation(actual,target,exp.comparison||'gte')
    };
  });

  return {
    success:true,
    capabilityStatus:{
      decisionToOutcome:'active',
      savedViewsWatchlists:'active',
      fundingIntelligence:'active',
      revenueAttribution:explicitRevenueSourceCount>0?'active':'partial',
      serviceProfitability:'partial'
    },
    decisions,
    actions:actionsRes.data||[],
    savedViews:viewsRes.data||[],
    watchlists:watchRes.data||[],
    watchableEntities:{
      metrics:Object.keys(metricSnapshot).sort(),
      crmOpportunities:opps.slice(0,100),
      fundingCases:funding.slice(0,100)
    },
    fundingIntelligence:{
      totalCases:funding.length,
      totalRequestedAmount:fundingAmount,
      averageReadiness:readinessCount?Math.round(readinessSum/readinessCount*10)/10:null,
      byStatus:Object.entries(fundingByStatus).map(([status,count])=>({status,count})).sort((a,b)=>b.count-a.count),
      bySource:fundingRows,
      dataState:funding.length?'available':'empty'
    },
    revenueAttribution:{
      status:explicitRevenueSourceCount>0?'active':'partial',
      reason:explicitRevenueSourceCount>0?null:'No paid invoice has an explicit acquisition source; pipeline source is observable but revenue causality is not.',
      explicitRevenueSourceCount,
      rows:revenueRows
    },
    serviceProfitability,
    generatedAt:new Date().toISOString()
  };
}

async function createDecision(sb,body,userId,metricSnapshot){
  const row=validateDecisionInput(body,metricSnapshot);
  row.created_by=userId||null;
  const {data,error}=await sb.from('analytics_decisions').insert([row]).select().single();
  if(error) throw error;
  return data;
}

async function updateDecisionStatus(sb,body,userId){
  const {id,status}=validateDecisionStatus(body);
  const patch={status,updated_at:new Date().toISOString()};
  if(status==='approved') patch.approved_by=userId||null;
  const {data,error}=await sb.from('analytics_decisions').update(patch).eq('id',id).select().single();
  if(error) throw error;
  return data;
}

async function measureDecision(sb,id,metricSnapshot){
  const decisionId=requireUuid(id);
  const {data:decision,error:readError}=await sb.from('analytics_decisions').select('*').eq('id',decisionId).single();
  if(readError) throw readError;
  const exp=object(decision.expected_outcome);
  const metricKey=requireMetricKey(exp.metric_key);
  const actual=Object.prototype.hasOwnProperty.call(metricSnapshot,metricKey)?finite(metricSnapshot[metricKey]):null;
  const evaluation=evaluateExpectation(actual,exp.target_value,exp.comparison||'gte');
  const measured={metric_key:metricKey,actual_value:actual,target_value:finite(exp.target_value),comparison:exp.comparison||'gte',target_met:evaluation,measured_at:new Date().toISOString()};
  const {data,error}=await sb.from('analytics_decisions').update({status:'measured',measured_outcome:measured,updated_at:new Date().toISOString()}).eq('id',decisionId).select().single();
  if(error) throw error;
  return data;
}

async function createAction(sb,body,userId){
  const row=validateActionInput(body);
  row.owner_user_id=userId||null;
  const {data,error}=await sb.from('analytics_actions').insert([row]).select().single();
  if(error) throw error;
  return data;
}

async function saveView(sb,body,userId){
  const row=validateSavedView(body);
  row.owner_user_id=userId||null;
  const {data,error}=await sb.from('analytics_saved_views').insert([row]).select().single();
  if(error) throw error;
  return data;
}

async function deleteView(sb,id,userId){
  const viewId=requireUuid(id);
  const {data,error}=await sb.from('analytics_saved_views').delete().eq('id',viewId).eq('owner_user_id',userId).select('id').maybeSingle();
  if(error) throw error;
  if(!data) throw new Error('saved view not found');
  return data;
}

async function saveWatchlist(sb,body,userId){
  const row=validateWatchlist(body);
  row.owner_user_id=userId||null;
  const {data,error}=await sb.from('analytics_watchlists').insert([row]).select().single();
  if(error) throw error;
  return data;
}

async function deleteWatchlist(sb,id,userId){
  const watchId=requireUuid(id);
  const {data,error}=await sb.from('analytics_watchlists').delete().eq('id',watchId).eq('owner_user_id',userId).select('id').maybeSingle();
  if(error) throw error;
  if(!data) throw new Error('watchlist not found');
  return data;
}

module.exports={
  evaluateExpectation,
  validateDecisionInput,
  validateActionInput,
  validateSavedView,
  validateWatchlist,
  loadDecisionOperations,
  createDecision,
  updateDecisionStatus,
  measureDecision,
  createAction,
  saveView,
  deleteView,
  saveWatchlist,
  deleteWatchlist
};
