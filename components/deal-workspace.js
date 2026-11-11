(function(){
'use strict';

const API='/api/v3/deals';
const EN=document.documentElement.lang==='en';
const tr=(ar,en)=>EN?en:ar;
const $=selector=>document.querySelector(selector);
const statusEl=()=>$('#dealStatus');
let activeDealId=null;

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
  const url=new URL(location.href);
  url.searchParams.set('deal',deal.id);
  history.replaceState({},'',url);
  setStatus('');
}

async function loadDeals(){
  setStatus(tr('جاري تحميل الصفقات...','Loading deals...'));
  const data=await api();
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
  setStatus(tr('جاري إنشاء سجل الصفقة...','Creating deal record...'));
  const data=await api('',{method:'POST',body:JSON.stringify(payload)});
  form.reset();
  if(form.elements.currency)form.elements.currency.value='SAR';
  await loadDeals();
  if(data.deal?.id)await loadDeal(data.deal.id);
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
  try{
    await loadDeals();
    const id=new URLSearchParams(location.search).get('deal');
    if(id)await loadDeal(id);
  }catch(err){
    if(err.message!=='AUTHENTICATION_REQUIRED')setStatus(err.message,true);
  }
});

})();
