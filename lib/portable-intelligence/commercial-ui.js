'use strict';
const el=id=>document.getElementById(id);
let previewId=null,analysis=null,approvalIndices=null;
let selectedRecord=null;
function notice(message,error=false){el('notice').textContent=message;el('notice').classList.toggle('error',Boolean(error))}
async function api(endpoint,{method='GET',body}={}){
 const response=await fetch(endpoint,{method,headers:body?{'Content-Type':'application/json'}:{},credentials:'same-origin',body:body?JSON.stringify(body):undefined});
 let data;try{data=await response.json()}catch{throw Error('تعذر قراءة استجابة الخادم')}
 if(!response.ok)throw Error(String(data.error||'REQUEST_FAILED'));
 return data;
}
function run(action){return async event=>{event?.preventDefault();try{await action()}catch(e){notice('تعذر التنفيذ: '+e.message,true)}}}
function fillCandidate(){
 const index=Number(el('candidate').value),candidate=analysis?.entity_suggestions?.items?.[index];
 if(!candidate){el('type').value='organization';el('name').value='';el('email').value='';el('phone').value='';el('city').value='';el('sector').value='';return}
 el('type').value=candidate.type;
 el('name').value=candidate.name||'';
 el('email').value=candidate.fields?.email||'';
 el('phone').value=candidate.fields?.phone||'';
 el('city').value=candidate.fields?.city||'';
 el('sector').value=candidate.classification?.category||'';
 el('nameOverride').checked=false;el('emailOverride').checked=false;
}
function renderRecord(items){
 const root=el('recordsOutput');root.replaceChildren();
 if(!items.length){root.textContent='لا توجد سجلات مطابقة';return}
 const table=document.createElement('table');
 const head=document.createElement('tr');
 for(const title of ['ID','الاسم','النوع','البريد','الهاتف','المدينة','إجراء']){const th=document.createElement('th');th.textContent=title;head.append(th)}
 table.append(head);
 for(const item of items){
  const tr=document.createElement('tr');
  for(const val of [item.id,item.record.name,item.record.type,item.record.email,item.record.phone,item.record.city]){const td=document.createElement('td');td.textContent=String(val??'');tr.append(td)}
  const td=document.createElement('td');const edit=document.createElement('button');edit.type='button';edit.textContent='مراجعة / تعديل';
  edit.addEventListener('click',()=>{selectedRecord=item;el('editPanel').hidden=false;el('editName').value=item.record.name||'';el('editEmail').value=item.record.email||'';el('editPhone').value=item.record.phone||'';el('editCity').value=item.record.city||'';});
  td.append(edit);tr.append(td);table.append(tr);
 }
 root.append(table);
}
async function loadRecords(){const data=await api('/records');renderRecord(data.items)}
el('loginForm').addEventListener('submit',run(async()=>{
 await api('/login',{method:'POST',body:{username:el('username').value,password:el('password').value}});
 el('password').value='';el('loginPanel').hidden=true;el('workspace').hidden=false;notice('تم تسجيل الدخول');await loadRecords();
}));
el('logout').addEventListener('click',run(async()=>{
 await api('/logout',{method:'POST',body:{}});
 previewId=null;analysis=null;el('workspace').hidden=true;el('reviewPanel').hidden=true;el('loginPanel').hidden=false;el('approve').disabled=true;el('password').value='';notice('تم الخروج');
}));
el('uploadForm').addEventListener('submit',run(async()=>{
 const file=el('file').files?.[0];if(!file)throw Error('FILE_REQUIRED');
 if(file.size>5*1024*1024)throw Error('INVALID_FILE_SIZE');
 const raw=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('FILE_READ_FAILED'));reader.readAsDataURL(file)});
 const base64=String(raw).split(',')[1];
 const result=await api('/analyze',{method:'POST',body:{filename:file.name,base64}});
 previewId=result.preview_id;analysis=result.analysis;approvalIndices=null;el('approve').disabled=true;
 el('analysisOutput').textContent=JSON.stringify(analysis,null,2);
 const candidates=analysis.entity_suggestions?.items||[];
 const pick=el('candidate');pick.replaceChildren();
 candidates.forEach((candidate,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+'. '+candidate.name+' — '+candidate.type;pick.append(option)});
 if(candidates.length){
  el('reviewPanel').hidden=false;el('reviewForm').hidden=false;fillCandidate();notice('تحقق من كل اسم وحقل ثم جهز السجل للموافقة');
 }else if(Array.isArray(analysis.items)&&analysis.items.length){
  el('reviewPanel').hidden=false;el('reviewForm').hidden=true;
  el('reviewOutput').textContent=JSON.stringify(analysis.items,null,2);el('approve').disabled=false;
  approvalIndices=analysis.items.map((_,i)=>i);
  notice('راجع جميع السجلات المنظمة قبل اعتمادها');
 }else if(analysis.entity_suggestions){
  const manual=document.createElement('option');manual.value='0';manual.textContent='إضافة هوية يدوية بعد مراجعة المصدر';pick.append(manual);
  el('reviewPanel').hidden=false;el('reviewForm').hidden=false;fillCandidate();notice('لا توجد هوية موسومة؛ أدخل الهوية يدويًا بعد مراجعة المستند');
 }else{el('reviewPanel').hidden=true;notice('الملف لم ينتج سجلات قابلة للمراجعة. لم تُحفظ بيانات.',true)}
}));
el('candidate').addEventListener('change',fillCandidate);
el('reviewForm').addEventListener('submit',run(async()=>{
 if(!previewId)throw Error('PREVIEW_NOT_FOUND');
 const identity={type:el('type').value,name:el('name').value,email:el('email').value,phone:el('phone').value,city:el('city').value,sector:el('sector').value,identityOverrideConfirmed:el('nameOverride').checked,evidenceOverrideConfirmed:el('emailOverride').checked};
 const response=await api('/review',{method:'POST',body:{preview_id:previewId,entityIndex:Number(el('candidate').value),identity}});
 el('reviewOutput').textContent=JSON.stringify(response,null,2);
 approvalIndices=[0];el('approve').disabled=false;notice('تحقق من البيانات والتكرارات ثم اضغط اعتماد');
}));
el('approve').addEventListener('click',run(async()=>{
 if(!previewId||!approvalIndices)throw Error('REVIEW_REQUIRED');
 const result=await api('/commit',{method:'POST',body:{preview_id:previewId,approve:true,approvedIndices:approvalIndices}});
 notice('حُفظ '+result.saved+' سجل معتمد؛ أعد فتح قاعدة البيانات للتحقق');
 el('approve').disabled=true;previewId=null;await loadRecords();
}));
el('editForm').addEventListener('submit',run(async()=>{
 if(!selectedRecord)throw Error('RECORD_NOT_SELECTED');
 const changes={name:el('editName').value,email:el('editEmail').value,phone:el('editPhone').value,city:el('editCity').value};
 await api('/update',{method:'POST',body:{id:selectedRecord.id,changes}});
 el('editPanel').hidden=true;selectedRecord=null;notice('حُفظ تعديل السجل مع سجل تدقيق');await loadRecords();
}));
el('archive').addEventListener('click',run(async()=>{
 if(!selectedRecord)throw Error('RECORD_NOT_SELECTED');
 if(!window.confirm('هل تريد أرشفة هذا السجل؟ ستُحفظ بياناته وسجل تدقيقه، ولن يظهر في نتائج البحث العادية.'))return;
 await api('/archive',{method:'POST',body:{id:selectedRecord.id,confirm:true}});
 selectedRecord=null;el('editPanel').hidden=true;notice('أُرشف السجل دون حذفه نهائيًا');await loadRecords();
}));
el('cancelEdit').addEventListener('click',()=>{selectedRecord=null;el('editPanel').hidden=true});
el('searchForm').addEventListener('submit',run(async()=>{const r=await api('/search?q='+encodeURIComponent(el('searchTerm').value));renderRecord(r.items)}));
el('reload').addEventListener('click',run(loadRecords));
el('exportForm').addEventListener('submit',run(async()=>{
 const recordIds=el('recordIds').value.split(',').map(x=>Number(x.trim()));
 const response=await api('/export',{method:'POST',body:{target:el('target').value,recordIds}});
 el('exportOutput').textContent=JSON.stringify(response,null,2);
 notice('أُعدت حزمة مشاركة مصرح بها. لم تُرسل بيانات إلى النظام المستهدف.');
}));
