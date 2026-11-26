/* BONDS HR company institutional profile. Tenant ownership is enforced by PostgreSQL RLS. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const en=document.documentElement.lang==='en';
 const t=(ar,eng)=>en?eng:ar;
 const panel=$('hr-company-profile'),form=$('hr-company-profile-form'),message=$('hr-company-profile-status'),logoInput=$('hr-company-logo-file'),preview=$('hr-company-logo-preview');
 if(!panel||!form)return;
 const fields=['legal_name','trading_name','legal_entity_type','commercial_registration','commercial_registration_issued_at','commercial_registration_expires_at','unified_number','national_establishment_number','vat_number','vat_registration_status','gosi_number','municipal_license_number','municipal_license_expires_at','business_activity','secondary_activities','city','district','street','building_number','postal_code','additional_number','phone','email','website','representative_name','hr_contact_name'];
 const dateFields=new Set(['commercial_registration_issued_at','commercial_registration_expires_at','municipal_license_expires_at']);
 let db=null,user=null,workspace=null,activeKey=0,logoUrl=null,currentLogoPath=null;
 function notify(text,bad=false){message.textContent=text||'';message.classList.toggle('error',bad);}
 function showPreview(url){
  if(logoUrl&&logoUrl.startsWith('blob:'))URL.revokeObjectURL(logoUrl);
  logoUrl=url||null;
  preview.hidden=!logoUrl;
  if(logoUrl)preview.src=logoUrl;else preview.removeAttribute('src');
 }
 function readRow(row){
  for(const name of fields){const el=form.elements.namedItem(name);if(el)el.value=row?.[name]||'';}
  currentLogoPath=row?.logo_path||null;
  logoInput.value='';
 }
 async function loadLogo(row,token){
  if(!row?.logo_path){showPreview(null);return;}
  const response=await db.storage.from('hr-company-branding').createSignedUrl(row.logo_path,120);
  if(token!==activeKey)return;
  if(response.error)throw response.error;
  showPreview(response.data.signedUrl);
 }
 async function activate(next){
  const key=++activeKey;
  workspace=next;
  panel.hidden=!(db&&user&&workspace&&workspace.owner_user_id===user.id);
  readRow(null);showPreview(null);notify('');
  if(panel.hidden)return;
  notify(t('جارٍ تحميل بيانات المنشأة...','Loading company profile...'));
  const response=await db.from('hr_company_profiles').select('*').eq('crm_workspace_id',workspace.crm_workspace_id).maybeSingle();
  if(key!==activeKey)return;
  if(response.error){notify(t('تعذر تحميل ملف الشركة: ','Cannot load company profile: ')+response.error.message,true);return;}
  readRow(response.data);
  try{await loadLogo(response.data,key);if(key===activeKey)notify('');}
  catch(error){if(key===activeKey)notify(t('تعذر عرض الشعار: ','Could not display logo: ')+error.message,true);}
 }
 async function save(event){
  event.preventDefault();
  if(!db||!user||!workspace||workspace.owner_user_id!==user.id)return;
  const key=activeKey,wid=workspace.crm_workspace_id;
  const button=form.querySelector('button[type=submit]');
  button.disabled=true;notify(t('جارٍ حفظ بيانات المنشأة...','Saving company profile...'));
  try{
   const data={crm_workspace_id:wid};
   for(const name of fields){
    const el=form.elements.namedItem(name);
    const value=String(el?.value||'').trim();
    if(value.length>240)throw Error(t('أحد الحقول أطول من الحد المسموح','Field exceeds maximum length'));
    data[name]=value||null;
   }
   const issued=data.commercial_registration_issued_at,expires=data.commercial_registration_expires_at;
   if(issued&&expires&&issued>expires)throw Error(t('تاريخ انتهاء السجل يسبق تاريخ إصداره','Registration expiry precedes issue date'));
   if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw Error(t('البريد الرسمي غير صحيح','Invalid official email'));
   if(data.website&&!/^https:\/\//i.test(data.website))throw Error(t('استخدم رابط موقع يبدأ بـ https://','Use an HTTPS website URL'));
   const file=logoInput.files?.[0];
   if(file){
    const formats={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
    const ext=formats[file.type];
    if(!ext||file.size>2097152||!file.size)throw Error(t('الشعار يجب أن يكون صورة PNG أو JPG أو WEBP لا تتجاوز 2 ميجابايت','Logo must be PNG, JPG or WEBP up to 2 MB'));
    const path=wid+'/logo.'+ext;
    const uploaded=await db.storage.from('hr-company-branding').upload(path,file,{contentType:file.type,upsert:true,cacheControl:'60'});
    if(uploaded.error)throw uploaded.error;
    data.logo_path=path;
   }else if(currentLogoPath)data.logo_path=currentLogoPath;
   const result=await db.from('hr_company_profiles').upsert(data,{onConflict:'crm_workspace_id'}).select('*').single();
   if(result.error)throw result.error;
   if(!result.data||result.data.crm_workspace_id!==wid)throw Error(t('لم يُثبت حفظ ملف المنشأة','Profile write not confirmed'));
   const verify=await db.from('hr_company_profiles').select('*').eq('crm_workspace_id',wid).single();
   if(verify.error)throw verify.error;
   for(const name of fields.concat(['logo_path'])){
    if(name==='logo_path'&&!Object.hasOwn(data,name))continue;
    if((verify.data?.[name]||null)!==(data[name]||null))
     throw Error(t('تعذّر تأكيد البيانات المحفوظة','Saved profile mismatch')+': '+name);
   }
   if(key!==activeKey)return;
   readRow(verify.data);
   await loadLogo(verify.data,key);
   if(key===activeKey)notify(t('حُفظ ملف المنشأة وتحققنا من البيانات','Company profile saved and verified'));
  }catch(error){if(key===activeKey)notify(t('تعذّر الحفظ: ','Save failed: ')+error.message,true);}
  finally{button.disabled=false;}
 }
 document.addEventListener('bonds-hr-ready',event=>{
  db=event.detail?.db||null;user=event.detail?.user||null;
  if(event.detail?.ownerLicense===true&&window.BondsHRContext?.ownerWorkspace)
   activate(window.BondsHRContext.ownerWorkspace).catch(e=>notify(e.message,true));
 });
 document.addEventListener('bonds-hr-owner-workspace',event=>{
  if(db&&user)activate(event.detail?.workspace||null).catch(e=>notify(e.message,true));
 });
 form.addEventListener('submit',save);
 if(window.BondsHRContext?.db){
  db=window.BondsHRContext.db;user=window.BondsHRContext.user;
  if(window.BondsHRContext.ownerLicense===true&&window.BondsHRContext.ownerWorkspace)
   activate(window.BondsHRContext.ownerWorkspace).catch(e=>notify(e.message,true));
 }
})();
