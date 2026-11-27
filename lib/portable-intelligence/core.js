'use strict';
// Commercial portable document-intelligence core: NO database, auth, email or outbound HTTP.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES=new Set(['organization','contact']);
const ALIASES={
 type:['type','نوع','نوع الجهة'],name:['name','الاسم','اسم الشركة','اسم الجهة','الجهة','اسم الشخص'],
 sector:['sector','التصنيف','القطاع'],legal_name:['legal_name','الاسم القانوني'],
 city:['city','المدينة'],country:['country','الدولة','البلد'],
 email:['email','البريد','البريد الإلكتروني','الايميل','e-mail'],
 phone:['phone','الهاتف','الجوال','رقم الهاتف','mobile'],
 role:['role','المنصب','الوظيفة','الصفة'],
};
function clean(v,max=240){const s=String(v??'').trim();if(s.length>max||/[\u0000-\u001f\u007f]/.test(s))throw Error('INVALID_FIELD');return s;}
function key(v){return String(v||'').trim().toLocaleLowerCase('en');}
function mapHeaders(headers){const used=new Set();return headers.map(h=>{const k=Object.keys(ALIASES).find(k=>ALIASES[k].some(a=>key(a)===key(h)));if(k&&used.has(k))throw Error('DUPLICATE_COLUMN');if(k)used.add(k);return k||null;});}
function normalizeRows({rows,source,workspaceId,defaultType=null}={}){
 if(!UUID.test(workspaceId||''))throw Error('WORKSPACE_ID_REQUIRED');
 if(!Array.isArray(rows)||rows.length>1000)throw Error('INVALID_ROW_COUNT');
 if(!source||typeof source!=='object'||!clean(source.filename||'',255))throw Error('SOURCE_REQUIRED');
 if(defaultType!==null&&!TYPES.has(defaultType))throw Error('INVALID_TYPE');
 const result=[];const errors=[];const seen=new Set();
 for(let i=0;i<rows.length;i++){
  try{
   const item=rows[i];if(!item||typeof item!=='object'||Array.isArray(item))throw Error('INVALID_ROW');
   const type=key(item.type||defaultType);
   if(!TYPES.has(type))throw Error('TYPE_REVIEW_REQUIRED');
   const name=clean(item.name);if(!name)throw Error('NAME_REQUIRED');
   const email=clean(item.email,254).toLowerCase();
   if(email&&!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email))throw Error('INVALID_EMAIL');
   const phone=clean(item.phone,40);if(phone&&!/^[+()0-9 .-]{3,40}$/.test(phone))throw Error('INVALID_PHONE');
   const duplicate=type+':'+key(name);if(seen.has(duplicate))throw Error('DUPLICATE_IN_FILE');seen.add(duplicate);
   const record={type,name,email:email||null,phone:phone||null};
   if(type==='organization'){record.sector=clean(item.sector||'other',30);record.legal_name=clean(item.legal_name)||null;record.city=clean(item.city,100)||null;record.country=clean(item.country,100)||null;}
   else record.role=clean(item.role,120)||null;
   result.push({workspace_id:workspaceId.toLowerCase(),record,review_status:'pending',confidence:null,source:{filename:clean(source.filename,255),kind:clean(source.kind||'structured',40),sheet:typeof item._sheet==='string'?clean(item._sheet,100):null,row:Number.isInteger(item._sourceRow)&&item._sourceRow>0?item._sourceRow:i+1,page:Number.isInteger(item._page)&&item._page>0?item._page:null}});
  }catch(err){errors.push({row:i+1,code:err.message});}
 }
 return {schema_version:1,workspace_id:workspaceId.toLowerCase(),items:result,errors,requires_manual_approval:true,auto_saved:false};
}
function rowsFromMatrix(matrix,{headerRow=0}={}){
 if(!Array.isArray(matrix)||!Array.isArray(matrix[headerRow]))throw Error('HEADERS_REQUIRED');
 const mapped=mapHeaders(matrix[headerRow]);if(!mapped.includes('name'))throw Error('NAME_COLUMN_REQUIRED');
 return matrix.slice(headerRow+1).map((row,index)=>{
  if(!Array.isArray(row)||!row.some(v=>String(v??'').trim()))return null;
  const obj={_sourceRow:headerRow+index+2};mapped.forEach((col,i)=>{if(col)obj[col]=row[i]??'';});return obj;
 }).filter(Boolean);
}
function proposeFromText(text,{kind='document'}={}){
 const body=String(text??'').replace(/\u0000/g,'').slice(0,200000);
 // No guessing: candidate fields without a named company/person are not records.
 const email=(body.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)||[])[0]||null;
 const phone=(body.match(/(?:\+?\d[\d ()-]{7,}\d)/)||[])[0]||null;
 // Use explicit field labels only. Unlabelled document headings are NOT verified identities.
 const lines=body.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const labeled=(pattern)=>{for(const line of lines){const match=line.match(pattern);if(match){const value=match[1].trim();if(value&&value.length<=240)return value;}}return null;};
 const organization_name=labeled(/^(?:اسم\s*الشركة|اسم\s*الجهة|الشركة|company(?:\s+name)?|organization(?:\s+name)?)\s*[:：-]\s*(.+)$/i);
 const person_name=labeled(/^(?:اسم\s*الشخص|الاسم|full\s*name|contact\s*name)\s*[:：-]\s*(.+)$/i);
 return {kind,candidates:{email,phone,organization_name,person_name},requires_manual_identification:true,records:[]};
}
module.exports={normalizeRows,rowsFromMatrix,proposeFromText,mapHeaders};
