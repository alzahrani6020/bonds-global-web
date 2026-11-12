(function(){
'use strict';

const API='/api/v3/deals';
const EN=document.documentElement.lang==='en';
const tr=(ar,en)=>EN?en:ar;
const $=selector=>document.querySelector(selector);
const statusEl=()=>$('#dealStatus');
let activeDealId=null;
let hasSharedDeals=false;

function setStatus(message,isError){
  const el=statusEl();
  if(!el)return;
  el.textContent=message||'';
  el.style.color=isError?'#fca5a5':'';
}

async function authHeaders(){
  const headers={'Content-Type':'application/json'};
  if(window.BondsAuth&&window.BondsAuth.getSession){
    const {data}=await window.BondsAuth.getSession();
    const token=data?.session?.access_token;
    if(token)headers.Authorization='Bearer '+token;
  }
  return headers;
}

async function api(path='',options={}){
  const response=await fetch(API+path,{
    ...options,
    headers:{...(await authHeaders()),...(options.headers||{})},
    credentials:'same-origin',
    cache:'no-store'
  });
  let data={};
  try{data=await response.json()}catch(_){}
  if(response.status===401){
    const redirect=encodeURIComponent(location.pathname+location.search);
    location.assign('/calculators/auth?redirect='+redirect);
    throw new Error('AUTHENTICATION_REQUIRED');
  }
  if(!response.ok)throw new Error(data.error||('HTTP_'+response.status));
  return data;
}

function escapeHtml(value){
  return String(value==null?'':value).replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}

function money(value,currency){
  if(value==null||value==='')return '—';
  try{return new Intl.NumberFormat('ar-SA',{style:'currency',currency:currency||'SAR',maximumFractionDigits:0}).format(Number(value))}
  catch(_){return String(value)+' '+String(currency||'')}
}

function row(label,value){
  return '<div class="deal-row"><span>'+escapeHtml(label)+'</span><span>'+escapeHtml(value||'—')+'</span></div>';
}

function renderCollection(el,items,labelFn,valueFn){
  if(!el)return;
  if(!Array.isArray(items)||!items.length){
    el.innerHTML='<div class="deal-empty">'+tr('لا توجد عناصر بعد.','No items yet.')+'</div>';
    return;
  }
  el.innerHTML=items.map(item=>row(labelFn(item),valueFn(item))).join('');
}

async function loadDeal(id){
  setStatus(tr('جاري تحميل الصفقة...','Loading deal...'));
  const data=await api('/'+encodeURIComponent(id));
  const deal=data.deal||{};
  activeDealId=deal.id||id;
  const workspace=data.workspace||{};
  $('#dealCreatePanel').hidden=true;
  $('.deal-section-title').hidden=true;
  $('#dealCards').hidden=true;
  setHidden('#dealSharedPanel',true);
  $('#dealDetail').hidden=false;
  $('#dealTitle').textContent=deal.title||deal.deal_number||tr('الصفقة','Deal');
  $('#dealMeta').textContent=[deal.deal_number,deal.deal_type,deal.stage,money(deal.target_value,deal.currency)].filter(Boolean).join(' · ');
  $('#dealPartyCount').textContent=(workspace.parties||[]).length;
  $('#dealTaskCount').textContent=(workspace.tasks||[]).length;
  $('#dealDdCount').textContent=(workspace.due_diligence||[]).length;
  $('#dealDocumentCount').textContent=(workspace.documents||[]).length;
  renderCollection($('#dealParties'),workspace.parties,x=>x.name,x=>x.party_role);
  renderCollection($('#dealTasks'),workspace.tasks,x=>x.title,x=>x.status);
  renderCollection($('#dealDd'),workspace.due_diligence,x=>x.title,x=>x.area+' · '+x.status);
  renderCollection($('#dealDocuments'),workspace.documents,x=>x.name,x=>x.category+' · '+x.status);
  const access=data.access||{mode:'owner',can:['view_workspace','edit_workspace','manage_members','view_events','edit_deal','link_records']};
  applyAccess(access,deal);
  renderMembers(data.members||[],access);
  loadEvents(access).catch(()=>{});
  const url=new URL(location.href);
  url.searchParams.set('deal',deal.id);
  history.replaceState({},'',url);
  setStatus('');
}

const SIDE_LABELS={advisor:['فريق المستشار','Advisory team'],counterparty:['طرف مقابل','Counterparty'],external_expert:['خبير خارجي','External expert']};
const ROLE_LABELS={deal_manager:['مدير الصفقة','Deal manager'],analyst:['محلل','Analyst'],viewer:['اطلاع','Viewer'],legal:['قانوني','Legal'],auditor:['مراجع','Auditor'],investor_rep:['ممثل مستثمر','Investor rep']};
const NDA_LABELS={not_required:['غير مطلوبة','Not required'],pending:['بانتظار التوقيع','Pending'],signed:['موقعة','Signed'],declined:['مرفوضة','Declined']};
const STATUS_LABELS={invited:['مدعو','Invited'],active:['نشط','Active'],revoked:['ملغى','Revoked']};
const label=(map,key)=>{const pair=map[key];return pair?tr(pair[0],pair[1]):String(key||'—')};

function canDo(access,action){
  return Array.isArray(access&&access.can)&&access.can.includes(action);
}

function setHidden(selector,hidden){
  const el=$(selector);
  if(el)el.hidden=hidden;
}

function applyAccess(access,deal){
  const editable=canDo(access,'edit_workspace');
  document.querySelectorAll('[data-deal-child]').forEach(form=>{form.hidden=!editable});
  setHidden('#dealMembersPanel',!canDo(access,'view_workspace'));
  setHidden('#dealMemberForm',!canDo(access,'manage_members'));
  setHidden('#dealLinkPanel',!canDo(access,'link_records'));
  setHidden('#dealEventsPanel',!canDo(access,'view_events'));
  const note=$('#dealAccessNote');
  if(note){
    if(access.mode==='member'){
      const parts=[label(SIDE_LABELS,access.side),label(ROLE_LABELS,access.member_role)];
      if(access.side==='counterparty')parts.push(tr('اتفاقية السرية: ','NDA: ')+label(NDA_LABELS,access.nda_status));
      if(access.access_expires_at)parts.push(tr('تنتهي الصلاحية: ','Access expires: ')+String(access.access_expires_at).slice(0,10));
      note.textContent=tr('وصول مشارك — ','Shared access — ')+parts.join(' · ');
      if(access.side==='counterparty'&&access.nda_status!=='signed'){
        note.textContent+=tr(' — ستظهر المستندات بعد تسجيل اتفاقية السرية.',' — documents appear once your NDA is recorded.');
      }
    }else{
      note.textContent='';
    }
  }
  const info=$('#dealLinkInfo');
  if(info){
    info.textContent='';
    if(deal.project_id){
      const a=document.createElement('a');
      a.href=(EN?'/en':'')+'/v3/project/?id='+encodeURIComponent(deal.project_id);
      a.textContent=tr('فتح مركز قيادة المشروع المرتبط','Open the linked project Command Center');
      info.appendChild(a);
    }else{
      info.textContent=tr('غير مرتبطة بمشروع.','Not linked to a project.');
    }
  }
  const linkInput=$('#dealLinkForm')?.elements?.project_id;
  if(linkInput)linkInput.value=deal.project_id||'';
}

function renderMembers(members,access){
  const host=$('#dealMembers');
  if(!host)return;
  host.textContent='';
  if(!members.length){
    host.innerHTML='<div class="deal-empty">'+tr('لا يوجد أعضاء بعد.','No members yet.')+'</div>';
    return;
  }
  const manage=canDo(access,'manage_members');
  members.forEach(member=>{
    const rowEl=document.createElement('div');
    rowEl.className='deal-row';
    const who=document.createElement('span');
    who.textContent=[member.display_name,member.email,member.organization].filter(Boolean).join(' · ')||'—';
    const meta=document.createElement('span');
    const bits=[label(SIDE_LABELS,member.side),label(ROLE_LABELS,member.member_role),label(STATUS_LABELS,member.status)];
    if(member.side!=='advisor')bits.push(tr('السرية: ','NDA: ')+label(NDA_LABELS,member.nda_status));
    meta.textContent=bits.join(' · ');
    rowEl.append(who,meta);
    if(manage&&member.status!=='revoked'){
      const actions=document.createElement('span');
      if(member.side!=='advisor'&&member.nda_status!=='signed'){
        actions.appendChild(memberButton(tr('تسجيل توقيع السرية','Record signed NDA'),'nda',member.id));
      }
      actions.appendChild(memberButton(tr('إلغاء الوصول','Revoke access'),'revoke',member.id));
      rowEl.appendChild(actions);
    }
    host.appendChild(rowEl);
  });
}

function memberButton(text,action,id){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=text;
  button.dataset.memberAction=action;
  button.dataset.memberId=id;
  button.style.cssText='width:auto;color:#d4a853;text-decoration:underline;margin-inline-start:8px';
  return button;
}

async function memberAction(button){
  if(!activeDealId)return;
  const id=encodeURIComponent(button.dataset.memberId);
  const base='/'+encodeURIComponent(activeDealId)+'/members/'+id;
  if(button.dataset.memberAction==='nda'){
    const reference=window.prompt(tr('مرجع اتفاقية السرية (اختياري)','NDA reference (optional)'))||'';
    await api(base+'/nda',{method:'POST',body:JSON.stringify({nda_status:'signed',nda_reference:reference})});
  }else if(button.dataset.memberAction==='revoke'){
    if(!window.confirm(tr('إلغاء وصول هذا العضو؟','Revoke this member\'s access?')))return;
    await api(base,{method:'PATCH',body:JSON.stringify({status:'revoked'})});
  }
  await loadDeal(activeDealId);
}

async function inviteMember(event){
  event.preventDefault();
  if(!activeDealId)throw new Error('DEAL_NOT_SELECTED');
  const form=event.currentTarget;
  const payload=Object.fromEntries(new FormData(form).entries());
  if(!payload.access_expires_at)delete payload.access_expires_at;
  setStatus(tr('جاري إرسال الدعوة...','Sending invitation...'));
  await api('/'+encodeURIComponent(activeDealId)+'/members',{method:'POST',body:JSON.stringify(payload)});
  form.reset();
  await loadDeal(activeDealId);
  setStatus(tr('تمت إضافة الدعوة. يحصل العضو على الوصول عند تسجيل الدخول ببريده المؤكد.','Invitation added. The member gets access after signing in with the confirmed email.'));
}

async function saveLink(event){
  event.preventDefault();
  if(!activeDealId)throw new Error('DEAL_NOT_SELECTED');
  const value=String(event.currentTarget.elements.project_id.value||'').trim();
  setStatus(tr('جاري حفظ الربط...','Saving link...'));
  await api('/'+encodeURIComponent(activeDealId)+'/link',{method:'POST',body:JSON.stringify({project_id:value||null})});
  await loadDeal(activeDealId);
}

async function loadEvents(access){
  const host=$('#dealEvents');
  if(!host||!activeDealId||!canDo(access,'view_events'))return;
  const data=await api('/'+encodeURIComponent(activeDealId)+'/events');
  renderCollection(host,(data.events||[]).slice(0,30),x=>x.event_type,x=>String(x.created_at||'').replace('T',' ').slice(0,16));
}

function renderCards(host,deals,withMembership){
  host.innerHTML=deals.map(deal=>
    '<article class="deal-card"><button type="button" data-deal-id="'+escapeHtml(deal.id)+'">'+
    '<strong>'+escapeHtml(deal.title)+'</strong>'+
    '<div class="deal-meta">'+escapeHtml([deal.deal_number,deal.stage,money(deal.target_value,deal.currency)].filter(Boolean).join(' · '))+'</div>'+
    (withMembership&&deal.membership?'<div class="deal-meta">'+escapeHtml(label(SIDE_LABELS,deal.membership.side)+' · '+label(ROLE_LABELS,deal.membership.member_role))+'</div>':'')+
    '</button></article>'
  ).join('');
  host.querySelectorAll('[data-deal-id]').forEach(button=>{
    button.addEventListener('click',()=>loadDeal(button.dataset.dealId).catch(err=>setStatus(err.message,true)));
  });
}

async function loadDeals(){
  setStatus(tr('جاري تحميل الصفقات...','Loading deals...'));
  const data=await api();
  const shared=Array.isArray(data.shared_deals)?data.shared_deals:[];
  const sharedHost=$('#dealSharedCards');
  hasSharedDeals=shared.length>0;
  if(sharedHost){
    setHidden('#dealSharedPanel',!hasSharedDeals);
    renderCards(sharedHost,shared,true);
  }
  const deals=Array.isArray(data.deals)?data.deals:[];
  const host=$('#dealCards');
  host.hidden=false;
  if(!deals.length){
    host.innerHTML='<div class="deal-empty">'+tr('لا توجد صفقات بعد. أنشئ أول سجل صفقة من النموذج أعلاه.','No deals yet. Create the first deal record above.')+'</div>';
  }else{
    host.innerHTML=deals.map(deal=>
      '<article class="deal-card"><button type="button" data-deal-id="'+escapeHtml(deal.id)+'">'+
      '<strong>'+escapeHtml(deal.title)+'</strong>'+
      '<div class="deal-meta">'+escapeHtml([deal.deal_number,deal.stage,money(deal.target_value,deal.currency)].filter(Boolean).join(' · '))+'</div>'+
      '</button></article>'
    ).join('');
    host.querySelectorAll('[data-deal-id]').forEach(button=>{
      button.addEventListener('click',()=>loadDeal(button.dataset.dealId).catch(err=>setStatus(err.message,true)));
    });
  }
  setStatus('');
}

async function createDeal(event){
  event.preventDefault();
  const form=event.currentTarget;
  const payload=Object.fromEntries(new FormData(form).entries());
  if(payload.target_value==='')delete payload.target_value;
  if(!payload.project_id)delete payload.project_id;
  setStatus(tr('جاري إنشاء سجل الصفقة...','Creating deal record...'));
  const data=await api('',{method:'POST',body:JSON.stringify(payload)});
  form.reset();
  if(form.elements.currency)form.elements.currency.value='SAR';
  setHidden('#dealCreateProjectNote',true);
  const url=new URL(location.href);
  url.searchParams.delete('project');
  history.replaceState({},'',url);
  await loadDeals();
  if(data.deal?.id)await loadDeal(data.deal.id);
  if(data.link_warning)setStatus(tr('أُنشئت الصفقة لكن تعذر ربطها بالمشروع: ','Deal created, but linking to the project failed: ')+data.link_warning,true);
}

async function createChild(event){
  event.preventDefault();
  if(!activeDealId)throw new Error('DEAL_NOT_SELECTED');
  const form=event.currentTarget;
  const kind=String(form.dataset.dealChild||'').trim();
  if(!['parties','tasks','due-diligence','documents'].includes(kind))throw new Error('DEAL_CHILD_TYPE_INVALID');
  const payload=Object.fromEntries(new FormData(form).entries());
  setStatus(tr('جاري حفظ العنصر...','Saving item...'));
  await api('/'+encodeURIComponent(activeDealId)+'/'+kind,{
    method:'POST',
    body:JSON.stringify(payload)
  });
  form.reset();
  await loadDeal(activeDealId);
}

function backToList(){
  activeDealId=null;
  $('#dealDetail').hidden=true;
  $('#dealCreatePanel').hidden=false;
  $('.deal-section-title').hidden=false;
  $('#dealCards').hidden=false;
  setHidden('#dealSharedPanel',!hasSharedDeals);
  const url=new URL(location.href);
  url.searchParams.delete('deal');
  history.replaceState({},'',url);
}

document.addEventListener('DOMContentLoaded',async()=>{
  $('#dealCreateForm')?.addEventListener('submit',event=>{
    createDeal(event).catch(err=>setStatus(err.message,true));
  });
  $('#dealBack')?.addEventListener('click',backToList);
  document.querySelectorAll('[data-deal-child]').forEach(form=>{
    form.addEventListener('submit',event=>{
      createChild(event).catch(err=>setStatus(err.message,true));
    });
  });
  $('#dealMemberForm')?.addEventListener('submit',event=>{
    inviteMember(event).catch(err=>setStatus(err.message,true));
  });
  $('#dealLinkForm')?.addEventListener('submit',event=>{
    saveLink(event).catch(err=>setStatus(err.message,true));
  });
  $('#dealMembers')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-member-action]');
    if(button)memberAction(button).catch(err=>setStatus(err.message,true));
  });
  const projectId=new URLSearchParams(location.search).get('project');
  if(projectId&&$('#dealCreateProject')){
    $('#dealCreateProject').value=projectId;
    setHidden('#dealCreateProjectNote',false);
  }
  try{
    await loadDeals();
    const id=new URLSearchParams(location.search).get('deal');
    if(id)await loadDeal(id);
  }catch(err){
    if(err.message!=='AUTHENTICATION_REQUIRED')setStatus(err.message,true);
  }
});

})();
