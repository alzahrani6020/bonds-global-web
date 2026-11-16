(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const operations=Object.freeze({
  crm:'crm.contacts.list',
  hr:'hr.employees.list',
  real_estate:'real_estate.properties.list',
  fleet:'fleet.vehicles.list',
  sales:'sales.invoices.list',
  purchasing:'purchasing.orders.list',
  inventory:'inventory.products.list',
  finance:'finance.payments.list',
  accounting:'accounting.journals.list',
  projects:'projects.tasks.list',
  governance:'governance.approvals.pending'
 });
 const dictionary={
  ar:{
   pageTitle:'برامج الشركات',pageDescription:'البرامج المتاحة حسب مساحة العمل والاشتراك الفعلي.',
   returnLink:'مساحتي في بوندز',workspaceTitle:'اختيار مساحة الشركة',
   workspaceHelp:'تُعرض فقط المساحات التي يتيحها حسابك. لا تنشئ هذه الصفحة اشتراكات أو صلاحيات جديدة.',
   workspaceLabel:'مساحة العمل',load:'عرض البرامج',programTitle:'التخصصات المستقلة',
   programHelp:'القراءة متاحة فقط عند وجود اشتراك وربط هوية وصلاحية فعلية. الأعمال غير المرحّلة لا تظهر كأنها جاهزة.',
   resultTitle:'نتيجة القراءة التشغيلية',resultHelp:'بيانات مساحة العمل الحالية فقط، دون كشف رمز جلسة مكين.',
   footerNote:'مرحلة تحقق: لا تعني القائمة اكتمال الوظائف التشغيلية الأحد عشر، ولا تُفعّل الكتابة أو الاعتماد المالي.',
   lang:'English',auth:'يلزم تسجيل الدخول إلى بوندز قبل عرض المساحات.',
   noWorkspace:'لا توجد مساحة شركة مخولة لهذا الحساب. استخدم صفحة CRM لإنشاء مساحة فعلية.',
   loading:'جارٍ قراءة مساحات العمل المخولة...',inventory:'جارٍ التحقق من استحقاقات مساحة العمل...',
   active:'اشتراك نشط',inactive:'غير مشترك أو الاشتراك غير نشط',read:'قراءة السجلات',
   unavailable:'لا توجد عملية قراءة معتمدة لهذا التخصص',reading:'جارٍ التحقق من الجلسة وقراءة السجلات...',
   failed:'تعذر إكمال الطلب',success:'اكتملت القراءة من مسار التكامل المقيّد.',
   noItems:'لا توجد مساحات قابلة للعرض',errorPrefix:'رمز الخطأ'
  },
  en:{
   pageTitle:'Company Programs',pageDescription:'Programs available under your actual company workspace and subscription.',
   returnLink:'My BONDS',workspaceTitle:'Choose a company workspace',
   workspaceHelp:'Only workspaces visible to your authenticated account are listed. This page never creates subscriptions or permissions.',
   workspaceLabel:'Workspace',load:'Show programs',programTitle:'Independent programs',
   programHelp:'Read actions require an active entitlement, verified identity mapping and current permissions. Unmigrated features are not presented as ready.',
   resultTitle:'Operational read result',resultHelp:'Current workspace data only. Makkin session tokens remain server-side.',
   footerNote:'Acceptance-stage interface: the eleven programs are not fully migrated. No write or financial approvals are enabled.',
   lang:'العربية',auth:'Sign in to BONDS before accessing company workspaces.',
   noWorkspace:'No authorized company workspace was found. Create one through CRM.',
   loading:'Loading authorized workspaces...',inventory:'Checking workspace entitlements...',
   active:'Subscription active',inactive:'Not subscribed or inactive',read:'Read records',
   unavailable:'No approved read action',reading:'Verifying identity and reading records...',
   failed:'Request could not complete',success:'The scoped integration read completed.',
   noItems:'No accessible workspaces',errorPrefix:'Error code'
  }
 };
 let lang=location.pathname.startsWith('/en/')?'en':'ar';
 let selected=null;
 const t=k=>dictionary[lang][k]||k;
 function status(message,problem){
  $('status').textContent=message;
  $('status').style.color=problem?'#fca5a5':'#cbd5e1';
 }
 function language(){
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  const ids={
   'page-title':'pageTitle','page-description':'pageDescription','return-link':'returnLink',
   'workspace-title':'workspaceTitle','workspace-help':'workspaceHelp',
   'load':'load','program-title':'programTitle','program-help':'programHelp',
   'result-title':'resultTitle','result-help':'resultHelp','footer-note':'footerNote',
   'toggle-lang':'lang'
  };
  for(const [id,key] of Object.entries(ids))$(id).textContent=t(key);
  // Label text is a separate text node so the child select is preserved.
  $('workspace-label').firstChild.textContent=t('workspaceLabel')+' ';
  if(window.currentInventory)render(window.currentInventory);
 }
 function workspaceValue(item){return item.source+':'+item.id;}
 async function init(){
  language();
  status(t('loading'));
  try{
   if(!window.BondsAuth)throw Error('AUTH_UNAVAILABLE');
   await window.BondsAuth.ensureEnv();
   const userResponse=await window.BondsAuth.getUser();
   const user=userResponse?.data?.user;
   if(!user){status(t('auth'),true);return;}
   const sb=window.BondsAuth.getSupabase();
   if(!sb)throw Error('DATABASE_UNAVAILABLE');
   const [crm,companies]=await Promise.all([
    sb.from('crm_app_workspaces').select('id,name').limit(100),
    sb.from('companies').select('id,name').eq('is_active',true).limit(100)
   ]);
   // Never fabricate company IDs from names or email. RLS restricts
   // visible source workspaces; inventory rechecks exact owner/membership.
   const data=[
    ...((crm.error?[]:crm.data)||[]).map(w=>({source:'crm',id:w.id,name:w.name})),
    ...((companies.error?[]:companies.data)||[]).map(w=>({source:'company',id:w.id,name:w.name}))
   ];
   const select=$('workspace');
   select.replaceChildren(new Option('—',''));
   for(const item of data){
    const option=new Option(item.name+' · '+item.source,workspaceValue(item));
    select.add(option);
   }
   if(!data.length){
    status(crm.error&&companies.error?t('failed')+': DATABASE_UNAVAILABLE':t('noWorkspace'),true);
    return;
   }
   const params=new URLSearchParams(location.search);
   const requested=data.find(w=>w.id===params.get('workspace_id')&&
     w.source===(params.get('workspace_type')||'crm'));
   selected=requested||data[0];
   select.value=workspaceValue(selected);
   status('');
   await loadInventory();
  }catch(err){status(t('failed')+': '+(err?.message||'UNKNOWN'),true);}
 }
 async function fetchProgram(url,body){
  const response=await window.BondsAuth.authenticatedFetch(url,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body),redirectOnAuth:false,cache:'no-store'
  });
  let result;
  try{result=await response.json();}catch{throw Error('INVALID_RESPONSE');}
  if(!response.ok)throw Error(result?.error||'HTTP_'+response.status);
  return result;
 }
 async function loadInventory(){
  const val=$('workspace').value;
  selected=null;
  const sep=val.indexOf(':');
  if(sep<0){status(t('noItems'),true);return;}
  const source=val.slice(0,sep),id=val.slice(sep+1);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['crm','company'].includes(source)){
   status('WORKSPACE_REQUIRED',true);return;
  }
  selected={source,id};
  status(t('inventory'));$('programs').replaceChildren();$('result-panel').hidden=true;
  try{
   const url='/api/company-programs?workspace_type='+encodeURIComponent(source)+
    '&workspace_id='+encodeURIComponent(id);
   const response=await window.BondsAuth.authenticatedFetch(url,{
     method:'GET',cache:'no-store',redirectOnAuth:false
   });
   const data=await response.json();
   if(!response.ok)throw Error(data?.error||'HTTP_'+response.status);
   if(data?.workspace?.id!==id||data?.workspace?.source!==source||
      !Array.isArray(data.programs))throw Error('WORKSPACE_RESPONSE_MISMATCH');
   window.currentInventory=data;
   render(data);status('');
  }catch(err){window.currentInventory=null;status(t('failed')+': '+err.message,true);}
 }
 function render(data){
  const grid=$('programs');grid.replaceChildren();
  for(const program of data.programs){
   const card=document.createElement('article');card.className='program';
   const h=document.createElement('h2');h.textContent=lang==='ar'?program.nameAr:program.nameEn;
   const badge=document.createElement('p');badge.className='badge';
   badge.textContent=program.entitled?t('active'):t('inactive');
   badge.style.color=program.entitled?'#86efac':'#cbd5e1';
   const note=document.createElement('p');note.className='hint';
   note.textContent=program.entitled?'':String(program.entitlement||'not_subscribed');
   const button=document.createElement('button');button.type='button';
   button.textContent=operations[program.key]?t('read'):t('unavailable');
   button.disabled=!program.entitled||!operations[program.key];
   button.addEventListener('click',()=>read(program.key,button));
   card.append(h,badge,note,button);grid.append(card);
  }
 }
 async function read(program,button){
  if(!selected||!operations[program])return;
  button.disabled=true;status(t('reading'));$('result-panel').hidden=true;
  try{
   const body={
    workspace_id:selected.id,workspace_type:selected.source,
    program_key:program,operation:operations[program]
   };
   const result=await fetchProgram('/api/company-programs?action=program-read',body);
   if(result.workspace?.id!==selected.id||result.program_key!==program||
      result.operation!==operations[program])throw Error('PROGRAM_RESPONSE_MISMATCH');
   // Render only through textContent: customer data must never become HTML.
   $('result').textContent=JSON.stringify(result.data,null,2);
   $('result-panel').hidden=false;status(t('success'));
  }catch(err){status(t('failed')+': '+err.message,true);}
  finally{button.disabled=false;}
 }
 $('toggle-lang').addEventListener('click',()=>{
  lang=lang==='ar'?'en':'ar';language();
 });
 $('workspace-form').addEventListener('submit',event=>{
  event.preventDefault();loadInventory();
 });
 init();
})();
