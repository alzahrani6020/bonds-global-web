(function(){
'use strict';

const API='/api/v3/deals';
const EN=document.documentElement.lang==='en';
const tr=(ar,en)=>EN?en:ar;
const $=selector=>document.querySelector(selector);
const statusEl=()=>$('#dealStatus');
let activeDealId=null;
let hasSharedDeals=false;
const params=new URLSearchParams(location.search);
const sharedView=params.get('view')==='shared'||location.hash==='#dealSharedPanel';

function safeReturnTo(){
  const value=params.get('return_to')||'';
  return value.startsWith('/')&&!value.startsWith('//')?value:'';
}

function renderContextReturn(){
  const target=safeReturnTo();
  if(!target)return;
  const host=$('#dealLinkInfo')||$('#dealStatus');
  if(!host||document.getElementById('dealContextReturn'))return;
  const link=document.createElement('a');
  link.id='dealContextReturn';
  link.href=target;
  link.textContent=tr('العودة إلى مركز المشروع','Back to project');
  link.style.cssText='display:inline-flex;margin-inline-start:10px;color:#d4a853;text-decoration:underline;font-weight:700;';
  host.appendChild(link);
}

function applyListMode(){
  const create=$('#dealCreatePanel');
  const title=document.querySelector('.deal-section-title');
  const cards=$('#dealCards');
  const sharedPanel=$('#dealSharedPanel');
  const detail=$('#dealDetail');
  const pageTitle=$('#dealPageTitle');
  const pageSubtitle=$('#dealPageSubtitle');
  const breadcrumb=$('#dealBreadcrumbLabel');
  const detailOpen=Boolean(detail&&!detail.hidden);

  // Deal detail is mutually exclusive with every list surface. This guard
  // must run before shared/owned list-mode logic so loadDeal() cannot be
  // undone by applyListMode(). backToList() hides detail before calling us,
  // which restores the appropriate owned or shared list.
  if(detailOpen){
    if(create)create.hidden=true;
    if(title)title.hidden=true;
    if(cards)cards.hidden=true;
    if(sharedPanel)sharedPanel.hidden=true;
    return;
  }

  if(sharedView){
    if(create)create.hidden=true;
    if(title)title.hidden=true;
    if(cards)cards.hidden=true;
    if(sharedPanel)sharedPanel.hidden=false;
    if(pageTitle)pageTitle.textContent=tr('فرص مشاركة معي','Deals shared with me');
    if(pageSubtitle)pageSubtitle.textContent=tr(
      'الصفقات والفرص التي تمت دعوتك إليها أو مشاركتها مع بريدك المؤكد.',
      'Deals and opportunities explicitly shared with your verified account.'
    );
    if(breadcrumb)breadcrumb.textContent=tr('فرص مشاركة معي','Shared with me');
  }else{
    if(create)create.hidden=false;
    if(title)title.hidden=false;
    if(cards)cards.hidden=false;
    if(sharedPanel)sharedPanel.hidden=!hasSharedDeals;
    if(pageTitle)pageTitle.textContent=tr('مساحة الصفقات','Deal Workspace');
    if(pageSubtitle)pageSubtitle.textContent=tr(
      'سجل مركزي للصفقة، الأطراف، المهام، الفحص النافي للجهالة ومستندات غرفة البيانات.',
      'A central deal record for parties, tasks, due diligence, and data-room documents.'
    );
    if(breadcrumb)breadcrumb.textContent=tr('مساحة الصفقات','Deal Workspace');
  }
}


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
    const redirect=encodeURIComponent(location.pathname+location.search+location.hash);
    location.assign((EN?'/en/calculators/auth':'/calculators/auth')+'?redirect='+redirect);
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


function actionButton(text,attrs){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=text;
  button.style.cssText='width:auto;color:#d4a853;text-decoration:underline;margin-inline-start:8px';
  Object.entries(attrs||{}).forEach(([key,value])=>{button.dataset[key]=value});
  return button;
}

function renderDueDiligence(items,access){
  const host=$('#dealDd');
  if(!host)return;
  host.textContent='';
  if(!Array.isArray(items)||!items.length){
    host.innerHTML='<div class="deal-empty">'+tr('لا توجد عناصر بعد.','No items yet.')+'</div>';
    return;
  }
  const editable=canDo(access,'edit_workspace');
  items.forEach(item=>{
    const rowEl=document.createElement('div');
    rowEl.className='deal-row';
    const text=document.createElement('span');
    const risk=item.risk_rating?tr('مخاطر: ','Risk: ')+item.risk_rating:'';
    text.textContent=[item.title,item.area,item.status,risk].filter(Boolean).join(' · ');
    rowEl.appendChild(text);
    if(editable){
      const actions=document.createElement('span');
      if(item.status!=='in_progress')actions.appendChild(actionButton(tr('بدء','Start'),{ddAction:'in_progress',ddId:item.id}));
      if(item.status!=='complete')actions.appendChild(actionButton(tr('مكتمل','Complete'),{ddAction:'complete',ddId:item.id}));
      if(item.status!=='blocked')actions.appendChild(actionButton(tr('محظور','Block'),{ddAction:'blocked',ddId:item.id}));
      rowEl.appendChild(actions);
    }
    host.appendChild(rowEl);
  });
}

function renderDocuments(items,access){
  const host=$('#dealDocuments');
  if(!host)return;
  host.textContent='';
  if(!Array.isArray(items)||!items.length){
    host.innerHTML='<div class="deal-empty">'+tr('لا توجد مستندات بعد.','No documents yet.')+'</div>';
    return;
  }
  const editable=canDo(access,'edit_workspace');
  items.forEach(item=>{
    const rowEl=document.createElement('div');
    rowEl.className='deal-row deal-row-stack';
    const text=document.createElement('span');
    text.textContent=[item.name,item.category,item.status,item.visibility||'team',tr('نسخة ','v')+(item.version||1)].filter(Boolean).join(' · ');
    rowEl.appendChild(text);
    const actions=document.createElement('span');
    if(item.status!=='requested'||item.storage_path){
      actions.appendChild(actionButton(tr('تنزيل','Download'),{documentAction:'download',documentId:item.id}));
    }
    if(editable){
      const input=document.createElement('input');
      input.type='file';
      input.dataset.documentFile=item.id;
      input.accept='.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp';
      input.style.cssText='max-width:220px;margin-inline-start:8px';
      actions.appendChild(input);
      actions.appendChild(actionButton(tr('رفع نسخة','Upload version'),{documentAction:'upload',documentId:item.id}));
      const nextVisibility=(item.visibility||'team')==='counterparty'?'team':'counterparty';
      actions.appendChild(actionButton(
        nextVisibility==='counterparty'?tr('إتاحة للطرف المقابل','Share with counterparty'):tr('للفريق فقط','Team only'),
        {documentAction:'visibility',documentId:item.id,visibility:nextVisibility}
      ));
    }
    rowEl.appendChild(actions);
    host.appendChild(rowEl);
  });
}

function populateRequestMembers(members){
  const select=$('#dealRequestMember');
  if(!select)return;
  const current=select.value;
  select.innerHTML='<option value="">'+tr('بدون طرف محدد','No specific counterparty')+'</option>';
  (members||[]).filter(m=>m.side==='counterparty'&&m.status!=='revoked').forEach(member=>{
    const option=document.createElement('option');
    option.value=member.id;
    option.textContent=[member.display_name,member.email,member.organization].filter(Boolean).join(' · ')||member.id;
    select.appendChild(option);
  });
  if(current&&[...select.options].some(o=>o.value===current))select.value=current;
}

function renderDocumentRequests(items,access){
  const host=$('#dealRequests');
  if(!host)return;
  host.textContent='';
  if(!Array.isArray(items)||!items.length){
    host.innerHTML='<div class="deal-empty">'+tr('لا توجد طلبات مستندات.','No document requests.')+'</div>';
    return;
  }
  const editable=canDo(access,'edit_workspace');
  const counterparty=access&&access.mode==='member'&&access.side==='counterparty';
  items.forEach(item=>{
    const rowEl=document.createElement('div');
    rowEl.className='deal-row deal-row-stack';
    const text=document.createElement('span');
    text.textContent=[item.title,item.category,item.status,item.due_at?String(item.due_at).slice(0,10):''].filter(Boolean).join(' · ');
    rowEl.appendChild(text);
    const actions=document.createElement('span');
    if(counterparty&&['open','submitted'].includes(item.status)){
      const input=document.createElement('input');
      input.type='file';
      input.dataset.requestFile=item.id;
      input.accept='.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp';
      input.style.cssText='max-width:220px;margin-inline-start:8px';
      actions.appendChild(input);
      actions.appendChild(actionButton(tr('رفع المطلوب','Upload requested file'),{requestAction:'upload',requestId:item.id}));
    }
    if(editable&&item.status!=='fulfilled'){
      actions.appendChild(actionButton(tr('اعتماد الاستلام','Mark fulfilled'),{requestAction:'fulfilled',requestId:item.id}));
    }
    rowEl.appendChild(actions);
    host.appendChild(rowEl);
  });
}

async function uploadWithSignedUrl(endpoint,file){
  if(!file)throw new Error('FILE_REQUIRED');
  const contentType=String(file.type||'').toLowerCase();
  if(!contentType)throw new Error('FILE_TYPE_REQUIRED');
  const data=await api(endpoint,{
    method:'POST',
    body:JSON.stringify({
      file_name:file.name,
      content_type:contentType,
      size_bytes:file.size
    })
  });
  const upload=data.upload||{};
  const sb=window.BondsAuth&&window.BondsAuth.getSupabase?window.BondsAuth.getSupabase():null;
  if(!sb)throw new Error('SUPABASE_CLIENT_UNAVAILABLE');
  const result=await sb.storage.from(upload.bucket).uploadToSignedUrl(upload.path,upload.token,file,{contentType});
  if(result.error)throw result.error;
  const documentId=data.document?.id||data.version?.document_id;
  if(!documentId||!data.version?.id)throw new Error('UPLOAD_CONFIRMATION_CONTEXT_MISSING');
  await api('/'+encodeURIComponent(activeDealId)+'/documents/'+encodeURIComponent(documentId)+'/confirm-upload',{
    method:'POST',
    body:JSON.stringify({version_id:data.version.id})
  });
  return data;
}

async function documentAction(button){
  if(!activeDealId)return;
  const documentId=button.dataset.documentId;
  const base='/'+encodeURIComponent(activeDealId)+'/documents/'+encodeURIComponent(documentId);
  if(button.dataset.documentAction==='download'){
    const data=await api(base+'/download-url',{method:'POST',body:'{}'});
    location.assign(data.signed_url);
    return;
  }
  if(button.dataset.documentAction==='visibility'){
    await api(base,{method:'PATCH',body:JSON.stringify({visibility:button.dataset.visibility})});
    await loadDeal(activeDealId);
    return;
  }
  if(button.dataset.documentAction==='upload'){
    const file=$('[data-document-file="'+CSS.escape(documentId)+'"]')?.files?.[0];
    setStatus(tr('جاري رفع النسخة...','Uploading version...'));
    await uploadWithSignedUrl(base+'/upload-url',file);
    await loadDeal(activeDealId);
    setStatus(tr('تم رفع النسخة وتثبيتها.','Version uploaded and confirmed.'));
  }
}

async function requestAction(button){
  if(!activeDealId)return;
  const requestId=button.dataset.requestId;
  const base='/'+encodeURIComponent(activeDealId)+'/requests/'+encodeURIComponent(requestId);
  if(button.dataset.requestAction==='fulfilled'){
    await api(base,{method:'PATCH',body:JSON.stringify({status:'fulfilled'})});
    await loadDeal(activeDealId);
    return;
  }
  if(button.dataset.requestAction==='upload'){
    const file=$('[data-request-file="'+CSS.escape(requestId)+'"]')?.files?.[0];
    setStatus(tr('جاري رفع المستند المطلوب...','Uploading requested document...'));
    await uploadWithSignedUrl(base+'/upload-url',file);
    await loadDeal(activeDealId);
    setStatus(tr('تم رفع المستند وإرساله للفريق.','Document uploaded and submitted to the team.'));
  }
}

async function dueDiligenceAction(button){
  if(!activeDealId)return;
  const itemId=button.dataset.ddId;
  const status=button.dataset.ddAction;
  const body={status};
  if(status==='blocked'){
    const risk=window.prompt(tr('درجة المخاطر: low / medium / high / critical','Risk rating: low / medium / high / critical'),'high');
    if(risk)body.risk_rating=risk;
    const finding=window.prompt(tr('سبب الحظر / الملاحظة','Blocking finding / note'))||'';
    if(finding)body.finding=finding;
  }
  if(status==='complete'){
    const resolution=window.prompt(tr('ملاحظة الإغلاق (اختياري)','Resolution note (optional)'))||'';
    if(resolution)body.resolution_note=resolution;
  }
  await api('/'+encodeURIComponent(activeDealId)+'/due-diligence/'+encodeURIComponent(itemId),{
    method:'PATCH',body:JSON.stringify(body)
  });
  await loadDeal(activeDealId);
}

async function createDocumentRequest(event){
  event.preventDefault();
  if(!activeDealId)throw new Error('DEAL_NOT_SELECTED');
  const form=event.currentTarget;
  const payload=Object.fromEntries(new FormData(form).entries());
  if(!payload.requested_from_member_id)delete payload.requested_from_member_id;
  if(!payload.due_at)delete payload.due_at;
  await api('/'+encodeURIComponent(activeDealId)+'/requests',{method:'POST',body:JSON.stringify(payload)});
  form.reset();
  await loadDeal(activeDealId);
}


function populatePipelineParties(parties,pipeline){
  const select=$('#dealPipelineParty');
  if(!select)return;
  const used=new Set((pipeline||[]).map(x=>x.party_id));
  const eligible=(parties||[]).filter(p=>['investor','lender','buyer'].includes(p.party_role)&&!used.has(p.id));
  select.innerHTML='<option value="">'+tr('اختر الطرف','Select party')+'</option>'+
    eligible.map(p=>'<option value="'+escapeHtml(p.id)+'" data-kind="'+escapeHtml(p.party_role)+'">'+escapeHtml([p.name,p.organization].filter(Boolean).join(' — '))+'</option>').join('');
}

function populateOfferPipeline(pipeline,parties){
  const select=$('#dealOfferPipeline');
  if(!select)return;
  const byParty=new Map((parties||[]).map(p=>[p.id,p]));
  select.innerHTML='<option value="">'+tr('اختر المستثمر/الممول','Select investor/lender')+'</option>'+
    (pipeline||[]).filter(x=>x.status!=='declined').map(x=>{
      const p=byParty.get(x.party_id)||{};
      return '<option value="'+escapeHtml(x.id)+'">'+escapeHtml([p.name||x.kind,x.kind,x.status].filter(Boolean).join(' · '))+'</option>';
    }).join('');
}

function renderPipeline(items,parties,access){
  const host=$('#dealPipeline');
  if(!host)return;
  const byParty=new Map((parties||[]).map(p=>[p.id,p]));
  host.textContent='';
  if(!items?.length){host.innerHTML='<div class="deal-empty">'+tr('لا توجد جهات في المسار بعد.','No pipeline entries yet.')+'</div>';return}
  const editable=canDo(access,'edit_workspace');
  items.forEach(item=>{
    const p=byParty.get(item.party_id)||{};
    const rowEl=document.createElement('div'); rowEl.className='deal-row deal-row-stack';
    const text=document.createElement('span');
    text.textContent=[p.name||item.kind,p.organization,item.kind,item.status,item.next_action_at?tr('التالي ','Next ')+String(item.next_action_at).slice(0,10):''].filter(Boolean).join(' · ');
    rowEl.appendChild(text);
    if(editable){
      const actions=document.createElement('span');
      ['contacted','meeting','shortlisted','selected','declined'].forEach(status=>{
        if(item.status!==status)actions.appendChild(actionButton(status,{pipelineAction:status,pipelineId:item.id}));
      });
      rowEl.appendChild(actions);
    }
    host.appendChild(rowEl);
  });
}

function renderOffers(items,pipeline,parties,access){
  const host=$('#dealOffers');
  if(!host)return;
  const byEntry=new Map((pipeline||[]).map(x=>[x.id,x]));
  const byParty=new Map((parties||[]).map(p=>[p.id,p]));
  host.textContent='';
  if(!items?.length){host.innerHTML='<div class="deal-empty">'+tr('لا توجد عروض بعد.','No offers yet.')+'</div>';return}
  const editable=canDo(access,'edit_workspace');
  items.forEach(item=>{
    const entry=byEntry.get(item.pipeline_entry_id)||{};
    const p=byParty.get(entry.party_id)||{};
    const rowEl=document.createElement('div'); rowEl.className='deal-row deal-row-stack';
    const text=document.createElement('span');
    const economics=[
      item.amount!=null?money(item.amount,item.currency):'',
      item.valuation!=null?tr('تقييم ','Valuation ')+money(item.valuation,item.currency):'',
      item.equity_percent!=null?tr('ملكية ','Equity ')+item.equity_percent+'%':'',
      item.interest_rate_percent!=null?tr('فائدة ','Interest ')+item.interest_rate_percent+'%':'',
      item.tenor_months!=null?tr('مدة ','Tenor ')+item.tenor_months+tr(' شهر',' mo'):''
    ].filter(Boolean).join(' · ');
    text.textContent=[p.name||entry.kind,item.offer_type,item.status,economics,item.conditions].filter(Boolean).join(' — ');
    rowEl.appendChild(text);
    if(editable){
      const actions=document.createElement('span');
      ['under_review','shortlisted','accepted','rejected'].forEach(status=>{
        if(item.status!==status)actions.appendChild(actionButton(status,{offerAction:status,offerId:item.id}));
      });
      rowEl.appendChild(actions);
    }
    host.appendChild(rowEl);
  });
}

async function createPipelineEntry(event){
  event.preventDefault();
  if(!activeDealId)throw new Error('DEAL_NOT_SELECTED');
  const form=event.currentTarget;
  const payload=Object.fromEntries(new FormData(form).entries());
  const option=form.elements.party_id.selectedOptions?.[0];
  if(option?.dataset.kind)payload.kind=option.dataset.kind;
  if(!payload.next_action_at)delete payload.next_action_at;
  await api('/'+encodeURIComponent(activeDealId)+'/pipeline',{method:'POST',body:JSON.stringify(payload)});
  form.reset();
  await loadDeal(activeDealId);
}

async function pipelineAction(button){
  if(!activeDealId)return;
  await api('/'+encodeURIComponent(activeDealId)+'/pipeline/'+encodeURIComponent(button.dataset.pipelineId),{
    method:'PATCH',body:JSON.stringify({status:button.dataset.pipelineAction})
  });
  await loadDeal(activeDealId);
}

async function createOffer(event){
  event.preventDefault();
  if(!activeDealId)throw new Error('DEAL_NOT_SELECTED');
  const form=event.currentTarget;
  const payload=Object.fromEntries(new FormData(form).entries());
  ['amount','valuation','equity_percent','interest_rate_percent','tenor_months'].forEach(key=>{if(payload[key]==='')delete payload[key]});
  await api('/'+encodeURIComponent(activeDealId)+'/offers',{method:'POST',body:JSON.stringify(payload)});
  form.reset();
  if(form.elements.currency)form.elements.currency.value='SAR';
  await loadDeal(activeDealId);
}

async function offerAction(button){
  if(!activeDealId)return;
  await api('/'+encodeURIComponent(activeDealId)+'/offers/'+encodeURIComponent(button.dataset.offerId),{
    method:'PATCH',body:JSON.stringify({status:button.dataset.offerAction})
  });
  await loadDeal(activeDealId);
}



function populateClosingDocuments(documents){
  const select=$('#dealClosingDocument');
  if(!select)return;
  select.innerHTML='<option value="">'+tr('مستند الإثبات المرفوع','Evidence document with uploaded file')+'</option>'+
    (documents||[]).map(d=>'<option value="'+escapeHtml(d.id)+'">'+escapeHtml([d.name,d.category,d.status].filter(Boolean).join(' · '))+'</option>').join('');
}

function populateClosingOffers(offers){
  const select=$('#dealClosingOffer');
  if(!select)return;
  const accepted=(offers||[]).filter(o=>['term_sheet','revised_term_sheet'].includes(o.offer_type)&&o.status==='accepted');
  select.innerHTML='<option value="">'+tr('عرض شروط مرتبط (للتوقيع)','Linked accepted term sheet (for signing)')+'</option>'+
    accepted.map(o=>'<option value="'+escapeHtml(o.id)+'">'+escapeHtml([o.offer_type,o.amount!=null?money(o.amount,o.currency):'',o.conditions].filter(Boolean).join(' · '))+'</option>').join('');
}

function syncClosingRecordForm(){
  const form=$('#dealClosingRecordForm');
  if(!form)return;
  const type=String(form.elements.record_type?.value||'term_sheet');
  const status=form.elements.status;
  const allowed={
    term_sheet:[['pending',tr('قيد الإعداد','Pending')],['signed',tr('موقعة','Signed')],['rejected',tr('مرفوضة','Rejected')]],
    cap_table:[['pending',tr('قيد الإعداد','Pending')],['approved',tr('معتمدة','Approved')],['rejected',tr('مرفوضة','Rejected')]],
    funding_confirmation:[['pending',tr('قيد الإعداد','Pending')],['confirmed',tr('مؤكدة','Confirmed')],['rejected',tr('مرفوضة','Rejected')]]
  };
  if(status)status.innerHTML=(allowed[type]||allowed.term_sheet).map(([value,labelText])=>'<option value="'+value+'">'+escapeHtml(labelText)+'</option>').join('');
  const offer=form.elements.offer_id;
  if(offer){
    offer.disabled=type!=='term_sheet';
    if(offer.disabled)offer.value='';
  }
  const amount=form.elements.amount;
  if(amount)amount.disabled=type!=='funding_confirmation';
}

function renderClosingItems(items,access){
  const host=$('#dealClosingItems');
  if(!host)return;
  host.textContent='';
  if(!items?.length){host.innerHTML='<div class="deal-empty">'+tr('لا توجد شروط إغلاق بعد.','No closing conditions yet.')+'</div>';return}
  const editable=canDo(access,'manage_closing');
  items.forEach(item=>{
    const row=document.createElement('div');row.className='deal-row deal-row-stack';
    const text=document.createElement('span');
    text.textContent=[item.title,item.category,item.required===false?tr('غير إلزامي','Optional'):tr('مطلوب','Required'),item.status,item.due_at?String(item.due_at).slice(0,10):''].filter(Boolean).join(' · ');
    row.appendChild(text);
    if(editable){
      const actions=document.createElement('span');
      ['in_progress','satisfied','waived','blocked'].forEach(status=>{
        if(item.status!==status)actions.appendChild(actionButton(status,{closingItemAction:status,closingItemId:item.id}));
      });
      row.appendChild(actions);
    }
    host.appendChild(row);
  });
}

function renderClosingRecords(records,offers,access){
  const host=$('#dealClosingRecords');
  if(!host)return;
  const byOffer=new Map((offers||[]).map(o=>[o.id,o]));
  host.textContent='';
  if(!records?.length){host.innerHTML='<div class="deal-empty">'+tr('لا توجد أدلة إغلاق بعد.','No closing evidence yet.')+'</div>';return}
  records.forEach(record=>{
    const row=document.createElement('div');row.className='deal-row deal-row-stack';
    const offer=byOffer.get(record.offer_id)||{};
    const text=document.createElement('span');
    text.textContent=[
      record.record_type,record.status,record.reference,
      record.amount!=null?money(record.amount,record.currency):'',
      record.offer_id?(offer.offer_type||record.offer_id):'',
      record.effective_at?String(record.effective_at).slice(0,10):''
    ].filter(Boolean).join(' · ');
    row.appendChild(text);
    host.appendChild(row);
  });
}

async function createClosingItem(event){
  event.preventDefault();
  if(!activeDealId)throw new Error('DEAL_NOT_SELECTED');
  const form=event.currentTarget;
  const payload=Object.fromEntries(new FormData(form).entries());
  payload.required=payload.required!=='false';
  if(!payload.due_at)delete payload.due_at;
  await api('/'+encodeURIComponent(activeDealId)+'/closing-items',{method:'POST',body:JSON.stringify(payload)});
  form.reset();
  await loadDeal(activeDealId);
}

async function closingItemAction(button){
  if(!activeDealId)return;
  await api('/'+encodeURIComponent(activeDealId)+'/closing-items/'+encodeURIComponent(button.dataset.closingItemId),{
    method:'PATCH',body:JSON.stringify({status:button.dataset.closingItemAction})
  });
  await loadDeal(activeDealId);
}

async function createClosingRecord(event){
  event.preventDefault();
  if(!activeDealId)throw new Error('DEAL_NOT_SELECTED');
  const form=event.currentTarget;
  const payload=Object.fromEntries(new FormData(form).entries());
  if(!payload.offer_id)delete payload.offer_id;
  if(payload.amount==='')delete payload.amount;
  await api('/'+encodeURIComponent(activeDealId)+'/closing-records',{method:'POST',body:JSON.stringify(payload)});
  form.reset();
  if(form.elements.currency)form.elements.currency.value='SAR';
  syncClosingRecordForm();
  await loadDeal(activeDealId);
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
  const access=data.access||{mode:'owner',can:['view_workspace','edit_workspace','manage_members','view_events','edit_deal','link_records','manage_closing']};
  renderCollection($('#dealParties'),workspace.parties,x=>x.name,x=>x.party_role);
  renderCollection($('#dealTasks'),workspace.tasks,x=>x.title,x=>x.status);
  renderDueDiligence(workspace.due_diligence||[],access);
  renderDocuments(workspace.documents||[],access);
  renderDocumentRequests(workspace.document_requests||[],access);
  renderPipeline(workspace.pipeline||[],workspace.parties||[],access);
  renderOffers(workspace.offers||[],workspace.pipeline||[],workspace.parties||[],access);
  populatePipelineParties(workspace.parties||[],workspace.pipeline||[]);
  populateOfferPipeline(workspace.pipeline||[],workspace.parties||[]);
  renderClosingItems(workspace.closing_items||[],access);
  renderClosingRecords(workspace.closing_records||[],workspace.offers||[],access);
  populateClosingOffers(workspace.offers||[]);
  populateClosingDocuments(workspace.documents||[]);
  syncClosingRecordForm();
  applyAccess(access,deal);
  renderMembers(data.members||[],access);
  populateRequestMembers(data.members||[]);
  loadEvents(access).catch(()=>{});
  const url=new URL(location.href);
  url.searchParams.set('deal',deal.id);
  history.replaceState({},'',url);
  applyListMode();
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
  setHidden('#dealRequestForm',!canDo(access,'edit_workspace'));
  setHidden('#dealPipelinePanel',access.side==='counterparty');
  setHidden('#dealOffersPanel',access.side==='counterparty');
  setHidden('#dealPipelineForm',!editable);
  setHidden('#dealOfferForm',!editable);
  setHidden('#dealClosingPanel',access.side==='counterparty');
  const closingManage=canDo(access,'manage_closing');
  setHidden('#dealClosingItemForm',!closingManage);
  setHidden('#dealClosingRecordForm',!closingManage);
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
    renderContextReturn();
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
    if(sharedView){
      setHidden('#dealSharedPanel',false);
      if(shared.length){
        renderCards(sharedHost,shared,true);
      }else{
        sharedHost.innerHTML='<div class="deal-empty">'+tr(
          'لا توجد فرص مشاركة معك بعد. عند دعوتك إلى صفقة ببريدك المؤكد ستظهر هنا.',
          'No opportunities have been shared with you yet. Deals you are invited to with your verified email will appear here.'
        )+'</div>';
      }
    }else{
      setHidden('#dealSharedPanel',!hasSharedDeals);
      renderCards(sharedHost,shared,true);
    }
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
  applyListMode();
  const url=new URL(location.href);
  url.searchParams.delete('deal');
  history.replaceState({},'',url);
}

document.addEventListener('DOMContentLoaded',async()=>{
  renderContextReturn();
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
  $('#dealRequestForm')?.addEventListener('submit',event=>{
    createDocumentRequest(event).catch(err=>setStatus(err.message,true));
  });
  $('#dealPipelineForm')?.addEventListener('submit',event=>{
    createPipelineEntry(event).catch(err=>setStatus(err.message,true));
  });
  $('#dealPipeline')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-pipeline-action]');
    if(button)pipelineAction(button).catch(err=>setStatus(err.message,true));
  });
  $('#dealOfferForm')?.addEventListener('submit',event=>{
    createOffer(event).catch(err=>setStatus(err.message,true));
  });
  $('#dealOffers')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-offer-action]');
    if(button)offerAction(button).catch(err=>setStatus(err.message,true));
  });
  $('#dealClosingItemForm')?.addEventListener('submit',event=>{
    createClosingItem(event).catch(err=>setStatus(err.message,true));
  });
  $('#dealClosingItems')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-closing-item-action]');
    if(button)closingItemAction(button).catch(err=>setStatus(err.message,true));
  });
  $('#dealClosingRecordForm')?.addEventListener('submit',event=>{
    createClosingRecord(event).catch(err=>setStatus(err.message,true));
  });
  $('#dealClosingRecordType')?.addEventListener('change',syncClosingRecordForm);
  $('#dealDocuments')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-document-action]');
    if(button)documentAction(button).catch(err=>setStatus(err.message,true));
  });
  $('#dealRequests')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-request-action]');
    if(button)requestAction(button).catch(err=>setStatus(err.message,true));
  });
  $('#dealDd')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-dd-action]');
    if(button)dueDiligenceAction(button).catch(err=>setStatus(err.message,true));
  });
  const projectId=new URLSearchParams(location.search).get('project');
  if(projectId&&$('#dealCreateProject')){
    $('#dealCreateProject').value=projectId;
    setHidden('#dealCreateProjectNote',false);
  }
  try{
    await loadDeals();
    if(location.hash==='#dealSharedPanel'&&!params.get('view')){
      const url=new URL(location.href);
      url.hash='';
      url.searchParams.set('view','shared');
      history.replaceState({},'',url);
    }
    applyListMode();
    const id=new URLSearchParams(location.search).get('deal');
    if(id)await loadDeal(id);
  }catch(err){
    if(err.message!=='AUTHENTICATION_REQUIRED')setStatus(err.message,true);
  }
});

})();
