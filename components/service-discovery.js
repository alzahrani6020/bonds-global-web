(function () {
  'use strict';

  const API = '/api/v3';
  const state = { countries: [], cities: [], sectors: [], activities: [], services: [] };
  const lang = (document.documentElement.lang || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
  const t = {
    ar: { title:'اختر وجهتك وابدأ الآن', country:'الدولة', region:'المنطقة / المحافظة', locality:'الموقع', sector:'القطاع', activity:'النشاط', service:'الخدمة المطلوبة', start:'ابدأ الآن', choose:'اختر', loading:'جاري التحميل...', noServices:'لا توجد خدمات مطابقة؛ اختر خدمة مخصصة', custom:'خدمة مخصصة / مراجعة' },
    en: { title:'Choose your path and start', country:'Country', region:'Region', locality:'Location', sector:'Sector', activity:'Activity', service:'Required service', start:'Start now', choose:'Choose', loading:'Loading...', noServices:'No exact service match; request a custom review', custom:'Custom service / review' }
  }[lang];

  function label(row) { return lang === 'en' ? (row.name_en || row.name_ar || row.code) : (row.name_ar || row.name_en || row.code); }
  function track(event, properties={}) {
    fetch('/api/log-usage', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      keepalive:true,
      body:JSON.stringify({
        event,
        calculator:'service_discovery',
        country:q('#bondsCountry')?.value || null,
        lang,
        action:'service',
        properties,
        url:window.location.href
      })
    }).catch(()=>{});
  }

  async function json(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  function options(el, rows, valueKey, labelFn, first) {
    const current = el.value;
    el.innerHTML = '<option value="">' + (first || t.choose) + '</option>' + rows.map(row =>
      '<option value="' + String(row[valueKey] || '').replace(/"/g,'&quot;') + '">' + labelFn(row) + '</option>'
    ).join('');
    if ([...el.options].some(o => o.value === current)) el.value = current;
  }
  function selectedText(el) { return el.options[el.selectedIndex]?.text || ''; }

  async function loadCountries() {
    const data = await json(API + '/catalog/countries');
    state.countries = data.countries || [];
    options(q('#bondsCountry'), state.countries, 'code', label, t.country);
    const saved = localStorage.getItem('bonds_selected_country') || 'SA';
    if (state.countries.some(x => x.code === saved)) q('#bondsCountry').value = saved;
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
    const regions = [...new Map(state.cities.filter(x=>x.region).map(x => [x.region, { code:x.region, name_ar:x.region, name_en:x.region_en || x.region }])).values()];
    options(q('#bondsRegion'), regions, 'code', label, t.region);
    options(q('#bondsLocality'), state.cities, 'code', label, t.locality);
    options(q('#bondsSector'), state.sectors, 'code', label, t.sector);
    options(q('#bondsActivity'), state.activities, 'code', activityLabel, t.activity);
    await loadServices();
  }
  function activityLabel(row) {
    let suffix = '';
    const status = row.country?.availability_status;
    if (status === 'restricted') suffix = lang === 'ar' ? ' — مقيد' : ' — restricted';
    if (status === 'unavailable') suffix = lang === 'ar' ? ' — غير متاح' : ' — unavailable';
    if (status === 'unknown') suffix = lang === 'ar' ? ' — غير موثق' : ' — unverified';
    return label(row) + suffix;
  }
  function onRegion() {
    const region = q('#bondsRegion').value;
    const rows = region ? state.cities.filter(x => x.region === region) : state.cities;
    options(q('#bondsLocality'), rows, 'code', label, t.locality);
  }
  async function onSector() {
    const country = q('#bondsCountry').value;
    const sector = q('#bondsSector').value;
    if (!sector) {
      options(q('#bondsActivity'), state.activities, 'code', activityLabel, t.activity);
      return loadServices();
    }
    const data = await json(API + '/investment-taxonomy?country=' + encodeURIComponent(country) + '&sector=' + encodeURIComponent(sector) + '&include=activities&depth=subsector');
    options(q('#bondsActivity'), data.activities || [], 'code', activityLabel, t.activity);
    await loadServices();
  }
  async function loadServices() {
    const params = new URLSearchParams();
    const country=q('#bondsCountry').value, sector=q('#bondsSector').value, activity=q('#bondsActivity').value;
    if(country) params.set('country',country);
    if(sector) params.set('sector',sector);
    if(activity) params.set('activity',activity);
    const data = await json(API + '/services/catalog?' + params.toString());
    state.services = data.services || [];
    const select=q('#bondsService');
    options(select, state.services, 'code', label, t.service);
    const custom=document.createElement('option');
    custom.value='custom_review';
    custom.textContent=t.custom;
    select.appendChild(custom);
  }
  function start() {
    const serviceCode=q('#bondsService').value;
    if (!serviceCode) { q('#bondsService').focus(); return; }
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
    const service=state.services.find(x=>x.code===serviceCode);
    const params=new URLSearchParams({
      country:q('#bondsCountry').value || '',
      region:q('#bondsRegion').value || '',
      locality:q('#bondsLocality').value || '',
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
    const base=(lang==='en' ? service?.default_route_en : service?.default_route_ar) || (lang==='en'?'/en/services':'/services');
    window.location.href = base + (base.includes('?') ? '&' : '?') + params.toString();
  }
  function q(s){ return document.querySelector(s); }
  function inject() {
    if (/^\/v3\/admin(?:\/|$)/.test(window.location.pathname)) return;
    if (document.querySelector('.bonds-service-discovery')) return;
    const header=document.querySelector('.main-header');
    if(!header) return;
    const wrap=document.createElement('section');
    wrap.className='bonds-service-discovery';
    wrap.setAttribute('aria-label',t.title);
    wrap.innerHTML=`
      <div class="bonds-service-discovery__inner">
        <strong class="bonds-service-discovery__title">${t.title}</strong>
        <div class="bonds-service-discovery__grid">
          <label><span>${t.country}</span><select id="bondsCountry"></select></label>
          <label><span>${t.region}</span><select id="bondsRegion"></select></label>
          <label><span>${t.locality}</span><select id="bondsLocality"></select></label>
          <label><span>${t.sector}</span><select id="bondsSector"></select></label>
          <label><span>${t.activity}</span><select id="bondsActivity"></select></label>
          <label><span>${t.service}</span><select id="bondsService"></select></label>
          <button type="button" id="bondsServiceStart">${t.start} ←</button>
        </div>
      </div>`;
    header.insertAdjacentElement('afterend',wrap);
    q('#bondsCountry').addEventListener('change',onCountry);
    q('#bondsRegion').addEventListener('change',onRegion);
    q('#bondsSector').addEventListener('change',onSector);
    q('#bondsActivity').addEventListener('change',loadServices);
    q('#bondsService').addEventListener('change',()=>track('service_selected',{
      service_code:q('#bondsService').value || null,
      sector_code:q('#bondsSector').value || null,
      activity_code:q('#bondsActivity').value || null
    }));
    q('#bondsServiceStart').addEventListener('click',start);
    track('service_viewed',{surface:'header_discovery'});
    loadCountries().catch(err => { console.error('[service-discovery]',err); wrap.classList.add('is-degraded'); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,0));
  else setTimeout(inject,0);
})();