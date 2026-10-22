(function () {
  'use strict';

  const API = '/api/v3';
  const PROPOSE_SECTOR = '__propose_sector__';
  const PROPOSE_ACTIVITY = '__propose_activity__';
  const PROPOSE_REGION = '__propose_region__';
  const PROPOSE_LOCALITY = '__propose_locality__';
  const state = { countries: [], cities: [], sectors: [], activities: [], services: [] };
  const dropdowns = {};
  const lang = (document.documentElement.lang || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
  const t = {
    ar: {
      title:'اختر وجهتك وابدأ الآن', country:'الدولة', region:'المنطقة / المحافظة', locality:'الموقع',
      sector:'القطاع', activity:'النشاط', service:'الخدمة المطلوبة', start:'ابدأ الآن', choose:'اختر',
      custom:'خدمة مخصصة / مراجعة', countrySearch:'ابحث عن دولة...', regionSearch:'ابحث عن منطقة أو محافظة...',
      localitySearch:'ابحث عن مدينة أو موقع...', sectorSearch:'ابحث عن قطاع...', activitySearch:'ابحث عن نشاط...',
      serviceSearch:'ابحث عن خدمة...', addSector:'+ إضافة قطاع جديد', addActivity:'+ إضافة نشاط جديد',
      addRegion:'+ إضافة منطقة / محافظة', addLocality:'+ إضافة مدينة / قرية / هجرة / نجع / واحة',
      addSectorTitle:'اقتراح قطاع جديد', addActivityTitle:'اقتراح نشاط جديد',
      addRegionTitle:'اقتراح منطقة / محافظة جديدة', addLocalityTitle:'اقتراح موقع جغرافي جديد',
      localityType:'نوع الموقع', arName:'الاسم بالعربية',
      enName:'الاسم بالإنجليزية (اختياري)', description:'وصف مختصر (اختياري)', send:'إرسال المقترح',
      cancel:'إلغاء', pending:'سيُراجع الاقتراح قبل اعتماده في التصنيف الرسمي.',
      saved:'تم إرسال المقترح للمراجعة.', failed:'تعذر إرسال المقترح.', login:'يلزم تسجيل الدخول لإرسال المقترح.',
      localityTypes:{city:'مدينة',town:'بلدة',village:'قرية',hijra:'هجرة',hamlet:'نجع / تجمع صغير',oasis:'واحة',district:'حي / منطقة',settlement:'تجمع سكاني',other:'أخرى'}
    },
    en: {
      title:'Choose your path and start', country:'Country', region:'Region / Province', locality:'Location',
      sector:'Sector', activity:'Activity', service:'Required service', start:'Start now', choose:'Choose',
      custom:'Custom service / review', countrySearch:'Search countries...', regionSearch:'Search regions or provinces...',
      localitySearch:'Search cities or locations...', sectorSearch:'Search sectors...', activitySearch:'Search activities...',
      serviceSearch:'Search services...', addSector:'+ Add new sector', addActivity:'+ Add new activity',
      addRegion:'+ Add region / governorate', addLocality:'+ Add city / village / hijra / hamlet / oasis',
      addSectorTitle:'Propose a new sector', addActivityTitle:'Propose a new activity',
      addRegionTitle:'Propose a new region / governorate', addLocalityTitle:'Propose a new locality',
      localityType:'Locality type', arName:'Arabic name',
      enName:'English name (optional)', description:'Short description (optional)', send:'Submit proposal',
      cancel:'Cancel', pending:'The proposal will be reviewed before entering the canonical taxonomy.',
      saved:'Proposal submitted for review.', failed:'Could not submit proposal.', login:'Sign in is required to submit a proposal.',
      localityTypes:{city:'City',town:'Town',village:'Village',hijra:'Hijra',hamlet:'Hamlet',oasis:'Oasis',district:'District',settlement:'Settlement',other:'Other'}
    }
  }[lang];

  function q(s){ return document.querySelector(s); }
  function label(row) { return lang === 'en' ? (row.name_en || row.name_ar || row.code) : (row.name_ar || row.name_en || row.code); }
  function selectedText(el) { return el?.options?.[el.selectedIndex]?.text || ''; }

  function track(event, properties={}) {
    fetch('/api/log-usage', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', keepalive:true,
      body:JSON.stringify({
        event, calculator:'service_discovery', country:q('#bondsCountry')?.value || null,
        lang, action:'service', properties, url:window.location.href
      })
    }).catch(()=>{});
  }

  async function json(url) {
    const r = await fetch(url, { credentials:'same-origin', cache:'no-store' });
    if (!r.ok) {
      const err = new Error('HTTP ' + r.status);
      err.status = r.status;
      throw err;
    }
    return r.json();
  }

  function setOptions(el, rows, valueKey, labelFn, first, extras=[], iconFn=null) {
    const current = el.value;
    el.innerHTML = '';
    const firstOption = document.createElement('option');
    firstOption.value = '';
    firstOption.textContent = first || t.choose;
    el.appendChild(firstOption);

    rows.forEach(row => {
      const option = document.createElement('option');
      option.value = String(row[valueKey] || '');
      option.textContent = labelFn(row);
      const icon = iconFn ? iconFn(row) : row.icon;
      if (icon) option.dataset.icon = icon;
      el.appendChild(option);
    });

    extras.forEach(extra => {
      const option = document.createElement('option');
      option.value = extra.value;
      option.textContent = extra.label;
      el.appendChild(option);
    });

    if ([...el.options].some(o => o.value === current)) el.value = current;
  }

  function destroyDropdown(id) {
    if (dropdowns[id]) {
      try { dropdowns[id].destroy(); } catch (_) {}
      dropdowns[id] = null;
    }
  }

  function enhance(id, searchPlaceholder, virtualize=false, maxResults=null) {
    const el = q('#' + id);
    if (!el || !window.UniversalDropdown) return null;
    destroyDropdown(id);
    dropdowns[id] = window.UniversalDropdown.fromSelect(el, {
      search:true,
      searchPlaceholder,
      placeholder:el.options[0]?.textContent || t.choose,
      sort:false,
      deduplicate:true,
      removeEmpty:false,
      maxResults:maxResults !== null ? maxResults : (virtualize ? 0 : 20),
      debounce:80,
      virtualize,
      virtualThreshold:40
    });
    return dropdowns[id];
  }

  function enhanceAll() {
    enhance('bondsCountry', t.countrySearch, false, 0);
    enhance('bondsRegion', t.regionSearch);
    enhance('bondsLocality', t.localitySearch, true);
    enhance('bondsSector', t.sectorSearch, true);
    enhance('bondsActivity', t.activitySearch, true);
    enhance('bondsService', t.serviceSearch);
  }

  function localityLabel(row) {
    const types = t.localityTypes;
    const base = label(row);
    const type = row.locality_type && types[row.locality_type] ? types[row.locality_type] : '';
    return type ? base + ' — ' + type : base;
  }

  function activityLabel(row) {
    let suffix = '';
    const status = row.country?.availability_status;
    if (status === 'restricted') suffix = lang === 'ar' ? ' — مقيد' : ' — restricted';
    if (status === 'unavailable') suffix = lang === 'ar' ? ' — غير متاح' : ' — unavailable';
    if (status === 'unknown') suffix = lang === 'ar' ? ' — غير موثق' : ' — unverified';
    return label(row) + suffix;
  }

  async function loadCountries() {
    const data = await json(API + '/catalog/countries');
    state.countries = data.countries || [];
    setOptions(q('#bondsCountry'), state.countries, 'code', label, t.country, [], row => row.flag || null);
    const saved = localStorage.getItem('bonds_selected_country') || 'SA';
    if (state.countries.some(x => x.code === saved)) q('#bondsCountry').value = saved;
    enhance('bondsCountry', t.countrySearch, false, 0);
    await onCountry();
  }

  async function onCountry() {
    const country = q('#bondsCountry').value;
    if (!country) return;
    localStorage.setItem('bonds_selected_country', country);
    const [cityData, taxData] = await Promise.all([
      json(API + '/catalog/cities?country=' + encodeURIComponent(country)),
      json(API + '/investment-taxonomy?country=' + encodeURIComponent(country) + '&include=activities&depth=subsector')
    ]);
    state.cities = cityData.cities || [];
    state.sectors = taxData.sectors || [];
    state.activities = taxData.activities || [];

    const regions = [...new Map(
      state.cities.filter(x=>x.region).map(x => [x.region, { code:x.region, name_ar:x.region, name_en:x.region_en || x.region }])
    ).values()];

    setOptions(q('#bondsRegion'), regions, 'code', label, t.region, [{value:PROPOSE_REGION,label:t.addRegion}]);
    setOptions(q('#bondsLocality'), state.cities, 'code', localityLabel, t.locality, [{value:PROPOSE_LOCALITY,label:t.addLocality}]);
    setOptions(q('#bondsSector'), state.sectors, 'code', label, t.sector, [{value:PROPOSE_SECTOR,label:t.addSector}]);
    setOptions(q('#bondsActivity'), state.activities, 'code', activityLabel, t.activity, [{value:PROPOSE_ACTIVITY,label:t.addActivity}]);

    enhance('bondsRegion', t.regionSearch);
    enhance('bondsLocality', t.localitySearch, true);
    enhance('bondsSector', t.sectorSearch, true);
    enhance('bondsActivity', t.activitySearch, true);
    await loadServices();
  }

  function onRegion() {
    const region = q('#bondsRegion').value;
    if (region === PROPOSE_REGION) {
      openGeographyProposal('region');
      resetSelection('bondsRegion');
      return;
    }
    const rows = region ? state.cities.filter(x => x.region === region) : state.cities;
    setOptions(q('#bondsLocality'), rows, 'code', localityLabel, t.locality, [{value:PROPOSE_LOCALITY,label:t.addLocality}]);
    enhance('bondsLocality', t.localitySearch, true);
  }

  function onLocality() {
    if (q('#bondsLocality').value === PROPOSE_LOCALITY) {
      openGeographyProposal('locality');
      resetSelection('bondsLocality');
    }
  }

  async function onSector() {
    const sector = q('#bondsSector').value;
    if (sector === PROPOSE_SECTOR) {
      openProposal('sector');
      resetSelection('bondsSector');
      return;
    }

    const country = q('#bondsCountry').value;
    if (!sector) {
      setOptions(q('#bondsActivity'), state.activities, 'code', activityLabel, t.activity, [{value:PROPOSE_ACTIVITY,label:t.addActivity}]);
      enhance('bondsActivity', t.activitySearch, true);
      return loadServices();
    }

    const data = await json(API + '/investment-taxonomy?country=' + encodeURIComponent(country) +
      '&sector=' + encodeURIComponent(sector) + '&include=activities&depth=subsector');
    setOptions(q('#bondsActivity'), data.activities || [], 'code', activityLabel, t.activity, [{value:PROPOSE_ACTIVITY,label:t.addActivity}]);
    enhance('bondsActivity', t.activitySearch, true);
    await loadServices();
  }

  async function onActivity() {
    if (q('#bondsActivity').value === PROPOSE_ACTIVITY) {
      openProposal('activity');
      resetSelection('bondsActivity');
      return;
    }
    await loadServices();
  }

  async function loadServices() {
    const params = new URLSearchParams();
    const country=q('#bondsCountry').value, sector=q('#bondsSector').value, activity=q('#bondsActivity').value;
    if(country) params.set('country',country);
    if(sector && sector !== PROPOSE_SECTOR) params.set('sector',sector);
    if(activity && activity !== PROPOSE_ACTIVITY) params.set('activity',activity);
    const data = await json(API + '/services/catalog?' + params.toString());
    state.services = data.services || [];
    setOptions(q('#bondsService'), state.services, 'code', label, t.service, [{value:'custom_review',label:t.custom}]);
    enhance('bondsService', t.serviceSearch);
  }

  function resetSelection(id) {
    const el=q('#'+id);
    if (!el) return;
    el.value='';
    const dd=dropdowns[id];
    if (dd) dd.value='';
  }

  function ensureProposalModal() {
    let modal=q('#serviceDiscoveryProposalModal');
    if (modal) return modal;
    modal=document.createElement('div');
    modal.id='serviceDiscoveryProposalModal';
    modal.className='sd-proposal-modal';
    modal.hidden=true;
    modal.innerHTML=
      '<div class="sd-proposal-dialog" role="dialog" aria-modal="true" aria-labelledby="sdProposalTitle">' +
      '<button type="button" class="sd-proposal-close" aria-label="'+t.cancel+'">×</button>' +
      '<h3 id="sdProposalTitle"></h3><p class="sd-proposal-note">'+t.pending+'</p>' +
      '<form id="sdProposalForm"><input type="hidden" id="sdProposalType">' +
      '<label>'+t.arName+'<input id="sdProposalNameAr" required maxlength="160"></label>' +
      '<label id="sdProposalLocalityTypeWrap" hidden>'+t.localityType+'<select id="sdProposalLocalityType"></select></label>' +
      '<label>'+t.enName+'<input id="sdProposalNameEn" maxlength="160"></label>' +
      '<label>'+t.description+'<textarea id="sdProposalDescription" maxlength="1000" rows="3"></textarea></label>' +
      '<div class="sd-proposal-actions"><button type="button" class="sd-secondary" id="sdProposalCancel">'+t.cancel+'</button>' +
      '<button type="submit">'+t.send+'</button></div></form></div>';
    document.body.appendChild(modal);
    modal.querySelector('.sd-proposal-close').addEventListener('click', closeProposal);
    q('#sdProposalCancel').addEventListener('click', closeProposal);
    modal.addEventListener('click', e=>{ if(e.target===modal) closeProposal(); });
    q('#sdProposalForm').addEventListener('submit', submitProposal);
    const localityType = q('#sdProposalLocalityType');
    Object.entries(t.localityTypes).forEach(([value,label]) => {
      const option=document.createElement('option');
      option.value=value;
      option.textContent=label;
      localityType.appendChild(option);
    });
    return modal;
  }

  function openProposal(type) {
    const modal=ensureProposalModal();
    q('#sdProposalType').value=type;
    q('#sdProposalTitle').textContent=type==='sector' ? t.addSectorTitle : t.addActivityTitle;
    q('#sdProposalNameAr').value='';
    q('#sdProposalNameEn').value='';
    q('#sdProposalDescription').value='';
    q('#sdProposalLocalityTypeWrap').hidden=true;
    modal.hidden=false;
    setTimeout(()=>q('#sdProposalNameAr').focus(),0);
  }

  function openGeographyProposal(type) {
    const modal=ensureProposalModal();
    q('#sdProposalType').value='geo:' + type;
    q('#sdProposalTitle').textContent=type==='region' ? t.addRegionTitle : t.addLocalityTitle;
    q('#sdProposalNameAr').value='';
    q('#sdProposalNameEn').value='';
    q('#sdProposalDescription').value='';
    q('#sdProposalLocalityTypeWrap').hidden=type!=='locality';
    q('#sdProposalLocalityType').value='city';
    modal.hidden=false;
    setTimeout(()=>q('#sdProposalNameAr').focus(),0);
  }

  function closeProposal() {
    const modal=q('#serviceDiscoveryProposalModal');
    if(modal) modal.hidden=true;
  }

  async function submitProposal(e) {
    e.preventDefault();
    const sb=window.BondsAuth?.getSupabase?.();
    const user=(await window.BondsAuth?.getUser?.())?.data?.user;
    if(!sb || !user) {
      window.alert(t.login);
      const loginPath=lang==='en' ? '/en/calculators/auth/login.html' : '/calculators/auth/login.html';
      window.location.href=loginPath+'?redirect='+encodeURIComponent(window.location.pathname+window.location.search);
      return;
    }

    const type=q('#sdProposalType').value;
    let table='taxonomy_proposals';
    let row;
    if(type.startsWith('geo:')) {
      const proposalType=type.slice(4);
      table='geography_proposals';
      row={
        user_id:user.id,
        country_code:q('#bondsCountry').value || null,
        proposal_type:proposalType,
        locality_type:proposalType==='locality' ? q('#sdProposalLocalityType').value : null,
        parent_region:proposalType==='locality' ? (q('#bondsRegion').value || null) : null,
        status:'pending',
        proposed_name_ar:q('#sdProposalNameAr').value.trim(),
        proposed_name_en:q('#sdProposalNameEn').value.trim() || null,
        description:q('#sdProposalDescription').value.trim() || null,
        metadata:{source:'service_discovery',language:lang}
      };
    } else {
      row={
        user_id:user.id,
        country_code:q('#bondsCountry').value || null,
        proposal_type:type,
        status:'pending',
        proposed_name_ar:q('#sdProposalNameAr').value.trim(),
        proposed_name_en:q('#sdProposalNameEn').value.trim() || null,
        parent_sector_code:type==='activity' ? (q('#bondsSector').value || null) : null,
        description:q('#sdProposalDescription').value.trim() || null,
        metadata:{source:'service_discovery',language:lang}
      };
    }
    const {error}=await sb.from(table).insert(row);
    if(error) {
      console.error('[service discovery taxonomy proposal]',error);
      window.alert(t.failed);
      return;
    }
    closeProposal();
    window.alert(t.saved);
    track(type.startsWith('geo:') ? 'geography_proposal_submitted' : 'taxonomy_proposal_submitted',{proposal_type:type});
  }

  function start() {
    const serviceCode=q('#bondsService').value;
    if (!serviceCode) { dropdowns.bondsService?.open?.(); q('#bondsService').focus(); return; }
    track('service_started',{
      service_code:serviceCode,
      region:q('#bondsRegion').value || null,
      locality:q('#bondsLocality').value || null,
      sector_code:q('#bondsSector').value || null,
      activity_code:q('#bondsActivity').value || null
    });
    if (serviceCode === 'custom_review') {
      window.location.href = lang === 'en' ? '/en/contact.html?intent=custom-service' : '/contact.html?intent=custom-service';
      return;
    }
    const params=new URLSearchParams({
      country:q('#bondsCountry').value || '',
      region:q('#bondsRegion').value || '',
      region_name:selectedText(q('#bondsRegion')),
      locality:q('#bondsLocality').value || '',
      locality_name:selectedText(q('#bondsLocality')),
      sector:q('#bondsSector').value || '',
      activity:q('#bondsActivity').value || '',
      service:serviceCode
    });
    sessionStorage.setItem('bonds_service_intent', JSON.stringify({
      country_code:q('#bondsCountry').value || null,
      region_code:q('#bondsRegion').value || null,
      region_name:selectedText(q('#bondsRegion')),
      locality_code:q('#bondsLocality').value || null,
      locality_name:selectedText(q('#bondsLocality')),
      sector_code:q('#bondsSector').value || null,
      activity_code:q('#bondsActivity').value || null,
      service_code:serviceCode
    }));
    window.location.href=(lang==='en'?'/en/service-request.html':'/service-request.html')+'?'+params.toString();
  }

  function inject() {
    if (/^\/v3\/admin(?:\/|$)/.test(window.location.pathname)) return;
    if (document.querySelector('.bonds-service-discovery')) return;
    const header=document.querySelector('.main-header');
    if(!header) return;

    const wrap=document.createElement('section');
    wrap.className='bonds-service-discovery';
    wrap.setAttribute('aria-label',t.title);
    wrap.innerHTML=
      '<div class="bonds-service-discovery__inner"><strong class="bonds-service-discovery__title">'+t.title+'</strong>' +
      '<div class="bonds-service-discovery__grid">' +
      '<label><span>'+t.country+'</span><select id="bondsCountry"></select></label>' +
      '<label><span>'+t.region+'</span><select id="bondsRegion"></select></label>' +
      '<label><span>'+t.locality+'</span><select id="bondsLocality"></select></label>' +
      '<label><span>'+t.sector+'</span><select id="bondsSector"></select></label>' +
      '<label><span>'+t.activity+'</span><select id="bondsActivity"></select></label>' +
      '<label><span>'+t.service+'</span><select id="bondsService"></select></label>' +
      '<button type="button" id="bondsServiceStart">'+t.start+' ←</button></div></div>';

    header.insertAdjacentElement('afterend',wrap);
    q('#bondsCountry').addEventListener('change',onCountry);
    q('#bondsRegion').addEventListener('change',onRegion);
    q('#bondsLocality').addEventListener('change',onLocality);
    q('#bondsSector').addEventListener('change',onSector);
    q('#bondsActivity').addEventListener('change',onActivity);
    q('#bondsService').addEventListener('change',()=>track('service_selected',{
      service_code:q('#bondsService').value || null,
      sector_code:q('#bondsSector').value || null,
      activity_code:q('#bondsActivity').value || null
    }));
    q('#bondsServiceStart').addEventListener('click',start);

    track('service_viewed',{surface:'header_discovery'});
    loadCountries()
      .then(()=>{ enhanceAll(); })
      .catch(err => {
        if (err && err.status === 429) {
          console.warn('[service-discovery] rate limited; continuing in degraded mode');
        } else {
          console.error('[service-discovery]',err);
        }
        wrap.classList.add('is-degraded');
      });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,0));
  else setTimeout(inject,0);
})();