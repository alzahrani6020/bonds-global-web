'use strict';

const CLOSING_ITEM_CATEGORIES = Object.freeze(['legal','financial','regulatory','corporate','commercial','other']);
const CLOSING_ITEM_STATUSES = Object.freeze(['pending','in_progress','satisfied','waived','blocked']);
const CLOSING_RECORD_TYPES = Object.freeze(['term_sheet','cap_table','funding_confirmation']);
const CLOSING_RECORD_STATUSES = Object.freeze(['pending','signed','approved','confirmed','rejected']);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(v,max=1000){if(v===undefined||v===null)return null;const s=String(v).replace(/\s+/g,' ').trim();return s?s.slice(0,max):null}
function pick(v,allowed,field,required=false){const s=clean(v,80);if(!s){if(required)throw new Error(field.toUpperCase()+'_REQUIRED');return undefined}if(!allowed.includes(s))throw new Error(field.toUpperCase()+'_INVALID');return s}
function uuid(v,field,required=false){const s=clean(v,36);if(!s){if(required)throw new Error(field.toUpperCase()+'_REQUIRED');return undefined}if(!UUID_RE.test(s))throw new Error(field.toUpperCase()+'_INVALID');return s}
function iso(v,field){if(v===undefined)return undefined;if(v===null||v==='')return null;const n=Date.parse(v);if(!Number.isFinite(n))throw new Error(field.toUpperCase()+'_INVALID');return new Date(n).toISOString()}
function num(v,field){if(v===undefined)return undefined;if(v===null||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error(field.toUpperCase()+'_INVALID');return n}
function meta(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}

function normalizeClosingItemCreate(body={}){
  return {
    title:clean(body.title,220)||(()=>{throw new Error('CLOSING_ITEM_TITLE_REQUIRED')})(),
    category:pick(body.category,CLOSING_ITEM_CATEGORIES,'closing_item_category')||'other',
    status:pick(body.status,CLOSING_ITEM_STATUSES,'closing_item_status')||'pending',
    required:body.required===undefined?true:Boolean(body.required),
    due_at:iso(body.due_at,'due_at')||null,
    evidence_document_id:uuid(body.evidence_document_id,'evidence_document_id')||null,
    notes:clean(body.notes,3000),
    metadata:meta(body.metadata)
  };
}
function normalizeClosingItemPatch(body={}){
  const out={};
  const fields=[
    ['title',v=>clean(v,220)||(()=>{throw new Error('CLOSING_ITEM_TITLE_REQUIRED')})()],
    ['category',v=>pick(v,CLOSING_ITEM_CATEGORIES,'closing_item_category',true)],
    ['status',v=>pick(v,CLOSING_ITEM_STATUSES,'closing_item_status',true)],
    ['due_at',v=>iso(v,'due_at')],
    ['evidence_document_id',v=>uuid(v,'evidence_document_id')||null],
    ['notes',v=>clean(v,3000)]
  ];
  for(const [k,fn] of fields)if(Object.prototype.hasOwnProperty.call(body,k))out[k]=fn(body[k]);
  if(Object.prototype.hasOwnProperty.call(body,'required'))out.required=Boolean(body.required);
  if(Object.prototype.hasOwnProperty.call(body,'metadata'))out.metadata=meta(body.metadata);
  if(!Object.keys(out).length)throw new Error('CLOSING_ITEM_PATCH_EMPTY');
  return out;
}

function assertRecordPair(type,status){
  const allowed={
    term_sheet:['pending','signed','rejected'],
    cap_table:['pending','approved','rejected'],
    funding_confirmation:['pending','confirmed','rejected']
  };
  if(!allowed[type]?.includes(status))throw new Error('CLOSING_RECORD_STATUS_INVALID_FOR_TYPE');
}
function normalizeClosingRecordCreate(body={}){
  const record_type=pick(body.record_type,CLOSING_RECORD_TYPES,'closing_record_type',true);
  const status=pick(body.status,CLOSING_RECORD_STATUSES,'closing_record_status')||'pending';
  assertRecordPair(record_type,status);
  return {
    record_type,status,
    offer_id:uuid(body.offer_id,'offer_id')||null,
    document_id:uuid(body.document_id,'document_id')||null,
    amount:num(body.amount,'amount'),
    currency:(clean(body.currency,3)||'SAR').toUpperCase(),
    reference:clean(body.reference,200),
    effective_at:iso(body.effective_at,'effective_at')||new Date().toISOString(),
    notes:clean(body.notes,3000),
    metadata:meta(body.metadata)
  };
}
function normalizeClosingRecordPatch(body={},current={}){
  const out={};
  const type=current.record_type;
  if(Object.prototype.hasOwnProperty.call(body,'status')){
    const status=pick(body.status,CLOSING_RECORD_STATUSES,'closing_record_status',true);
    assertRecordPair(type,status);out.status=status;
  }
  const fields=[
    ['offer_id',v=>uuid(v,'offer_id')||null],
    ['document_id',v=>uuid(v,'document_id')||null],
    ['amount',v=>num(v,'amount')],
    ['currency',v=>(clean(v,3)||'SAR').toUpperCase()],
    ['reference',v=>clean(v,200)],
    ['effective_at',v=>iso(v,'effective_at')],
    ['notes',v=>clean(v,3000)]
  ];
  for(const [k,fn] of fields)if(Object.prototype.hasOwnProperty.call(body,k))out[k]=fn(body[k]);
  if(Object.prototype.hasOwnProperty.call(body,'metadata'))out.metadata=meta(body.metadata);
  if(!Object.keys(out).length)throw new Error('CLOSING_RECORD_PATCH_EMPTY');
  return out;
}

module.exports={
  CLOSING_ITEM_CATEGORIES,CLOSING_ITEM_STATUSES,CLOSING_RECORD_TYPES,CLOSING_RECORD_STATUSES,
  normalizeClosingItemCreate,normalizeClosingItemPatch,normalizeClosingRecordCreate,normalizeClosingRecordPatch
};