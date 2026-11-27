'use strict';

// Conservative contact extraction. This is review-only; never saves or sends.
const EMAIL=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const RE_EMAIL=/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const NAME_HEAD=/^(?:الاسم|اسم الشركة|اسم المؤسسة|الجهة|الشركة|company|organization|organisation|name|entity|investor|email|e-mail|البريد|البريد الإلكتروني|البريد الالكتروني)$/i;
function clean(s,max=180){return String(s??'').replace(/[\t\r\n]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function candidatesFromRows(rows,limit=250){
 const candidates=[],rejected=[],seen=new Set();
 for(const [i,row] of (Array.isArray(rows)?rows:[]).entries()){
  if(candidates.length>=limit)break;
  const cells=(Array.isArray(row)?row:[row]).map(v=>clean(v,320)).filter(Boolean);
  if(!cells.length)continue;
  const emails=cells.flatMap(cell=>cell.match(RE_EMAIL)||[]).map(e=>e.toLowerCase());
  if(!emails.length)continue;
  const distinct=[...new Set(emails)];
  if(distinct.length!==1||!EMAIL.test(distinct[0])){
   rejected.push({row:i+1,reason:'AMBIGUOUS_EMAIL'});continue;
  }
  const email=distinct[0];
  if(seen.has(email)){rejected.push({row:i+1,reason:'DUPLICATE_EMAIL'});continue;}
  const org=cells.find(cell=>!cell.includes('@')&&!NAME_HEAD.test(cell)&&!/^[0-9.,+\- ]+$/.test(cell))||'';
  if(!org){rejected.push({row:i+1,reason:'ORGANIZATION_MISSING',email});continue;}
  seen.add(email);
  candidates.push({organization:clean(org),email,source_row:i+1,confidence:'medium',review_required:true});
 }
 return {candidates,rejected};
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
 const rows=Array.isArray(parsed.rows)?parsed.rows:[];
 const outcome=rows.length?candidatesFromRows(rows):candidatesFromText(parsed.text);
 return {...outcome,requires_review:true,total_candidates:outcome.candidates.length};
}
module.exports={candidatesFromRows,candidatesFromText,extractRecipients};
