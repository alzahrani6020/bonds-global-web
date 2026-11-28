'use strict';
// Extract multiple independently labeled entities; avoid attributing unlabeled
// contacts or details to the wrong institution. Proposals only, never writes.
const NAME_LABELS=[
 {type:'organization',pattern:/^(?:اسم\s*(?:الشركة|الجهة|المنشأة|المؤسسة|المصنع|المدرسة|الجامعة|المستشفى|العيادة)|company(?:\s+name)?|organization(?:\s+name)?|business(?:\s+name)?)\s*[:：-]\s*(.{2,180})$/iu},
 {type:'contact',pattern:/^(?:اسم\s*(?:الشخص|المسؤول|جهة الاتصال)|الاسم\s*الكامل|contact(?:\s+name)?|full\s+name|person\s+name)\s*[:：-]\s*(.{2,180})$/iu}
];
const FIELDS={
 email:/^(?:البريد(?:\s*الإلكتروني)?|الايميل|e-?mail)\s*[:：-]\s*(\S+@\S+)$/iu,
 phone:/^(?:الهاتف|الجوال|رقم\s*(?:الهاتف|الجوال)|phone|mobile|telephone)\s*[:：-]\s*([+()0-9 .-]{7,40})$/iu,
 city:/^(?:المدينة|city)\s*[:：-]\s*(.{2,80})$/iu,
 role:/^(?:المنصب|المسمى\s*الوظيفي|job\s+title|role)\s*[:：-]\s*(.{2,100})$/iu
};
function extractLabeledEntityList(text,{filename='document',kind='document',classify}={}){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>120000)throw Error('ENTITY_TEXT_LIMIT');
 const lines=text.split(/\r?\n/);
 const result=[];let active=null;
 for(let i=0;i<lines.length&&i<2000;i++){
  const line=lines[i].trim().replace(/\s+/g,' ');if(!line)continue;
  let found=false;
  for(const rule of NAME_LABELS){
   const m=line.match(rule.pattern);if(!m)continue;
   if(result.length>=200)throw Error('ENTITY_CANDIDATE_LIMIT');
   const name=m[1].trim();
   active={type:rule.type,name,fields:{},evidence:{name:{filename,kind,line:i+1,raw:line}},review_status:'pending'};
   result.push(active);found=true;break;
  }
  if(found||!active)continue;
  for(const [field,re] of Object.entries(FIELDS)){
   const m=line.match(re);
   if(m&&!Object.hasOwn(active.fields,field)){
    active.fields[field]=m[1].trim();
    active.evidence[field]={filename,kind,line:i+1,raw:line};
   }
  }
 }
 return result.map(item=>({...item,classification:item.type==='organization'&&typeof classify==='function'?classify(item.name):null}));
}
module.exports={extractLabeledEntityList};
