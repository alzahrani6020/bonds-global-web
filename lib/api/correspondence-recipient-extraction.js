'use strict';

// Conservative contact extraction. This is review-only; never saves or sends.
const EMAIL=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const RE_EMAIL=/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const NAME_HEAD=/^(?:الاسم|اسم الشركة|اسم المؤسسة|الجهة|الشركة|company|organization|organisation|name|entity|email|e-mail|البريد|البريد الإلكتروني|البريد الالكتروني)$/i;
function clean(s,max=180){return String(s??'').replace(/[\t\r\n]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
// Prefer verified, named contact columns over unrelated prose, reply footers
// or sender addresses embedded elsewhere in investor campaign spreadsheets.
function headerName(value) {
 return clean(value,180).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ـ/g,'').replace(/\s+/g,' ').trim();
}
const CONTACT_EMAIL_HEADERS=new Set([
 'البريد الالكتروني','البريد الالكترونى','البريد','الايميل','ايميل',
 'email','e-mail','email address','e-mail address','contact email'
]);
const CONTACT_NAME_HEADERS=new Set([
 'اسم الجهة','اسم الشركة / الجهة','اسم الشركة/الجهة','اسم الشركة',
 'اسم المؤسسة','الجهة','الشركة','المؤسسة','الاسم','company',
 'organization','organisation','entity','company name','organization name','name'
]);
function detectColumns(rows){
 for(let i=0;i<Math.min(8,rows.length);i++){
  const row=Array.isArray(rows[i])?rows[i]:[rows[i]];
  const keys=row.map(headerName);
  const emailIndex=keys.findIndex(v=>CONTACT_EMAIL_HEADERS.has(v));
  const nameIndex=keys.findIndex(v=>CONTACT_NAME_HEADERS.has(v));
  if(emailIndex>=0&&nameIndex>=0&&emailIndex!==nameIndex)
   return {headerIndex:i,emailIndex,nameIndex};
 }
 return null;
}
function candidatesFromRows(rows,limit=250){
 const candidates=[],rejected=[],seen=new Set(),source=Array.isArray(rows)?rows:[];
 const columns=detectColumns(source);
 let truncated=false;
 for(const [i,row] of source.entries()){
  if(columns&&i<=columns.headerIndex)continue;
  if(candidates.length>=limit){truncated=true;break;}
  const cells=(Array.isArray(row)?row:[row]).map(v=>clean(v,320));
  if(!cells.some(Boolean))continue;
  if(columns){
   const org=clean(cells[columns.nameIndex],180);
   const value=clean(cells[columns.emailIndex],320).toLowerCase();
   if(!value)continue;
   if(!EMAIL.test(value)){rejected.push({row:i+1,reason:'INVALID_EMAIL_COLUMN'});continue;}
   if(!org||NAME_HEAD.test(org)){rejected.push({row:i+1,reason:'ORGANIZATION_MISSING',email:value});continue;}
   if(seen.has(value)){rejected.push({row:i+1,reason:'DUPLICATE_EMAIL'});continue;}
   seen.add(value);
   candidates.push({organization:org,email:value,source_row:i+1,confidence:'high',review_required:true});
   continue;
  }
  const nonempty=cells.filter(Boolean);
  const emails=nonempty.flatMap(cell=>cell.match(RE_EMAIL)||[]).map(e=>e.toLowerCase());
  if(!emails.length)continue;
  const distinct=[...new Set(emails)];
  if(distinct.length!==1||!EMAIL.test(distinct[0])){
   rejected.push({row:i+1,reason:'AMBIGUOUS_EMAIL'});continue;
  }
  const email=distinct[0];
  if(seen.has(email)){rejected.push({row:i+1,reason:'DUPLICATE_EMAIL'});continue;}
  const org=nonempty.find(cell=>!cell.includes('@')&&!NAME_HEAD.test(cell)&&!/^[0-9.,+\- ]+$/.test(cell))||'';
  if(!org){rejected.push({row:i+1,reason:'ORGANIZATION_MISSING',email});continue;}
  seen.add(email);
  candidates.push({organization:clean(org),email,source_row:i+1,confidence:'medium',review_required:true});
 }
 return {candidates,rejected,...(truncated?{truncated:true}:{}),...(columns?{recognized_contact_columns:true}:{})};
}
function candidatesFromText(text,limit=250){
 const lines=String(text||'').split(/\r?\n/).slice(0,20000);
 const candidates=[],rejected=[],seen=new Set();
 for(const [i,line] of lines.entries()){
  if(candidates.length>=limit)break;
  const emails=[...new Set((line.match(RE_EMAIL)||[]).map(v=>v.toLowerCase()))];
  if(!emails.length)continue;
  if(emails.length!==1){rejected.push({row:i+1,reason:'AMBIGUOUS_EMAIL'});continue;}
  const email=emails[0];
  if(seen.has(email))continue;
  const surrounding=clean(line.replace(RE_EMAIL,'').replace(/[|,;:]+/g,' '),180);
  if(!surrounding||NAME_HEAD.test(surrounding)){
    rejected.push({row:i+1,reason:'ORGANIZATION_REQUIRES_REVIEW',email});continue;
  }
  seen.add(email);
  candidates.push({organization:surrounding,email,source_row:i+1,confidence:'low',review_required:true});
 }
 return {candidates,rejected};
}
function extractRecipients(parsed){
 if(!parsed||typeof parsed!=='object')return {candidates:[],rejected:[],requires_review:true};
 const sheets=Array.isArray(parsed.sheets)?parsed.sheets:[];
 const compatible=sheets.map(sheet=>({
   name:clean(sheet?.name,100),rows:Array.isArray(sheet?.rows)?sheet.rows:[]
 })).filter(sheet=>detectColumns(sheet.rows));
 let outcome,selectedSheet;
 if(compatible.length){
  // Prefer the sheet with the most clearly identified contact records;
  // on a tie preserve workbook order, never infer from a summary worksheet.
  const reviewed=compatible.map(sheet=>({...sheet,result:candidatesFromRows(sheet.rows)}));
  reviewed.sort((a,b)=>b.result.candidates.length-a.result.candidates.length);
  selectedSheet=reviewed[0].name;
  outcome=reviewed[0].result;
 }else{
  const rows=Array.isArray(parsed.rows)?parsed.rows:[];
  outcome=rows.length?candidatesFromRows(rows):candidatesFromText(parsed.text);
 }
 return {...outcome,requires_review:true,total_candidates:outcome.candidates.length,
   ...(selectedSheet?{source_sheet:selectedSheet}:{})};
}
module.exports={candidatesFromRows,candidatesFromText,extractRecipients};
