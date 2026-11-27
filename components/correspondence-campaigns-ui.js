(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let activeCampaign=null,selectedCompany='',loading=false;
  const labels={draft:'مسودة',review:'قيد المراجعة',approved:'معتمدة',running:'قيد الإرسال',paused:'متوقفة',completed:'مكتملة',cancelled:'ملغاة'};
  function status(message,bad=false){$('status').textContent=message;$('status').classList.toggle('error',bad);}
  function node(tag,content){const el=document.createElement(tag);if(content!==undefined)el.textContent=String(content);return el;}
  function option(value,label){const el=node('option',label);el.value=value;return el;}
  function setBusy(value){loading=value;for(const id of ['create','refresh','submit','approve','back','cancel','import','bind','connect-mailbox','refresh-mailbox','dispatch','resume-dispatch','refresh-dispatch','preview-import','sync-replies','refresh-replies']){$(id).disabled=value;}}
  async function session(){
    let auth=window.BondsAuth;
    if(!auth?.getSession){
      await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
      auth=window.BondsAuth;
    }
    const result=await auth?.getSession?.();
    const token=result?.data?.session?.access_token;
    if(!token)throw new Error('AUTH_REQUIRED');
    return token;
  }
  async function api(path='',payload){
    const token=await session();
    const res=await fetch('/api/campaigns'+path,{method:payload?'POST':'GET',cache:'no-store',credentials:'same-origin',
      headers:{Accept:'application/json',Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{})});
    const out=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(out.error||'REQUEST_FAILED');
    return out;
  }
  async function mailboxApi(path='',payload){
    const token=await session();
    const response=await fetch('/api/campaign-mailboxes'+path,{
      method:payload?'POST':'GET',cache:'no-store',credentials:'same-origin',
      headers:{Accept:'application/json',Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'MAILBOX_SERVICE_UNAVAILABLE');
    return data;
  }
  async function loadMailboxes(){
    const list=$('mailbox-list');
    list.replaceChildren();
    const sender=$('dispatch-mailbox');
    sender.replaceChildren(option('','اختر صندوق Zoho موثقًا'));
    if(!UUID.test($('company').value)){
      list.textContent='اختر الشركة لعرض صناديق بريدها.';return;
    }
    try{
      const data=await mailboxApi('?workspace_id='+encodeURIComponent($('company').value));
      if(!data.mailboxes?.length){list.textContent='لم يتم ربط صندوق Zoho لهذه الشركة بعد.';return;}
      for(const mailbox of data.mailboxes){
        const row=node('p',(mailbox.address||'')+' — '+(mailbox.enabled?'متصل ومتحقق منه':'معطل'));
        list.append(row);
        if(mailbox.enabled&&mailbox.verified_at)sender.append(option(mailbox.id,mailbox.address));
      }
      updateActions();
    }catch(e){
      list.textContent=e.message==='MAILBOX_PERMISSION_DENIED'
        ? 'إدارة صناديق البريد متاحة لمالك الشركة ومسؤولها فقط.'
        : 'تعذر تحميل صناديق البريد: '+message(e);
    }
  }
  async function connectMailbox(){
    const workspace_id=$('company').value;
    if(!UUID.test(workspace_id))throw new Error('اختر شركة قبل ربط البريد.');
    const address=$('mailbox-address').value.trim().toLowerCase();
    if(!address||!address.includes('@'))throw new Error('أدخل بريد الشركة الرسمي.');
    if(!window.confirm('سيتم توجيهك إلى Zoho للموافقة على ربط بريد '+address+' بالشركة المحددة. هل تتابع؟'))return;
    const data=await mailboxApi('',{action:'connect',workspace_id,address,region:$('mailbox-region').value});
    const authorization=new URL(data.authorization_url);
    if(authorization.protocol!=='https:'||!/^(accounts\.zoho\.(com|eu|in|com\.au|jp|com\.cn|ae|sa)|accounts\.zohocloud\.ca)$/.test(authorization.hostname))
      throw new Error('رابط تفويض Zoho غير صالح');
    window.location.assign(authorization.href);
  }
  async function dispatchApi(path='',payload){
    const token=await session();
    const response=await fetch('/api/campaign-dispatch'+path,{
      method:payload?'POST':'GET',cache:'no-store',credentials:'same-origin',
      headers:{Accept:'application/json',Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'DISPATCH_UNAVAILABLE');
    return result;
  }
  async function refreshDispatchStatus(){
    if(!activeCampaign)return;
    const label=$('dispatch-status');
    try{
      const report=await dispatchApi('?campaign_id='+encodeURIComponent(activeCampaign.id));
      const counts=report.counts||{};
      label.textContent='معلقة: '+(counts.ready||0)+' | قيد المعالجة: '+(counts.sending||0)+
        ' | قبلها مزود البريد: '+(counts.accepted||0)+' | غير مؤكدة: '+(counts.unknown||0)+
        ' | فشلت: '+(counts.failed||0);
    }catch(e){label.textContent='حالة الإرسال غير متاحة: '+message(e);}
  }
  async function startDispatch(){
    if(!activeCampaign||activeCampaign.status!=='approved')throw new Error('يجب اعتماد الحملة أولاً');
    const mailbox_id=$('dispatch-mailbox').value;
    if(!UUID.test(mailbox_id))throw new Error('حدد بريد Zoho موثقًا لهذه الشركة');
    if(!window.confirm('تفويض صريح: هل تبدأ إرسال الخطابات الصادرة الموثقة إلى مستلمي هذه الحملة بصورة منفصلة من البريد المحدد؟'))return;
    await dispatchApi('',{action:'start',campaign_id:activeCampaign.id,mailbox_id});
    await openCampaign(activeCampaign.id);
    status('تم اعتماد بدء الإرسال. يستخدم النظام مهام محفوظة تمنع تكرار الرسائل.');
    await resumeDispatch();
  }
  async function resumeDispatch(){
    if(!activeCampaign||activeCampaign.status!=='running')throw new Error('الحملة ليست قيد الإرسال');
    let accepted=0,uncertain=0,attempts=0;
    while(attempts<250){
      const result=await dispatchApi('',{action:'next',campaign_id:activeCampaign.id});
      if(!result.pending||result.claimed_elsewhere)break;
      attempts++;
      if(result.accepted)accepted++;
      if(result.uncertain)uncertain++;
      $('dispatch-status').textContent='دفعة التنفيذ: '+attempts+' | قبلها Zoho: '+accepted+' | غير مؤكدة: '+uncertain;
    }
    await refreshDispatchStatus();
    status('نتيجة جولة الإرسال: '+accepted+' مؤكدة القبول لدى Zoho؛ '+uncertain+' تحتاج مراجعة. لا يُعاد إرسال الحالات غير المؤكدة تلقائيًا.');
  }
  async function replyApi(path='',payload){
    const token=await session();
    const response=await fetch('/api/campaign-replies'+path,{
      method:payload?'POST':'GET',cache:'no-store',credentials:'same-origin',
      headers:{Accept:'application/json',Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify(payload)}:{})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'REPLY_SYNC_UNAVAILABLE');
    return result;
  }
  async function refreshReplies(){
    if(!activeCampaign)return;
    try{
      const result=await replyApi('?campaign_id='+encodeURIComponent(activeCampaign.id));
      const replies=result.replies||[];
      $('reply-summary').textContent='ردود مثبتة: '+replies.length+' | مرتبطة بـCRM: '+replies.filter(x=>x.crm_synced_at).length;
    }catch(e){$('reply-summary').textContent='تعذر تحميل سجل الردود: '+message(e);}
  }
  async function synchronizeReplies(){
    if(!activeCampaign)throw new Error('اختر حملة أولاً');
    const mailbox_id=$('dispatch-mailbox').value;
    if(!UUID.test(mailbox_id))throw new Error('اختر صندوق Zoho تابعًا لهذه الشركة');
    if(!window.confirm('مزامنة الردود الواردة ومطابقتها مع رسائل الحملة الموثقة؟ لن يتم إرسال أي رسالة.'))return;
    const result=await replyApi('',{action:'sync',campaign_id:activeCampaign.id,mailbox_id});
    await refreshReplies();
    status('فُحصت '+(result.scanned||0)+' رسالة؛ ردود متطابقة: '+(result.matched||0)+
      '؛ محفوظة: '+(result.archived||0)+'؛ مرتبطة بـCRM: '+(result.crm_linked||0)+
      '؛ تحتاج مراجعة: '+(result.unresolved||0));
  }
  function message(err){
    const map={AUTH_REQUIRED:'يجب تسجيل الدخول إلى BONDS أولاً.',COMPANY_NOT_FOUND:'ليس لديك وصول لهذه الشركة.',
      CAMPAIGN_BACKEND_NOT_CONFIGURED:'خدمة الحملات غير مهيأة على هذا النشر.',
      CAMPAIGN_BACKEND_UNAVAILABLE:'تعذر الوصول إلى خدمة الحملات. تحقق من ترحيلات القاعدة.',
      CAMPAIGN_NOT_EDITABLE:'التعديل متاح في حالة المسودة فقط.',
      APPROVAL_FORBIDDEN:'اعتماد الحملات محصور في المالك أو المسؤول.',
      ISSUED_DOCUMENT_NOT_VERIFIED:'الخطاب غير صادر أو ليس لنفس المستلم أو تنقصه بيانات الإصدار.',
      ISSUE_BINDING_MISMATCH:'توقيع وسجل إصدار المستند غير متطابقين.',
      ISSUED_PDF_HASH_MISMATCH:'ملف PDF لا يطابق البصمة الموثقة.',
      DUPLICATE_RECIPIENT:'بريد المستلم مكرر في الحملة.',
      CAMPAIGN_WRITE_FORBIDDEN:'ليس لديك صلاحية تحرير حملات هذه الشركة.'};
    return map[err?.message]||err?.message||'تعذر تنفيذ العملية';
  }
  async function run(fn){if(loading)return;setBusy(true);try{await fn();}catch(e){status(message(e),true);}finally{setBusy(false);updateActions();}}
  function updateActions(){
    const state=activeCampaign?.status||'';
    $('detail').hidden=!activeCampaign;
    $('detail-state').textContent=labels[state]||state;
    $('submit').hidden=state!=='draft';$('approve').hidden=state!=='review';$('back').hidden=state!=='review';
    $('cancel').hidden=!['draft','review','approved'].includes(state);
    $('import').disabled=loading||state!=='draft';
    $('bind').disabled=loading||!['draft','review','approved'].includes(state);
    $('dispatch').disabled=loading||state!=='approved'||!UUID.test($('dispatch-mailbox').value);
    $('resume-dispatch').disabled=loading||state!=='running';
    $('refresh-dispatch').disabled=loading||!activeCampaign;
    $('refresh-replies').disabled=loading||!activeCampaign;
    $('sync-replies').disabled=loading||!activeCampaign||!UUID.test($('dispatch-mailbox').value);
  }
  async function loadCompanies(){
    const result=await api('?mine=1');
    const select=$('company');select.replaceChildren(option('','اختر الشركة'));
    for(const c of result.workspaces||[])select.append(option(c.id,c.name+' — '+(c.role||'مستخدم')));
    const requested=new URLSearchParams(location.search).get('workspace_id');
    if(requested&&[...select.options].some(o=>o.value===requested))select.value=requested;
    else if(select.options.length===2)select.selectedIndex=1;
    selectedCompany=select.value;
    if(selectedCompany)await loadCampaigns();
  }
  async function loadCampaigns(){
    selectedCompany=$('company').value;
    activeCampaign=null;updateActions();
    const list=$('campaign-list');list.replaceChildren();
    if(!UUID.test(selectedCompany)){list.textContent='اختر شركة مصرحًا بها.';return;}
    await loadMailboxes();
    const result=await api('?workspace_id='+encodeURIComponent(selectedCompany));
    const campaigns=result.campaigns||[];
    if(!campaigns.length){list.textContent='لا توجد حملات حتى الآن.';return;}
    for(const c of campaigns){
      const row=node('div');row.style.padding='10px 0';row.style.borderBottom='1px solid #e4e9f0';
      row.append(node('strong',c.title),node('small',' — '+(labels[c.status]||c.status)+' '));
      const button=node('button','فتح');button.type='button';button.className='secondary';
      button.addEventListener('click',()=>run(()=>openCampaign(c.id)));
      row.append(button);list.append(row);
    }
  }
  function renderRecipients(items){
    const body=$('recipients');body.replaceChildren();
    for(const r of items){
      const tr=node('tr');tr.append(node('td',r.organization||r.name||'-'),node('td',r.email),node('td',r.status),node('td',r.document_id||'—'));
      const cell=node('td'),button=node('button','اختيار');button.className='secondary';button.type='button';
      button.addEventListener('click',()=>{$('recipient-id').value=r.id;status('تم اختيار مستلم لإسناد خطاب صادر مستقل.')});
      cell.append(button);tr.append(cell);body.append(tr);
    }
    if(!items.length){const tr=node('tr'),td=node('td','لم تُضف جهات للحملة بعد.');td.colSpan=5;tr.append(td);body.append(tr);}
  }
  async function openCampaign(id){
    const result=await api('?id='+encodeURIComponent(id));
    activeCampaign=result.campaign;$('detail-title').textContent=result.campaign.title;
    const letterLink=$('campaign-letterhead-link');
    if(letterLink&&UUID.test(result.campaign.workspace_id)){
      const prefix=location.pathname.startsWith('/en/')?'/en/letterhead.html':'/letterhead.html';
      letterLink.href=prefix+'?workspace=correspondence&campaign_workspace_id='+encodeURIComponent(result.campaign.workspace_id);
    }
    renderRecipients(result.recipients||[]);updateActions();
    await refreshDispatchStatus();
    await refreshReplies();
    status('تم تحميل الحملة من قاعدة البيانات: '+(labels[activeCampaign.status]||activeCampaign.status));
  }
  async function create(){
    const c=$('company').value;if(!UUID.test(c))throw new Error('اختر الشركة المالكة للحملة');
    const result=await api('',{action:'create',workspace_id:c,title:$('title').value,kind:$('kind').value,description:$('description').value});
    await loadCampaigns();await openCampaign(result.campaign.id);
  }
  function fileMime(file){
    const ext=String(file.name||'').toLowerCase().split('.').pop();
    return {xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls:'application/vnd.ms-excel',csv:'text/csv',pdf:'application/pdf'}[ext]||'';
  }
  async function fileBase64(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('تعذرت قراءة الملف.'));
      reader.onload=()=>{const value=String(reader.result||'');const comma=value.indexOf(',');
        if(comma<0)return reject(new Error('ملف غير صالح'));resolve(value.slice(comma+1));};
      reader.readAsDataURL(file);
    });
  }
  async function previewImport(){
    if(!UUID.test($('company').value))throw new Error('اختر مساحة عمل قبل الاستيراد.');
    const file=$('import-file').files?.[0];
    if(!file)throw new Error('اختر ملف Excel أو CSV أو PDF.');
    if(file.size>2*1024*1024||file.size===0)throw new Error('حجم الملف يجب ألا يتجاوز 2 ميجابايت.');
    const mime=fileMime(file);if(!mime)throw new Error('نوع الملف غير مدعوم.');
    const file_base64=await fileBase64(file);
    const result=await api('',{action:'preview_import',workspace_id:$('company').value,mime,filename:file.name,file_base64});
    const candidates=result.candidates||[];
    $('import-summary').textContent='تم استخراج '+candidates.length+' جهة للمراجعة. بيانات غير صالحة/مكررة: '+(result.rejected||[]).length+'. يلزم فحص الأسماء والبريد قبل الإضافة.';
    if(!candidates.length)return;
    const existing=$('recipient-lines').value.trim();
    const rows=candidates.map(x=>x.organization+', '+x.email).join('\n');
    if(existing&&!window.confirm('يوجد محتوى في قائمة المستلمين. هل تريد استبداله بنتائج الملف؟'))return;
    $('recipient-lines').value=rows;
    status('عرض معاينة المستلمين فقط. راجع البيانات يدويًا قبل الضغط على إضافة المستلمين.');
  }
  function parseRecipients(text){
    const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(lines.length<1||lines.length>250)throw new Error('أدخل من 1 إلى 250 مستلمًا في الدفعة');
    const seen=new Set();
    return lines.map((line,index)=>{
      const split=line.lastIndexOf(',')>=0?line.lastIndexOf(','):line.lastIndexOf('؛')>=0?line.lastIndexOf('؛'):line.lastIndexOf(';');
      if(split<1)throw new Error('السطر '+(index+1)+': استخدم اسم الجهة، البريد الإلكتروني');
      const organization=line.slice(0,split).trim().replace(/^["']|["']$/g,'');
      const email=line.slice(split+1).trim().toLowerCase();
      if(!organization||!email||!email.includes('@'))throw new Error('السطر '+(index+1)+' غير مكتمل');
      if(seen.has(email))throw new Error('البريد مكرر في القائمة: '+email);
      seen.add(email);return {organization,email};
    });
  }
  async function importRecipients(){
    if(!activeCampaign||activeCampaign.status!=='draft')throw new Error('لا يمكن تعديل المستلمين بعد رفع الحملة للمراجعة');
    const recipients=parseRecipients($('recipient-lines').value);
    const approved=window.confirm('إضافة '+recipients.length+' مستلمًا إلى حملة '+activeCampaign.title+'؟ لن تُرسل أي رسائل.');
    if(!approved)return;
    await api('',{action:'add_recipients',id:activeCampaign.id,recipients});
    $('recipient-lines').value='';await openCampaign(activeCampaign.id);
  }
  async function transition(action){
    if(!activeCampaign)return;
    if(['approve','cancel'].includes(action)&&!window.confirm('تأكيد الإجراء: '+action+'؟'))return;
    const result=await api('',{action,id:activeCampaign.id});
    await loadCampaigns();await openCampaign(result.campaign.id);
  }
  async function bind(){
    if(!activeCampaign)return;
    const recipient_id=$('recipient-id').value,document_id=$('document-id').value.trim();
    if(!UUID.test(recipient_id)||!UUID.test(document_id))throw new Error('حدد مستلمًا ومعرف خطاب صادر صحيحًا');
    await api('',{action:'bind_issued_letter',id:activeCampaign.id,recipient_id,document_id});
    $('document-id').value='';await openCampaign(activeCampaign.id);
  }
  window.addEventListener('DOMContentLoaded',()=>{
    $('company').addEventListener('change',()=>run(loadCampaigns));
    $('connect-mailbox').addEventListener('click',()=>run(connectMailbox));
    $('dispatch-mailbox').addEventListener('change',updateActions);
    $('dispatch').addEventListener('click',()=>run(startDispatch));
    $('resume-dispatch').addEventListener('click',()=>run(resumeDispatch));
    $('refresh-dispatch').addEventListener('click',()=>run(refreshDispatchStatus));
    $('refresh-replies').addEventListener('click',()=>run(refreshReplies));
    $('sync-replies').addEventListener('click',()=>run(synchronizeReplies));
    $('refresh-mailbox').addEventListener('click',()=>run(loadMailboxes));
    $('refresh').addEventListener('click',()=>run(loadCampaigns));
    $('create').addEventListener('click',()=>run(create));
    $('import').addEventListener('click',()=>run(importRecipients));
    $('preview-import').addEventListener('click',()=>run(previewImport));
    $('bind').addEventListener('click',()=>run(bind));
    for(const id of ['submit','approve','back','cancel'])$(id).addEventListener('click',()=>run(()=>transition(id==='back'?'return':id)));
    run(async()=>{await loadCompanies();status('المركز جاهز لإنشاء الحملات. الإرسال الجماعي يتطلب ربط بريد موثق.');});
  });
})();
