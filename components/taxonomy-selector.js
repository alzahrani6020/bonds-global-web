(function(){
  'use strict';

  const isAr = (document.documentElement.lang || 'ar').toLowerCase().startsWith('ar');
  const T = isAr ? {
    country:'الدولة', sectorSearch:'ابحث عن قطاع...', activitySearch:'ابحث عن نشاط...',
    selectCountry:'اختر الدولة', selectSector:'اختر القطاع', selectActivity:'اختر النشاط',
    addSector:'+ إضافة قطاع جديد', addActivity:'+ إضافة نشاط جديد',
    addSectorTitle:'اقتراح قطاع جديد', addActivityTitle:'اقتراح نشاط جديد',
    arName:'الاسم بالعربية', enName:'الاسم بالإنجليزية (اختياري)', description:'وصف مختصر (اختياري)',
    send:'إرسال المقترح', cancel:'إلغاء', saved:'تم إرسال المقترح للمراجعة.',
    failed:'تعذر إرسال المقترح.', pending:'سيُراجع الاقتراح قبل اعتماده في التصنيف الرسمي.',
    unavailable:'غير متاح', restricted:'مقيد', unknown:'الحالة المحلية غير موثقة'
  } : {
    country:'Country', sectorSearch:'Search sectors...', activitySearch:'Search activities...',
    selectCountry:'Select country', selectSector:'Select sector', selectActivity:'Select activity',
    addSector:'+ Add new sector', addActivity:'+ Add new activity',
    addSectorTitle:'Propose a new sector', addActivityTitle:'Propose a new activity',
    arName:'Arabic name', enName:'English name (optional)', description:'Short description (optional)',
    send:'Submit proposal', cancel:'Cancel', saved:'Proposal submitted for review.',
    failed:'Could not submit proposal.', pending:'The proposal will be reviewed before entering the canonical taxonomy.',
    unavailable:'Unavailable', restricted:'Restricted', unknown:'Local status unverified'
  };

  let sectorDD=null, activityDD=null, countryDD=null;
  let sectors=[], activities=[];
  let initPromise=null;
  const byId=id=>document.getElementById(id);

  function option(value,label,code,status){
    return { value, label, code, status };
  }

  function setNativeOptions(select, rows, placeholder){
    select.innerHTML='';
    const ph=document.createElement('option');
    ph.value=''; ph.textContent=placeholder; ph.disabled=true; ph.selected=true;
    select.appendChild(ph);
    rows.forEach(row=>{
      const o=document.createElement('option');
      o.value=row.value;
      o.textContent=row.label;
      if(row.code) o.dataset.code=row.code;
      if(row.status) o.dataset.status=row.status;
      select.appendChild(o);
    });
  }

  function enhance(select, placeholder, searchPlaceholder){
    if (!window.UniversalDropdown) return null;
    return window.UniversalDropdown.fromSelect(select,{
      search:true, searchPlaceholder, placeholder, sort:false, deduplicate:true,
      removeEmpty:false, maxResults:0, virtualize:true, virtualThreshold:40
    });
  }

  function syncDataset(select){
    const o=select.selectedOptions && select.selectedOptions[0];
    select.dataset.canonicalCode=o?.dataset?.code || '';
    select.dataset.selectedLabel=o?.textContent || '';
    select.dataset.countryStatus=o?.dataset?.status || '';
  }

  function selectedCountry(){ return (byId('country')?.value || 'SA').toUpperCase(); }
  function selectedSectorCode(){ return byId('sector')?.dataset?.canonicalCode || ''; }

  async function json(url){
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }

  async function loadCountries(){
    const sel=byId('country'); if(!sel) return;
    const data=await json('/api/v3/catalog/countries');
    const rows=(data.countries||[]).map(c=>option(c.code,(isAr?c.name_ar:c.name_en)||c.code,c.code));
    setNativeOptions(sel,rows,T.selectCountry);
    const stored=(()=>{try{return localStorage.getItem('bonds_selected_country')||'SA';}catch(_){return 'SA';}})();
    if(rows.some(r=>r.value===stored)) sel.value=stored; else if(rows.length) sel.value=rows[0].value;
    countryDD=enhance(sel,T.selectCountry,isAr?'ابحث عن دولة...':'Search countries...');
    if(countryDD) countryDD.value=sel.value;
    sel.addEventListener('change',async()=>{
      syncDataset(sel);
      try{localStorage.setItem('bonds_selected_country',sel.value);}catch(_){}
      await loadTaxonomy();
    });
    syncDataset(sel);
  }

  async function loadTaxonomy(){
    const sectorSel=byId('sector'), activitySel=byId('primaryActivity');
    if(!sectorSel||!activitySel) return;
    const country=encodeURIComponent(selectedCountry());
    const data=await json('/api/v3/investment-taxonomy?country='+country+'&include=activities&depth=subsector');
    sectors=(data.sectors||[]).map(s=>option(s.name_ar || s.name_en || s.code,(isAr?s.name_ar:s.name_en)||s.name_ar||s.name_en||s.code,s.code));
    sectors.push(option('__propose_sector__',T.addSector,'__propose_sector__'));
    const previousSector=sectorSel.dataset.selectedLabel || sectorSel.value || '';
    setNativeOptions(sectorSel,sectors,T.selectSector);
    if(previousSector && Array.from(sectorSel.options).some(o=>o.value===previousSector)) sectorSel.value=previousSector;
    if(sectorDD){sectorDD.destroy(); sectorDD=null;}
    sectorDD=enhance(sectorSel,T.selectSector,T.sectorSearch);
    syncDataset(sectorSel);

    const allActivities=(data.activities||[]).map(a=>{
      const status=a.country?.availability_status || 'unknown';
      let suffix='';
      if(status==='restricted') suffix=isAr?' · مقيد':' · Restricted';
      else if(status==='unavailable') suffix=isAr?' · غير متاح':' · Unavailable';
      else if(status==='unknown') suffix=isAr?' · غير موثق':' · Unverified';
      return option(a.name_ar || a.name_en || a.code,((isAr?a.name_ar:a.name_en)||a.name_ar||a.name_en||a.code)+suffix,a.code,status);
    });
    activities=allActivities;
    sectorSel.onchange=()=>{syncDataset(sectorSel); if(sectorSel.dataset.canonicalCode==='__propose_sector__'){openProposal('sector'); return;} loadActivitiesForSector();};
    await loadActivitiesForSector(data);
  }

  async function loadActivitiesForSector(prefetched){
    const activitySel=byId('primaryActivity'); if(!activitySel) return;
    const sector=selectedSectorCode();
    let rows=[];
    if(sector && sector!=='__propose_sector__'){
      let data=prefetched;
      if(!data || data.sector_filter!==sector){
        data=await json('/api/v3/investment-taxonomy?country='+encodeURIComponent(selectedCountry())+'&sector='+encodeURIComponent(sector)+'&include=activities&depth=subsector');
      }
      rows=(data.activities||[]).map(a=>{
        const status=a.country?.availability_status || 'unknown';
        let suffix='';
        if(status==='restricted') suffix=isAr?' · مقيد':' · Restricted';
        else if(status==='unavailable') suffix=isAr?' · غير متاح':' · Unavailable';
        else if(status==='unknown') suffix=isAr?' · غير موثق':' · Unverified';
        return option(a.name_ar || a.name_en || a.code,((isAr?a.name_ar:a.name_en)||a.name_ar||a.name_en||a.code)+suffix,a.code,status);
      });
    } else {
      rows=activities.slice();
    }
    rows.push(option('__propose_activity__',T.addActivity,'__propose_activity__'));
    const previous=activitySel.dataset.selectedLabel || activitySel.value || '';
    setNativeOptions(activitySel,rows,T.selectActivity);
    if(previous && Array.from(activitySel.options).some(o=>o.value===previous)) activitySel.value=previous;
    if(activityDD){activityDD.destroy(); activityDD=null;}
    activityDD=enhance(activitySel,T.selectActivity,T.activitySearch);
    activitySel.onchange=()=>{
      syncDataset(activitySel);
      if(activitySel.dataset.canonicalCode==='__propose_activity__'){openProposal('activity'); return;}
      // Canonical activity identity is stored separately in dataset.
      // Never write the internal canonical code into the user's ISIC/activity-code field.
    };
    syncDataset(activitySel);
  }

  function ensureModal(){
    let modal=byId('taxonomyProposalModal'); if(modal) return modal;
    modal=document.createElement('div');
    modal.id='taxonomyProposalModal';
    modal.className='tax-proposal-modal';
    modal.hidden=true;
    modal.innerHTML='<div class="tax-proposal-dialog" role="dialog" aria-modal="true" aria-labelledby="taxProposalTitle">'+
      '<button type="button" class="tax-proposal-close" aria-label="'+T.cancel+'">×</button>'+
      '<h3 id="taxProposalTitle"></h3>'+
      '<p class="tax-proposal-note">'+T.pending+'</p>'+
      '<form id="taxonomyProposalForm">'+
      '<input type="hidden" id="proposalType">'+
      '<label>'+T.arName+'<input id="proposalNameAr" required maxlength="160"></label>'+
      '<label>'+T.enName+'<input id="proposalNameEn" maxlength="160"></label>'+
      '<label>'+T.description+'<textarea id="proposalDescription" maxlength="1000" rows="3"></textarea></label>'+
      '<div class="tax-proposal-actions"><button type="button" class="btn btn-outline" id="proposalCancel">'+T.cancel+'</button><button type="submit" class="btn btn-primary">'+T.send+'</button></div>'+
      '</form></div>';
    document.body.appendChild(modal);
    modal.querySelector('.tax-proposal-close').onclick=closeProposal;
    byId('proposalCancel').onclick=closeProposal;
    modal.addEventListener('click',e=>{if(e.target===modal)closeProposal();});
    byId('taxonomyProposalForm').addEventListener('submit',submitProposal);
    return modal;
  }

  function openProposal(type){
    const modal=ensureModal();
    byId('proposalType').value=type;
    byId('taxProposalTitle').textContent=type==='sector'?T.addSectorTitle:T.addActivityTitle;
    byId('proposalNameAr').value='';
    byId('proposalNameEn').value='';
    byId('proposalDescription').value='';
    modal.hidden=false;
    setTimeout(()=>byId('proposalNameAr').focus(),0);
  }
  function closeProposal(){
    const modal=byId('taxonomyProposalModal'); if(modal) modal.hidden=true;
    const sector=byId('sector'), activity=byId('primaryActivity');
    if(sector?.dataset.canonicalCode==='__propose_sector__'){sector.value='';syncDataset(sector);sectorDD?.refresh();}
    if(activity?.dataset.canonicalCode==='__propose_activity__'){activity.value='';syncDataset(activity);activityDD?.refresh();}
  }

  async function submitProposal(e){
    e.preventDefault();
    const type=byId('proposalType').value;
    const sb=window.BondsAuth?.getSupabase?.();
    const user=(await window.BondsAuth?.getUser?.())?.data?.user;
    if(!sb||!user){window.alert(T.failed);return;}
    const row={
      user_id:user.id,
      country_code:selectedCountry()||null,
      proposal_type:type,
      status:'pending',
      proposed_name_ar:byId('proposalNameAr').value.trim(),
      proposed_name_en:byId('proposalNameEn').value.trim()||null,
      parent_sector_code:type==='activity'?(selectedSectorCode()||null):null,
      description:byId('proposalDescription').value.trim()||null,
      metadata:{source:'client_business_activity',language:isAr?'ar':'en'}
    };
    const {error}=await sb.from('taxonomy_proposals').insert(row);
    if(error){console.error('[taxonomy proposal]',error);window.alert(T.failed);return;}
    const status=byId('status');
    if(status){status.textContent=T.saved;status.className='act-status show ok';}
    closeProposal();
  }

  async function init(){
    if(initPromise) return initPromise;
    initPromise=(async()=>{
      const country=byId('country'), sector=byId('sector'), activity=byId('primaryActivity');
      if(!country||!sector||!activity) return;
      try{
        await loadCountries();
        await loadTaxonomy();
      }catch(err){
        console.warn('[taxonomy selector]',err.message);
        throw err;
      }
    })();
    return initPromise;
  }

  function selectByCanonicalOrLabel(select, canonicalCode, legacyLabel){
    if(!select) return false;
    const opts=Array.from(select.options||[]);
    let found=null;
    if(canonicalCode) found=opts.find(o=>o.dataset?.code===canonicalCode);
    if(!found && legacyLabel) found=opts.find(o=>o.value===legacyLabel || o.textContent===legacyLabel);
    if(!found) return false;
    select.value=found.value;
    syncDataset(select);
    return true;
  }

  async function setSelection(selection={}){
    await init();
    const country=byId('country'), sector=byId('sector'), activity=byId('primaryActivity');
    const wantedCountry=(selection.country_code||selection.countryCode||'').toUpperCase();
    if(wantedCountry && Array.from(country.options).some(o=>o.value===wantedCountry) && country.value!==wantedCountry){
      country.value=wantedCountry;
      syncDataset(country);
      try{localStorage.setItem('bonds_selected_country',wantedCountry);}catch(_){}
      await loadTaxonomy();
    }
    selectByCanonicalOrLabel(sector,selection.sector_code||selection.sectorCode,selection.sector||selection.sector_label);
    sectorDD?.refresh?.();
    await loadActivitiesForSector();
    selectByCanonicalOrLabel(activity,selection.canonical_activity_code||selection.activityCode,selection.primary_activity||selection.activity||selection.activity_label);
    activityDD?.refresh?.();
    return {
      country_code:selectedCountry(),
      sector_code:selectedSectorCode(),
      canonical_activity_code:activity?.dataset?.canonicalCode||''
    };
  }

  window.BondsTaxonomySelector={
    init,
    ready:()=>init(),
    setSelection,
    getCountryCode:selectedCountry,
    getSectorCode:selectedSectorCode,
    getActivityCode:()=>byId('primaryActivity')?.dataset?.canonicalCode||'',
    getSectorLabel:()=>byId('sector')?.dataset?.selectedLabel||byId('sector')?.value||'',
    getActivityLabel:()=>byId('primaryActivity')?.dataset?.selectedLabel||byId('primaryActivity')?.value||''
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{init().catch(()=>{});});
  else init().catch(()=>{});
})();