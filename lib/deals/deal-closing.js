'use strict';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONDITION_CATEGORIES=['legal','financial','regulatory','commercial','operational','other'];
const CONDITION_STATUSES=['open','in_progress','satisfied','waived','blocked'];
const MILESTONE_TYPES=['term_sheet_signed','cap_table_approved','funds_received','signing_complete'];
const MILESTONE_STATUSES=['pending','confirmed','revoked'];

function text(value,max=500){
  if(value===undefined||value===null)return null;
  const out=String(value).replace(/\s+/g,' ').trim();
  return out?out.slice(0,max):null;
}
function pick(value,allowed,field,fallback){
  const v=text(value,80);
  if(!v)return fallback;
  if(!allowed.includes(v))throw new Error(field.toUpperCase()+'_INVALID');
  return v;
}
function uuid(value,field){
  if(value===undefined)return undefined;
  if(value===null||value==='')return null;
  const v=String(value);
  if(!UUID_RE.test(v))throw new Error(field.toUpperCase()+'_INVALID');
  return v;
}
function iso(value,field){
  if(value===undefined)return undefined;
  if(value===null||value==='')return null;
  const t=Date.parse(value);
  if(!Number.isFinite(t))throw new Error(field.toUpperCase()+'_INVALID');
  return new Date(t).toISOString();
}
function amount(value){
  if(value===undefined||value===null||value==='')return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw new Error('AMOUNT_INVALID');
  return n;
}
function normalizeClosingCondition(body={}){
  const title=text(body.title,300);
  if(!title)throw new Error('CLOSING_CONDITION_TITLE_REQUIRED');
  return {
    title,
    category:pick(body.category,CONDITION_CATEGORIES,'closing_category','other'),
    status:pick(body.status,CONDITION_STATUSES,'closing_status','open'),
    is_critical:Boolean(body.is_critical),
    owner:text(body.owner,200),
    due_at:iso(body.due_at,'due_at')||null,
    evidence_document_id:uuid(body.evidence_document_id,'evidence_document_id')||null,
    notes:text(body.notes,3000),
    metadata:body.metadata&&typeof body.metadata==='object'&&!Array.isArray(body.metadata)?body.metadata:{}
  };
}
function normalizeClosingConditionPatch(body={}){
  const out={};
  if(body.title!==undefined){
    const title=text(body.title,300); if(!title)throw new Error('CLOSING_CONDITION_TITLE_REQUIRED'); out.title=title;
  }
  if(body.category!==undefined)out.category=pick(body.category,CONDITION_CATEGORIES,'closing_category');
  if(body.status!==undefined)out.status=pick(body.status,CONDITION_STATUSES,'closing_status');
  if(body.is_critical!==undefined)out.is_critical=Boolean(body.is_critical);
  if(body.owner!==undefined)out.owner=text(body.owner,200);
  if(body.due_at!==undefined)out.due_at=iso(body.due_at,'due_at');
  if(body.evidence_document_id!==undefined)out.evidence_document_id=uuid(body.evidence_document_id,'evidence_document_id');
  if(body.notes!==undefined)out.notes=text(body.notes,3000);
  if(!Object.keys(out).length)throw new Error('CLOSING_CONDITION_PATCH_EMPTY');
  return out;
}
function normalizeClosingMilestone(body={}){
  const milestone_type=pick(body.milestone_type,MILESTONE_TYPES,'milestone_type');
  if(!milestone_type)throw new Error('MILESTONE_TYPE_REQUIRED');
  const status=pick(body.status,MILESTONE_STATUSES,'milestone_status','confirmed');
  return {
    milestone_type,
    status,
    evidence_document_id:uuid(body.evidence_document_id,'evidence_document_id')||null,
    related_offer_id:uuid(body.related_offer_id,'related_offer_id')||null,
    amount:amount(body.amount),
    currency:(text(body.currency,3)||'SAR').toUpperCase(),
    occurred_at:iso(body.occurred_at,'occurred_at')||(status==='confirmed'?new Date().toISOString():null),
    notes:text(body.notes,3000),
    metadata:body.metadata&&typeof body.metadata==='object'&&!Array.isArray(body.metadata)?body.metadata:{}
  };
}
function closingGateSummary(conditions=[],milestones=[]){
  const criticalOpen=conditions.filter(c=>c.is_critical&&!['satisfied','waived'].includes(c.status));
  const confirmed=new Set(milestones.filter(m=>m.status==='confirmed').map(m=>m.milestone_type));
  return {
    critical_open:criticalOpen.length,
    term_sheet_signed:confirmed.has('term_sheet_signed'),
    cap_table_approved:confirmed.has('cap_table_approved'),
    funds_received:confirmed.has('funds_received'),
    signing_complete:confirmed.has('signing_complete'),
    ready_to_close:criticalOpen.length===0&&confirmed.has('term_sheet_signed')&&confirmed.has('cap_table_approved')&&confirmed.has('funds_received')&&confirmed.has('signing_complete')
  };
}
module.exports={
  CONDITION_CATEGORIES,CONDITION_STATUSES,MILESTONE_TYPES,MILESTONE_STATUSES,
  normalizeClosingCondition,normalizeClosingConditionPatch,normalizeClosingMilestone,closingGateSummary
};
