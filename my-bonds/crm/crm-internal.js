/* Internal BONDS operations inside the single CRM shell.
 * Only /api/admin with server-side crm.read/crm.write authorization can
 * return internal records. Never mix this data into tenant-scoped tables.
 */
(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 const en=document.documentElement.lang==='en';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const status=(message,fail=false)=>{const node=el('internal-crm-status');node.textContent=message;node.style.color=fail?'#fca5a5':'';};
 const api=async(action,options={})=>{
  const response=await window.BondsAuth.authenticatedFetch('/api/admin?action='+encodeURIComponent(action),{...options,returnTo:location.pathname+location.search});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.success!==true)throw Error(result.error||('HTTP '+response.status));
  return result;
 };
 const fmt=n=>Number(n||0).toLocaleString(en?'en-US':'ar-SA');
 let snapshot=null;
 const recordCollections={client:'clients',organization:'organizations',deal:'opportunities',activity:'activities'};
 const fieldSchemas={
  client:[['name','Name','text',true],['email','Email'],['phone','Phone'],['company_name','Company'],['status','Status'],['source','Source'],['organization_id','Organization','ref:organization'],['relationship_role','Role'],['is_decision_maker','Decision maker','checkbox']],
  organization:[['name','Name','text',true],['legal_name','Legal name'],['sector','Sector'],['country','Country'],['city','City'],['domain','Domain'],['tax_number','Tax number'],['status','Status']],
  deal:[['title','Title','text',true],['organization_id','Organization','ref:organization'],['client_id','Contact','ref:client'],['stage','Stage','select:lead|qualified|proposal|negotiation|won|lost'],['value_amount','Value','number'],['probability','Probability %','number'],['next_action','Next action'],['next_action_at','Next action time','datetime-local'],['expected_close_date','Expected close','date']],
  activity:[['subject','Subject','text',true],['client_id','Contact','ref:client'],['organization_id','Organization','ref:organization'],['opportunity_id','Deal','ref:deal'],['activity_type','Type','select:task|call|meeting|email|note|whatsapp|sms|visit'],['status','Status','select:open|completed|cancelled'],['scheduled_at','Scheduled','datetime-local'],['details','Details','textarea']]
 };
 const toLocal=value=>{
  if(!value)return '';
  const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
 };
 function updateEditor(){
  const type=el('internal-crm-record-type').value,items=snapshot?.[recordCollections[type]]||[];
  const choices=items.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.title||item.name||item.subject||item.id)+'</option>').join('');
  const select=el('internal-crm-record-id'),keep=select.dataset.keep||'';
  select.innerHTML='<option value="">'+(en?'Create new':'إضافة جديد')+'</option>'+choices;
  if(items.some(item=>item.id===keep))select.value=keep;
  delete select.dataset.keep;
  const record=items.find(item=>item.id===select.value)||{};
  el('internal-crm-fields').innerHTML=fieldSchemas[type].map(([key,label,spec='text',required=false])=>{
   const value=record[key],title=esc(label);
   if(spec.startsWith('ref:')){
    const collection=recordCollections[spec.slice(4)];
    const values=snapshot?.[collection]||[];
    return '<label>'+title+'<select name="'+key+'"><option value="">—</option>'+
     values.map(item=>'<option value="'+esc(item.id)+'"'+(String(item.id)===String(value)?' selected':'')+'>'+esc(item.title||item.name||item.id)+'</option>').join('')+'</select></label>';
   }
   if(spec==='checkbox')return '<label>'+title+'<input name="'+key+'" type="checkbox"'+(value?' checked':'')+'></label>';
   if(spec==='textarea')return '<label>'+title+'<textarea name="'+key+'">'+esc(value||'')+'</textarea></label>';
   if(spec.startsWith('select:'))return '<label>'+title+'<select name="'+key+'">'+spec.slice(7).split('|').map(x=>
    '<option value="'+esc(x)+'"'+(x===value?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>';
   const v=spec==='datetime-local'?toLocal(value):value??'';
   return '<label>'+title+'<input name="'+key+'" type="'+spec+'" value="'+esc(v)+'"'+(required?' required':'')+'></label>';
  }).join('');
 }

 const render=data=>{
  snapshot=data;updateEditor();
  const deals=data.opportunities||[],clients=data.clients||[],requests=data.serviceRequests||[];
  el('internal-crm-metrics').innerHTML=[
   [en?'Organizations':'المؤسسات',(data.organizations||[]).length],
   [en?'Contacts':'جهات الاتصال',clients.length],
   [en?'Deals':'الفرص',deals.length],
   [en?'Service requests':'طلبات الخدمات',requests.length]
  ].map(([name,num])=>'<div class="kpi"><b>'+fmt(num)+'</b><span>'+esc(name)+'</span></div>').join('');
  const choices=['submitted','triage','in_progress','awaiting_client','awaiting_approval','completed','cancelled'];
  const statusLabel={submitted:'تم الإرسال',triage:'قيد الفرز',in_progress:'قيد التنفيذ',awaiting_client:'بانتظار العميل',awaiting_approval:'بانتظار الاعتماد',completed:'مكتمل',cancelled:'ملغي'};
  el('internal-crm-requests').innerHTML=requests.map(r=>{
   const service=r.service||{},client=r.client||{};
   return '<tr><td>'+esc(r.request_reference||r.id)+'</td><td>'+esc(service.name_ar||service.name_en||service.code||'—')+
    '</td><td>'+esc(client.name||client.company_name||'—')+'</td><td><select aria-label="'+(en?'Request status':'حالة الطلب')+'" data-request-status="'+esc(r.id)+'">'+
    choices.map(s=>'<option value="'+s+'"'+(r.status===s?' selected':'')+'>'+esc(en?s:statusLabel[s])+'</option>').join('')+
    '</select></td><td><button type="button" class="secondary" data-request-save="'+esc(r.id)+'">'+(en?'Save':'حفظ')+'</button></td></tr>';
  }).join('')||'<tr><td colspan="5">'+(en?'No requests':'لا توجد طلبات')+'</td></tr>';
  el('internal-crm-deals').innerHTML=deals.map(d=>{
   const score=d.commercial_score||{};
   return '<tr><td>'+esc(d.title)+'</td><td>'+esc(d.stage)+'</td><td>'+fmt(d.value_amount)+' '+esc(d.currency||'SAR')+'</td><td>'+
    esc(score.score==null?'UNKNOWN':score.score+'/100')+' · '+esc(String(score.confidence||'UNKNOWN').toUpperCase())+' · '+esc(score.coverage??0)+'%</td></tr>';
  }).join('')||'<tr><td colspan="4">'+(en?'No deals':'لا توجد فرص')+'</td></tr>';
  el('internal-crm-organizations').innerHTML=(data.organizations||[]).map(o=>
   '<tr><td>'+esc(o.name)+'</td><td>'+esc(o.sector||'—')+'</td><td>'+esc(o.country||'—')+'</td><td>'+esc(o.status||'—')+'</td></tr>'
  ).join('')||'<tr><td colspan="4">'+(en?'No organizations':'لا توجد مؤسسات')+'</td></tr>';
  el('internal-crm-activities').innerHTML=(data.activities||[]).filter(a=>!a.deleted_at).map(a=>
   '<tr><td>'+esc(a.subject)+'</td><td>'+esc(a.activity_type||'—')+'</td><td>'+esc(a.status||'—')+'</td><td>'+esc(a.scheduled_at||'—')+'</td></tr>'
  ).join('')||'<tr><td colspan="4">'+(en?'No activities':'لا توجد أنشطة')+'</td></tr>';
  el('internal-crm-clients').innerHTML=clients.map(c=>{
   const score=c.commercial_score||{};
   return '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.company_name||'—')+'</td><td>'+esc(c.status||'—')+'</td><td>'+
    esc(score.score==null?'UNKNOWN':score.score+'/100')+' · '+esc(String(score.confidence||'UNKNOWN').toUpperCase())+' · '+esc(score.coverage??0)+'%</td></tr>';
  }).join('')||'<tr><td colspan="4">'+(en?'No contacts':'لا توجد جهات اتصال')+'</td></tr>';
  const lifecycle=[
   ...(data.renewals||[]).map(r=>[en?'Renewal':'تجديد',r.status,r.risk_level,r.renewal_date]),
   ...(data.customerSuccessRecords||[]).map(r=>[en?'Customer success':'نجاح العملاء',r.lifecycle_stage,r.risk_level,r.next_review_at])
  ];
  el('internal-crm-lifecycle').innerHTML=lifecycle.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v||'—')+'</td>').join('')+'</tr>').join('')||
   '<tr><td colspan="4">'+(en?'No records':'لا توجد سجلات')+'</td></tr>';
 };
 let ready=false;
 async function reload(){
  try{status(en?'Loading…':'جار تحميل البيانات…');const data=await api('crm-overview');render(data);status('');}
  catch(err){status((en?'Unable to load records: ':'تعذر تحميل السجلات: ')+err.message,true);}
 }
 const open=el('internal-crm-open');
 async function initialize(){
  // Permission probe uses the same admin endpoint already protected by crm.read.
  try{
   await window.BondsAuth.ensureEnv();
   const supabase=window.BondsAuth.getSupabase();
   const auth=await supabase.auth.getUser();
   if(!auth.data?.user)return;
   const data=await api('crm-overview');
   ready=true;open.hidden=false;render(data);
  }catch(_err){open.hidden=true;ready=false;}
 }
 open.addEventListener('click',async()=>{
  if(!ready)return;
  el('workspace-content').hidden=true;
  el('internal-crm-panel').hidden=false;
  open.setAttribute('aria-expanded','true');
  await reload();
 });
 el('internal-crm-back').addEventListener('click',()=>{
  el('internal-crm-panel').hidden=true;
  el('workspace-content').hidden=false;
  open.setAttribute('aria-expanded','false');
 });
 el('internal-crm-refresh').addEventListener('click',reload);
 el('internal-crm-record-type').addEventListener('change',()=>{el('internal-crm-record-id').value='';updateEditor();});
 el('internal-crm-record-id').addEventListener('change',updateEditor);
 el('internal-crm-editor').addEventListener('submit',async event=>{
  event.preventDefault();
  const type=el('internal-crm-record-type').value,id=el('internal-crm-record-id').value;
  const fd=new FormData(event.currentTarget),body={},fields=fieldSchemas[type];
  for(const [key,,spec='text'] of fields){
   let value=spec==='checkbox'?fd.has(key):String(fd.get(key)||'').trim();
   if(spec==='number'){value=value===''?null:Number(value);if(value!==null&&!Number.isFinite(value))return status('Invalid number',true);}
   if(spec==='datetime-local'&&value)value=new Date(value).toISOString();
   body[key]=value===''?null:value;
  }
  if(id)body.id=id;
  if(type==='deal'&&id=== ''){delete body.probability;if(body.value_amount===null)body.value_amount=0;}
  const actions={
   client:id?'crm-client-update':'crm-client-create',
   organization:id?'crm-organization-update':'crm-organization-create',
   deal:id?'crm-opportunity-update':'crm-opportunity-create',
   activity:id?'crm-activity-update':'crm-activity-create'
  };
  const action=actions[type],button=el('internal-crm-save');
  button.disabled=true;
  try{
   await api(action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   await reload();status(en?'Record saved successfully':'حُفظ السجل بنجاح');
  }catch(err){status((en?'Save failed: ':'فشل حفظ السجل: ')+err.message,true);}
  finally{button.disabled=false;}
 });

 el('internal-crm-requests').addEventListener('click',async event=>{
  const button=event.target.closest('[data-request-save]');
  if(!button)return;
  const id=button.dataset.requestSave;
  const input=[...el('internal-crm-requests').querySelectorAll('[data-request-status]')].find(n=>n.dataset.requestStatus===id);
  if(!input)return;
  button.disabled=true;
  try{
   await api('service-request-status-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:input.value})});
   await reload();status(en?'Request status saved':'حُفظت حالة الطلب');
  }catch(err){status((en?'Save failed: ':'فشل الحفظ: ')+err.message,true);}
  finally{button.disabled=false;}
 });
 initialize();
})();
