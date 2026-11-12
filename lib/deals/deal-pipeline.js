'use strict';

const PIPELINE_KINDS = Object.freeze(['investor','lender','buyer']);
const PIPELINE_STATUSES = Object.freeze([
  'identified','contacted','nda_pending','nda_signed','materials_sent','meeting',
  'ioi_received','term_sheet_received','shortlisted','declined','selected'
]);
const OFFER_TYPES = Object.freeze(['ioi','term_sheet','revised_term_sheet']);
const OFFER_STATUSES = Object.freeze(['received','under_review','shortlisted','rejected','accepted','withdrawn']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value,max=1000){
  if(value===undefined||value===null)return null;
  const out=String(value).replace(/\s+/g,' ').trim();
  return out?out.slice(0,max):null;
}
function pick(value,allowed,field,required=false){
  const out=clean(value,80);
  if(!out){
    if(required)throw new Error(field.toUpperCase()+'_REQUIRED');
    return undefined;
  }
  if(!allowed.includes(out))throw new Error(field.toUpperCase()+'_INVALID');
  return out;
}
function uuid(value,field,required=false){
  const out=clean(value,36);
  if(!out){
    if(required)throw new Error(field.toUpperCase()+'_REQUIRED');
    return undefined;
  }
  if(!UUID_RE.test(out))throw new Error(field.toUpperCase()+'_INVALID');
  return out;
}
function iso(value,field){
  if(value===undefined)return undefined;
  if(value===null||value==='')return null;
  const ts=Date.parse(value);
  if(!Number.isFinite(ts))throw new Error(field.toUpperCase()+'_INVALID');
  return new Date(ts).toISOString();
}
function number(value,field,{min=0,max=null}={}){
  if(value===undefined)return undefined;
  if(value===null||value==='')return null;
  const out=Number(value);
  if(!Number.isFinite(out)||out<min||(max!==null&&out>max))throw new Error(field.toUpperCase()+'_INVALID');
  return out;
}
function metadata(value){
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}

function normalizePipelineCreate(body={}){
  return {
    party_id:uuid(body.party_id,'party_id',true),
    member_id:uuid(body.member_id,'member_id')||null,
    kind:pick(body.kind,PIPELINE_KINDS,'pipeline_kind',true),
    status:pick(body.status,PIPELINE_STATUSES,'pipeline_status')||'identified',
    source:clean(body.source,160),
    relationship_owner:clean(body.relationship_owner,160),
    last_contact_at:iso(body.last_contact_at,'last_contact_at')||null,
    next_action_at:iso(body.next_action_at,'next_action_at')||null,
    notes:clean(body.notes,3000),
    metadata:metadata(body.metadata)
  };
}

function normalizePipelinePatch(body={}){
  const out={};
  const fields=[
    ['member_id',v=>uuid(v,'member_id')||null],
    ['status',v=>pick(v,PIPELINE_STATUSES,'pipeline_status',true)],
    ['source',v=>clean(v,160)],
    ['relationship_owner',v=>clean(v,160)],
    ['last_contact_at',v=>iso(v,'last_contact_at')],
    ['next_action_at',v=>iso(v,'next_action_at')],
    ['notes',v=>clean(v,3000)]
  ];
  for(const [field,fn] of fields){
    if(Object.prototype.hasOwnProperty.call(body,field))out[field]=fn(body[field]);
  }
  if(Object.prototype.hasOwnProperty.call(body,'metadata'))out.metadata=metadata(body.metadata);
  if(!Object.keys(out).length)throw new Error('PIPELINE_PATCH_EMPTY');
  return out;
}

function normalizeOfferCreate(body={}){
  return {
    pipeline_entry_id:uuid(body.pipeline_entry_id,'pipeline_entry_id',true),
    offer_type:pick(body.offer_type,OFFER_TYPES,'offer_type',true),
    status:pick(body.status,OFFER_STATUSES,'offer_status')||'received',
    currency:(clean(body.currency,3)||'SAR').toUpperCase(),
    amount:number(body.amount,'amount'),
    valuation:number(body.valuation,'valuation'),
    equity_percent:number(body.equity_percent,'equity_percent',{min:0,max:100}),
    interest_rate_percent:number(body.interest_rate_percent,'interest_rate_percent',{min:0,max:100}),
    tenor_months:number(body.tenor_months,'tenor_months'),
    fee_amount:number(body.fee_amount,'fee_amount'),
    conditions:clean(body.conditions,5000),
    received_at:iso(body.received_at,'received_at')||new Date().toISOString(),
    expires_at:iso(body.expires_at,'expires_at')||null,
    document_id:uuid(body.document_id,'document_id')||null,
    metadata:metadata(body.metadata)
  };
}

function normalizeOfferPatch(body={}){
  const out={};
  const fields=[
    ['status',v=>pick(v,OFFER_STATUSES,'offer_status',true)],
    ['currency',v=>(clean(v,3)||'SAR').toUpperCase()],
    ['amount',v=>number(v,'amount')],
    ['valuation',v=>number(v,'valuation')],
    ['equity_percent',v=>number(v,'equity_percent',{min:0,max:100})],
    ['interest_rate_percent',v=>number(v,'interest_rate_percent',{min:0,max:100})],
    ['tenor_months',v=>number(v,'tenor_months')],
    ['fee_amount',v=>number(v,'fee_amount')],
    ['conditions',v=>clean(v,5000)],
    ['received_at',v=>iso(v,'received_at')],
    ['expires_at',v=>iso(v,'expires_at')],
    ['document_id',v=>uuid(v,'document_id')||null]
  ];
  for(const [field,fn] of fields){
    if(Object.prototype.hasOwnProperty.call(body,field))out[field]=fn(body[field]);
  }
  if(Object.prototype.hasOwnProperty.call(body,'metadata'))out.metadata=metadata(body.metadata);
  if(!Object.keys(out).length)throw new Error('OFFER_PATCH_EMPTY');
  return out;
}

module.exports={
  PIPELINE_KINDS,PIPELINE_STATUSES,OFFER_TYPES,OFFER_STATUSES,
  normalizePipelineCreate,normalizePipelinePatch,normalizeOfferCreate,normalizeOfferPatch
};
