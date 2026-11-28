'use strict';
// Commercial entity suggestions only: never creates CRM, HR or correspondence records.
const MAX_TEXT=120000;
const {extractLabeledEntityList}=require('./labeled-entity-list');
const categories={
 government:/\b(?:ministry|municipality|government|authority|public agency)\b|(?:وزارة|هيئة حكومية|بلدية|أمانة)/iu,
 university:/\b(?:university|college)\b|(?:جامعة|كلية)/iu,
 school:/\b(?:school|academy)\b|(?:مدرسة|مدارس|أكاديمية)/iu,
 hospital:/\b(?:hospital|medical center)\b|(?:مستشفى|مركز طبي)/iu,
 clinic:/\b(?:clinic|polyclinic)\b|(?:عيادة|مجمع طبي)/iu,
 factory:/\b(?:factory|manufacturing|industrial plant)\b|(?:مصنع|مصانع|معمل صناعي)/iu,
 nonprofit:/\b(?:charity|nonprofit|non-profit)\b|(?:جمعية خيرية|مؤسسة غير ربحية)/iu,
 organization:/\b(?:company|corporation|co\.|llc|establishment|enterprise)\b|(?:شركة|مؤسسة|منشأة)/iu
};
const LABELS={
 organization_name:/^(?:اسم\s*(?:الشركة|الجهة|المنشأة|المؤسسة|المصنع|المدرسة|الجامعة|المستشفى|العيادة)|الشركة|الجهة|company(?:\s+name)?|organization(?:\s+name)?|business(?:\s+name)?)\s*[:：\-]\s*(.{2,180})$/iu,
 contact_name:/^(?:اسم\s*(?:الشخص|المسؤول|جهة الاتصال)|الاسم\s*الكامل|contact(?:\s+name)?|full\s+name|person\s+name)\s*[:：\-]\s*(.{2,180})$/iu,
 city:/^(?:المدينة|city|location)\s*[:：\-]\s*(.{2,80})$/iu,
 role:/^(?:المسمى\s*الوظيفي|المنصب|الوظيفة|position|job\s+title|role)\s*[:：\-]\s*(.{2,100})$/iu
};
function clean(s){return String(s||'').normalize('NFKC').replace(/[\u200e\u200f\u2066-\u2069]/g,'').trim().replace(/\s+/g,' ')}
function norm(s){return clean(s).toLocaleLowerCase('en').replace(/[\u064B-\u065F]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي')}
function classify(name){const matches=Object.entries(categories).filter(([,rule])=>rule.test(name)).map(([category])=>category);return {category:matches.length===1?matches[0]:null,possible_categories:matches,requires_review:matches.length!==1};}
function htmlToEvidenceText(html){
 return String(html||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
  .replace(/<\/?(?:p|div|tr|li|h[1-6]|br|section|article|td|th)\b[^>]*>/gi,'\n')
  .replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function analyzeEntities(text,{filename='document',kind='document'}={}){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_TEXT)throw Error('ENTITY_TEXT_LIMIT');
 const lines=text.split(/\r?\n/).map(x=>clean(x)).filter(Boolean).slice(0,2000);
 const matches={},provenance={};
 for(let i=0;i<lines.length;i++)for(const [field,re] of Object.entries(LABELS)){
  const m=lines[i].match(re);if(m&&!matches[field]){matches[field]=clean(m[1]);provenance[field]={filename,kind,line:i+1,raw:lines[i]};}
 }
 const email=(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu)||[])[0]||null;
 const phone=(text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{3,4}/u)||[])[0]||null;
 if(email)matches.email=email;if(phone&&/\d{7,}/.test(phone.replace(/\D/g,'')))matches.phone=phone;
 const items=extractLabeledEntityList(text,{filename,kind,classify});
 const labelName=matches.organization_name||matches.contact_name||null;
 const classification=labelName?classify(labelName):{category:null,possible_categories:[],requires_review:true};
 return {schema_version:1,source:{filename,kind},candidates:matches,provenance,classification,items,requires_manual_approval:true,auto_saved:false,records:[],confidence:'unverified'};
}
function possibleDuplicates(candidate,existing){
 if(!candidate||!Array.isArray(existing)||existing.length>1000)throw Error('INVALID_DUPLICATE_INPUT');
 const name=norm(candidate.name),email=norm(candidate.email),phone=String(candidate.phone||'').replace(/\D/g,'');
 return existing.filter(x=>x&&x.type===candidate.type).map(x=>({id:x.id,reasons:[name&&norm(x.name)===name?'name':null,email&&norm(x.email)===email?'email':null,phone.length>=8&&String(x.phone||'').replace(/\D/g,'')===phone?'phone':null].filter(Boolean)})).filter(x=>x.reasons.length);
}
module.exports={analyzeEntities,possibleDuplicates,classify,norm,htmlToEvidenceText};
