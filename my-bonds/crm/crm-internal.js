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
 const render=data=>{
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
