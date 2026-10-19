(function(){
  'use strict';

  const root=document.querySelector('[data-credit-consent-form]');
  if(!root) return;

  const lang=(document.documentElement.lang||'ar').startsWith('en')?'en':'ar';
  const subjectType=root.dataset.subjectType==='individual'?'individual':'business';
  const isEn=lang==='en';
  let sb=null,user=null,current=null,fundingCase=null;

  const T={
    ar:{
      portal:'بوابة العميل',business:'منشأة',individual:'فرد',
      country:'الدولة',selectCountry:'اختر الدولة',subject:'بيانات صاحب الموافقة',
      legalName:'الاسم القانوني للمنشأة',registration:'رقم التسجيل / السجل',unified:'الرقم الموحد / معرف المنشأة',legalForm:'الشكل القانوني',activity:'النشاط الرئيسي',
      fullName:'الاسم الكامل',idNumber:'رقم الهوية / الإقامة / جواز السفر',idExpiry:'تاريخ انتهاء الهوية',birthDate:'تاريخ الميلاد',nationality:'الجنسية',occupation:'المهنة',monthlyIncome:'الدخل الشهري',
      contact:'بيانات التواصل',mobile:'رقم الجوال',email:'البريد الإلكتروني',
      purpose:'غرض الاستعلام',purposeOpt:'اختر الغرض',p1:'تقييم طلب خدمة أو تمويل',p2:'إنشاء العلاقة أو تحديثها',p3:'مراجعة دورية أو إدارة علاقة قائمة',p4:'إدارة مخاطر أو التحقق من البيانات',
      scope:'نطاق الموافقة',oneTime:'استعلام واحد مرتبط بالطلب الحالي',ongoing:'استعلامات دورية أثناء العلاقة وفق الأنظمة السارية',
      capacity:'صفة مقدم الموافقة',capacityPlaceholder:'مالك / مفوض / صاحب الطلب / صفة أخرى',
      consentHeading:'الإقرار والموافقة',
      statement:'أوافق صراحةً على الاستعلام عن معلوماتي الائتمانية والتحقق منها والحصول عليها من مصادر المعلومات الائتمانية المرخصة أو الجهات المصرح لها نظامًا في الدولة المختارة، وذلك لغرض تقييم الطلب أو إنشاء أو إدارة أو مراجعة العلاقة أو الخدمات أو التسهيلات. كما أوافق على معالجة المعلومات ومشاركتها مع الأطراف المصرح لها بالقدر اللازم ووفق الأنظمة المعمول بها. أفهم أن هذه الموافقة لا تعني الموافقة على أي طلب، وأن نطاقها ومدتها يخضعان للأنظمة السارية.',
      c1:'أوافق على الاستعلام والحصول على المعلومات الائتمانية من المصادر المرخصة أو المصرح لها نظامًا.',
      c2:'أوافق على معالجة المعلومات والتحقق منها ومشاركتها مع الأطراف المصرح لها عند الحاجة ووفق الأنظمة السارية.',
      c3:'أقر بصحة البيانات التي قدمتها وبأنني مخول بتقديم هذه الموافقة.',
      c4:'أفهم أنني أستطيع طلب سحب الموافقة أو تقييدها متى كان ذلك مسموحًا به نظامًا، دون الإخلال بما تم تنفيذه بصورة مشروعة قبل ذلك.',
      save:'حفظ كمسودة',submit:'إرسال الموافقة',print:'طباعة',notes:'ملاحظات',optional:'اختياري',
      restored:'تم استعادة آخر مسودة محفوظة.',saved:'تم حفظ المسودة.',submitted:'تم إرسال الموافقة.',secure:'تعذر تهيئة الاتصال الآمن.',saveError:'تعذر حفظ النموذج: ',exportError:'تعذر التصدير: ',
      requiredCountry:'اختر الدولة قبل الإرسال.',requiredConsent:'يجب الموافقة على جميع بنود الإقرار قبل الإرسال.',
      metaSubject:'نوع صاحب الموافقة',metaCountry:'الدولة',metaScope:'نطاق الموافقة',metaPurpose:'الغرض',
      dataTable:'البيانات',field:'البيان',value:'القيمة',consentTable:'تفاصيل الموافقة',accepted:'موافق'
    },
    en:{
      portal:'Client Portal',business:'Business',individual:'Individual',
      country:'Country',selectCountry:'Select country',subject:'Consent Subject Information',
      legalName:'Legal Business Name',registration:'Registration / Business ID',unified:'Unified / Entity Identifier',legalForm:'Legal Form',activity:'Primary Activity',
      fullName:'Full Name',idNumber:'National / Residence / Passport ID',idExpiry:'ID Expiry Date',birthDate:'Date of Birth',nationality:'Nationality',occupation:'Occupation',monthlyIncome:'Monthly Income',
      contact:'Contact Information',mobile:'Mobile Number',email:'Email',
      purpose:'Inquiry Purpose',purposeOpt:'Select purpose',p1:'Assess a service or financing request',p2:'Establish or update a relationship',p3:'Periodic review or management of an existing relationship',p4:'Risk management or data verification',
      scope:'Consent Scope',oneTime:'One inquiry related to the current request',ongoing:'Periodic inquiries during the relationship where permitted by applicable law',
      capacity:'Capacity of the person providing consent',capacityPlaceholder:'Owner / authorized representative / applicant / other capacity',
      consentHeading:'Declaration and Consent',
      statement:'I expressly consent to the inquiry, verification and retrieval of my credit information from licensed credit-information sources or other parties legally authorized in the selected country for the purpose of assessing a request or establishing, administering or reviewing a relationship, service or facility. I also consent to the processing and sharing of such information with authorized parties to the extent necessary and in accordance with applicable law. I understand that this consent does not constitute approval of any request and that its scope and duration remain subject to applicable law.',
      c1:'I consent to inquiries and retrieval of credit information from licensed or legally authorized sources.',
      c2:'I consent to processing, verification and sharing with authorized parties when necessary and permitted by applicable law.',
      c3:'I confirm that the information I provided is accurate and that I am authorized to provide this consent.',
      c4:'I understand that I may request withdrawal or restriction of consent where permitted by law, without affecting processing lawfully completed beforehand.',
      save:'Save Draft',submit:'Submit Consent',print:'Print',notes:'Notes',optional:'Optional',
      restored:'Latest saved draft restored.',saved:'Draft saved.',submitted:'Consent submitted.',secure:'Unable to initialize the secure connection.',saveError:'Unable to save the form: ',exportError:'Export failed: ',
      requiredCountry:'Select a country before submission.',requiredConsent:'All consent declarations must be accepted before submission.',
      metaSubject:'Consent Subject',metaCountry:'Country',metaScope:'Consent Scope',metaPurpose:'Purpose',
      dataTable:'Information',field:'Field',value:'Value',consentTable:'Consent Details',accepted:'Accepted'
    }
  }[lang];

  function e(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function subjectFields(){
    if(subjectType==='business'){
      return `
        <div class="cc-field"><label for="legalName">${T.legalName}</label><input id="legalName" required></div>
        <div class="cc-field"><label for="registrationNumber">${T.registration}</label><input id="registrationNumber" required></div>
        <div class="cc-field"><label for="unifiedNumber">${T.unified}</label><input id="unifiedNumber"></div>
        <div class="cc-field"><label for="legalForm">${T.legalForm}</label><input id="legalForm"></div>
        <div class="cc-field"><label for="primaryActivity">${T.activity}</label><input id="primaryActivity"></div>
        <div class="cc-field"><label for="capacity">${T.capacity}</label><input id="capacity" placeholder="${T.capacityPlaceholder}" required></div>`;
    }
    return `
      <div class="cc-field"><label for="fullName">${T.fullName}</label><input id="fullName" required></div>
      <div class="cc-field"><label for="idNumber">${T.idNumber}</label><input id="idNumber" required></div>
      <div class="cc-field"><label for="idExpiry">${T.idExpiry}</label><input id="idExpiry" type="date"></div>
      <div class="cc-field"><label for="birthDate">${T.birthDate}</label><input id="birthDate" type="date"></div>
      <div class="cc-field"><label for="nationality">${T.nationality}</label><input id="nationality"></div>
      <div class="cc-field"><label for="occupation">${T.occupation}</label><input id="occupation"></div>
      <div class="cc-field"><label for="monthlyIncome">${T.monthlyIncome}</label><input id="monthlyIncome" type="number" min="0" step="0.01"></div>`;
  }

  root.innerHTML=`
    <section class="cc-hero"><div class="hero__eyebrow">${T.portal}</div><h1 id="dynamicTitle"></h1><p id="jurisdictionNote"></p></section>
    <div id="ccStatus" class="cc-status" role="status"></div>
    <form id="creditConsentForm">
      <section class="cc-card">
        <h2>1. ${T.country}</h2>
        <div class="cc-grid">
          <div class="cc-field"><label for="countryCode">${T.country}</label><select id="countryCode" required><option value="">${T.selectCountry}</option></select></div>
          <div class="cc-field"><label for="purpose">${T.purpose}</label><select id="purpose" required><option value="">${T.purposeOpt}</option><option value="request">${T.p1}</option><option value="relationship">${T.p2}</option><option value="periodic_review">${T.p3}</option><option value="risk_verification">${T.p4}</option></select></div>
          <div class="cc-field"><label for="scope">${T.scope}</label><select id="scope" required><option value="one_time">${T.oneTime}</option><option value="ongoing">${T.ongoing}</option></select></div>
        </div>
      </section>
      <section class="cc-card"><h2>2. ${T.subject}</h2><div class="cc-grid">${subjectFields()}</div></section>
      <section class="cc-card"><h2>3. ${T.contact}</h2><div class="cc-grid"><div class="cc-field"><label for="mobile">${T.mobile}</label><input id="mobile" type="tel"></div><div class="cc-field"><label for="email">${T.email}</label><input id="email" type="email"></div></div></section>
      <section class="cc-card">
        <h2>4. ${T.consentHeading}</h2>
        <div class="cc-statement" id="consentStatement">${T.statement}</div>
        <label class="cc-check"><input type="checkbox" id="consentInquiry" required> <span>${T.c1}</span></label>
        <label class="cc-check"><input type="checkbox" id="consentProcessing" required> <span>${T.c2}</span></label>
        <label class="cc-check"><input type="checkbox" id="consentAccuracy" required> <span>${T.c3}</span></label>
        <label class="cc-check"><input type="checkbox" id="consentWithdrawal" required> <span>${T.c4}</span></label>
        <div class="cc-field" style="margin-top:1rem"><label for="notes">${T.notes}</label><textarea id="notes" rows="3" placeholder="${T.optional}"></textarea></div>
      </section>
      <section class="cc-card">
        <div class="cc-actions"><button type="button" class="btn btn-outline" id="saveDraft">${T.save}</button><button type="submit" class="btn btn-primary">${T.submit}</button></div>
        <div class="export-actions"><button type="button" class="btn btn-outline" data-export="print">${T.print}</button><button type="button" class="btn btn-outline" data-export="pdf">PDF</button><button type="button" class="btn btn-outline" data-export="excel">Excel</button><button type="button" class="btn btn-outline" data-export="word">Word</button></div>
      </section>
    </form>`;

  const form=document.getElementById('creditConsentForm'), statusEl=document.getElementById('ccStatus');
  const g=id=>document.getElementById(id);
  function showStatus(msg,ok){statusEl.textContent=msg;statusEl.className='cc-status show '+(ok?'ok':'err');}
  function selectedText(id){const el=g(id);return el&&el.options?el.options[el.selectedIndex]?.text||'':'';}

  async function populateCountries(selected){
    const select=g('countryCode');
    const apply=(items)=>{
      select.innerHTML='<option value="">'+e(T.selectCountry)+'</option>'+items.map(x=>'<option value="'+e(x.value)+'">'+e(x.label)+'</option>').join('');
      select.value=selected||'SA';
      updateJurisdiction();
    };
    try{
      if(window.BondsGeo&&window.BondsGeo.ensureMasterData){
        await window.BondsGeo.ensureMasterData();
        const items=window.BondsGeo.getCountries({lang}).sort((a,b)=>a.label.localeCompare(b.label,lang));
        if(items.length){apply(items);return;}
      }
    }catch(_){}
    const items=(window.BondsCreditConsentTerminology?.COUNTRIES||[]).map(x=>({value:x[0],label:isEn?x[2]:x[1]}));
    apply(items);
  }

  function updateJurisdiction(){
    const code=g('countryCode').value||'SA';
    const title=window.BondsCreditConsentTerminology?.consentTitle(code,lang)||(isEn?'Credit Information Consent':'نموذج الموافقة على المعلومات الائتمانية');
    const subjectLabel=subjectType==='business'?T.business:T.individual;
    const country=selectedText('countryCode');
    g('dynamicTitle').textContent=title+' — '+subjectLabel+(country?' — '+country:'');
    g('jurisdictionNote').textContent=isEn
      ? 'The form adapts its generic title to the selected jurisdiction and does not name any institution or person.'
      : 'يتكيف مسمى النموذج بصورة عامة مع الدولة المختارة، دون ذكر اسم أي جهة أو شخص.';
    document.title=title+' — '+subjectLabel+' | Bonds';
  }

  function subjectData(){
    if(subjectType==='business') return {
      legal_name:g('legalName').value.trim(),registration_number:g('registrationNumber').value.trim(),unified_number:g('unifiedNumber').value.trim(),legal_form:g('legalForm').value.trim(),primary_activity:g('primaryActivity').value.trim(),capacity:g('capacity').value.trim()
    };
    return {
      full_name:g('fullName').value.trim(),id_number:g('idNumber').value.trim(),id_expiry:g('idExpiry').value,birth_date:g('birthDate').value,nationality:g('nationality').value.trim(),occupation:g('occupation').value.trim(),monthly_income:Number(g('monthlyIncome').value||0)
    };
  }

  function consentData(){
    return {
      title:g('dynamicTitle').textContent,country_name:selectedText('countryCode'),purpose:g('purpose').value,purpose_label:selectedText('purpose'),scope:g('scope').value,scope_label:selectedText('scope'),
      inquiry:g('consentInquiry').checked,processing:g('consentProcessing').checked,accuracy:g('consentAccuracy').checked,withdrawal:g('consentWithdrawal').checked,
      statement:g('consentStatement').textContent.trim(),language:lang
    };
  }

  function payload(status){
    return {
      user_id:user.id,client_id:current?.client_id||fundingCase?.client_id||null,funding_case_id:fundingCase?.id||null,subject_type:subjectType,country_code:g('countryCode').value,status,
      subject_data:subjectData(),contact_data:{mobile:g('mobile').value.trim(),email:g('email').value.trim()},
      consent_data:consentData(),consent_text_version:'2026-10',notes:g('notes').value.trim(),
      consented_at:status==='submitted'?new Date().toISOString():null,submitted_at:status==='submitted'?new Date().toISOString():null
    };
  }

  function hydrate(row){
    current=row; const s=row.subject_data||{},c=row.contact_data||{},d=row.consent_data||{};
    populateCountries(row.country_code).then(()=>{g('countryCode').value=row.country_code||'SA';updateJurisdiction();});
    if(subjectType==='business'){
      [['legalName',s.legal_name],['registrationNumber',s.registration_number],['unifiedNumber',s.unified_number],['legalForm',s.legal_form],['primaryActivity',s.primary_activity],['capacity',s.capacity]].forEach(([id,v])=>{if(v!=null)g(id).value=v;});
    }else{
      [['fullName',s.full_name],['idNumber',s.id_number],['idExpiry',s.id_expiry],['birthDate',s.birth_date],['nationality',s.nationality],['occupation',s.occupation],['monthlyIncome',s.monthly_income]].forEach(([id,v])=>{if(v!=null)g(id).value=v;});
    }
    [['mobile',c.mobile],['email',c.email],['purpose',d.purpose],['scope',d.scope],['notes',row.notes]].forEach(([id,v])=>{if(v!=null)g(id).value=v;});
    g('consentInquiry').checked=!!d.inquiry;g('consentProcessing').checked=!!d.processing;g('consentAccuracy').checked=!!d.accuracy;g('consentWithdrawal').checked=!!d.withdrawal;
  }

  async function save(status){
    if(!sb||!user){showStatus(T.secure,false);return;}
    if(status==='submitted'){
      if(!form.reportValidity()) return;
      if(!g('countryCode').value){showStatus(T.requiredCountry,false);return;}
      if(!g('consentInquiry').checked||!g('consentProcessing').checked||!g('consentAccuracy').checked||!g('consentWithdrawal').checked){showStatus(T.requiredConsent,false);return;}
    }
    const p=payload(status);
    const result=current?.id
      ? await sb.from('client_credit_consents').update(p).eq('id',current.id).select().single()
      : await sb.from('client_credit_consents').insert(p).select().single();
    if(result.error){showStatus(T.saveError+result.error.message,false);return;}
    current=result.data;
    if(fundingCase){try{await window.BondsFundingCaseContext.syncSubmission(sb,fundingCase,subjectType==='business'?'credit_business':'credit_individual',current);}catch(e){showStatus(T.saveError+e.message,false);return;}}
    showStatus(status==='submitted'?T.submitted:T.saved,true);
  }

  function exportDoc(){
    const p=payload(current?.status||'draft'),s=p.subject_data,c=p.contact_data,d=p.consent_data;
    const subjectRows=subjectType==='business'
      ? [[T.legalName,s.legal_name],[T.registration,s.registration_number],[T.unified,s.unified_number],[T.legalForm,s.legal_form],[T.activity,s.primary_activity],[T.capacity,s.capacity]]
      : [[T.fullName,s.full_name],[T.idNumber,s.id_number],[T.idExpiry,s.id_expiry],[T.birthDate,s.birth_date],[T.nationality,s.nationality],[T.occupation,s.occupation],[T.monthlyIncome,s.monthly_income]];
    subjectRows.push([T.mobile,c.mobile],[T.email,c.email?'✉':'']);
    return {
      lang,title:g('dynamicTitle').textContent,subtitle:'Bonds Global',filenameBase:'bonds-credit-consent-'+subjectType+'-'+(g('countryCode').value||'country'),
      metadata:[{label:T.metaSubject,value:subjectType==='business'?T.business:T.individual},{label:T.metaCountry,value:selectedText('countryCode')},{label:T.metaScope,value:d.scope_label},{label:T.metaPurpose,value:d.purpose_label}],
      tables:[
        {title:T.dataTable,headers:[T.field,T.value],rows:subjectRows},
        {title:T.consentTable,headers:[T.field,T.value],rows:[[T.consentHeading,d.statement],[T.c1,d.inquiry?T.accepted:'—'],[T.c2,d.processing?T.accepted:'—'],[T.c3,d.accuracy?T.accepted:'—'],[T.c4,d.withdrawal?T.accepted:'—']]}
      ],notes:p.notes
    };
  }

  g('countryCode').addEventListener('change',updateJurisdiction);
  g('saveDraft').addEventListener('click',()=>save('draft'));
  form.addEventListener('submit',e=>{e.preventDefault();save('submitted');});
  document.querySelectorAll('[data-export]').forEach(btn=>btn.addEventListener('click',async()=>{try{await window.BondsBrandedExport.exportDocument(btn.dataset.export,exportDoc());}catch(err){showStatus(T.exportError+err.message,false);}}));

  (async function init(){
    await populateCountries('SA');
    await window.BondsAuth.ensureEnv();
    const u=await window.BondsAuth.getUser();user=u.data?.user;
    if(!user){const authPath=isEn?'/en/calculators/auth/index.html':'/calculators/auth/index.html';location.href=authPath+'?redirect='+encodeURIComponent(location.pathname);return;}
    sb=window.BondsAuth.getSupabase();if(!sb){showStatus(T.secure,false);return;}
    fundingCase=await window.BondsFundingCaseContext.resolve(sb,user);
    const cid=await sb.rpc('get_my_client_id');
    let existingQuery=sb.from('client_credit_consents').select('*').eq('user_id',user.id).eq('subject_type',subjectType);
    if(fundingCase) existingQuery=existingQuery.eq('funding_case_id',fundingCase.id); else existingQuery=existingQuery.eq('status','draft');
    const existing=await existingQuery.order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(existing.data){hydrate(existing.data);if(fundingCase)await window.BondsFundingCaseContext.syncSubmission(sb,fundingCase,subjectType==='business'?'credit_business':'credit_individual',existing.data);showStatus(T.restored,true);return;}
    if(fundingCase||cid.data)current={client_id:fundingCase?.client_id||cid.data||null,funding_case_id:fundingCase?.id||null};
    if(subjectType==='business'){
      const est=await sb.from('client_establishment_profiles').select('identity_data,operations_data').eq('user_id',user.id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(est.data){const i=est.data.identity_data||{},o=est.data.operations_data||{};if(g('legalName'))g('legalName').value=i.legal_name||'';if(g('registrationNumber'))g('registrationNumber').value=i.cr_number||'';if(g('unifiedNumber'))g('unifiedNumber').value=i.unified_number||'';if(g('legalForm'))g('legalForm').value=i.entity_type||'';if(g('primaryActivity'))g('primaryActivity').value=o.main_activity||'';}
    }
  })();
})();