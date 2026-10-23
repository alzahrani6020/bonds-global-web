'use strict';

const crypto=require('crypto');

const DATASET_REGISTRY_VERSION=1;
const DATASET_ID_RE=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SENSITIVE_KEYS=new Set([
  'name','full_name','email','phone','mobile','address','national_id','identity_id',
  'id_number','password','secret','token','access_token','refresh_token','authorization',
  'cookie','session','session_id','user_id','customer_id','account_number','iban'
]);

const STRING_REDACTIONS=Object.freeze([
  {id:'email',re:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,replacement:'[REDACTED_EMAIL]'},
  {id:'bearer',re:/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,replacement:'[REDACTED_BEARER]'},
  {id:'jwt',re:/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,replacement:'[REDACTED_JWT]'},
  {id:'saudi_phone',re:/(?<!\d)(?:\+?966|00966|0)?5\d{8}(?!\d)/g,replacement:'[REDACTED_PHONE]'},
  {id:'saudi_national_id',re:/\b[12]\d{9}\b/g,replacement:'[REDACTED_ID]'}
]);

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  }
  return value;
}

function digest(value){
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function cleanText(value,max=2000){
  if(value===null||value===undefined) return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function isSensitiveKey(value){
  const normalized=String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_');
  if(!normalized) return false;
  if(SENSITIVE_KEYS.has(normalized)) return true;
  return /(?:^|_)(?:name|full_name|email|phone|mobile|address|national_id|identity_id|id_number|password|secret|token|access_token|refresh_token|authorization|cookie|session|session_id|user_id|customer_id|account_number|iban)(?:_|$)/.test(normalized);
}

function redactString(value,report){
  let out=String(value);
  for(const rule of STRING_REDACTIONS){
    const before=out;
    out=out.replace(rule.re,rule.replacement);
    if(out!==before) report.pattern_redactions[rule.id]=(report.pattern_redactions[rule.id]||0)+1;
  }
  return out;
}

function sanitize(value,report,depth=0){
  if(depth>12) throw new Error('TRAINING_DATASET_DEPTH_EXCEEDED');
  if(value===null||value===undefined) return value;
  if(typeof value==='string') return redactString(value,report);
  if(typeof value==='number'||typeof value==='boolean') return value;
  if(Array.isArray(value)) return value.map(item=>sanitize(item,report,depth+1));
  if(typeof value!=='object') return String(value);

  const out={};
  for(const [rawKey,rawValue] of Object.entries(value)){
    const key=String(rawKey).trim();
    if(!key) continue;
    if(isSensitiveKey(key)){
      const normalizedKey=key.toLowerCase().replace(/[^a-z0-9]+/g,'_');
      report.removed_fields[normalizedKey]=(report.removed_fields[normalizedKey]||0)+1;
      continue;
    }
    out[key]=sanitize(rawValue,report,depth+1);
  }
  return out;
}

function normalizeProvenance(provenance={}){
  const safe={};
  const allowed=['source','source_type','language','domain','task_type','consent_basis'];
  for(const key of allowed){
    const value=cleanText(provenance?.[key],160);
    if(value) safe[key]=value;
  }
  if(Array.isArray(provenance?.evidence_ids)){
    safe.evidence_ids=provenance.evidence_ids
      .map(value=>cleanText(value,160))
      .filter(Boolean)
      .slice(0,100);
  }
  return safe;
}

function deidentifyTrainingExample(example){
  if(!example||typeof example!=='object'||Array.isArray(example)){
    throw new Error('TRAINING_EXAMPLE_INVALID');
  }
  const report={removed_fields:{},pattern_redactions:{}};
  const sanitized=sanitize(example,report);
  return {
    example:sanitized,
    report:{
      removed_field_count:Object.values(report.removed_fields).reduce((a,b)=>a+b,0),
      pattern_redaction_count:Object.values(report.pattern_redactions).reduce((a,b)=>a+b,0),
      removed_fields:report.removed_fields,
      pattern_redactions:report.pattern_redactions
    }
  };
}

function createTrainingDataset({datasetId,examples,provenance={}}={}){
  const id=cleanText(datasetId,160);
  if(!id||!DATASET_ID_RE.test(id)) throw new Error('TRAINING_DATASET_ID_INVALID');
  if(!Array.isArray(examples)||!examples.length) throw new Error('TRAINING_DATASET_EXAMPLES_REQUIRED');
  if(examples.length>5000) throw new Error('TRAINING_DATASET_EXAMPLE_LIMIT');

  const deidentified=examples.map(deidentifyTrainingExample);
  const safeExamples=deidentified.map(item=>item.example);
  const safeProvenance=normalizeProvenance(provenance);
  const material={dataset_id:id,examples:safeExamples,provenance:safeProvenance};
  const datasetDigest=digest(material);

  return {
    version:DATASET_REGISTRY_VERSION,
    dataset_id:id,
    status:'registered',
    dataset_digest:datasetDigest,
    example_count:safeExamples.length,
    provenance:safeProvenance,
    examples:safeExamples,
    deidentification:{
      removed_field_count:deidentified.reduce((sum,item)=>sum+item.report.removed_field_count,0),
      pattern_redaction_count:deidentified.reduce((sum,item)=>sum+item.report.pattern_redaction_count,0)
    },
    policy:{
      deidentified_only:true,
      raw_sensitive_data_allowed:false,
      secrets_allowed:false,
      training_eligible:true,
      immutable_digest:true
    }
  };
}

module.exports={
  DATASET_REGISTRY_VERSION,
  SENSITIVE_KEYS,
  isSensitiveKey,
  deidentifyTrainingExample,
  createTrainingDataset,
  digest
};
