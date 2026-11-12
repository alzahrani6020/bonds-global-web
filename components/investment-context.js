(function(){
'use strict';

const PATHS=[
  '/v3/opportunity-bank','/v3/investment-map','/v3/city-comparison','/v3/scenarios',
  '/v3/project-readiness','/valuation/','/my-bonds/workspace/','/en/my-bonds/workspace/'
];
const path=location.pathname;
if(!PATHS.some(p=>path===p||path===p+'.html'||path.startsWith(p)))return;

const EN=document.documentElement.lang==='en'||path.startsWith('/en/');
const tr=(ar,en)=>EN?en:ar;
const params=()=>new URLSearchParams(location.search);
const context=()=>({
  project_id:params().get('project_id')||null,
  deal_id:params().get('deal_id')||params().get('deal')||null,
  opportunity_id:params().get('opportunity_id')||null
});
const toolType=()=>{
  if(path.includes('opportunity-bank'))return 'opportunity_snapshot';
  if(path.includes('investment-map'))return 'investment_map';
  if(path.includes('city-comparison'))return 'city_comparison';
  if(path.includes('scenarios'))return 'scenario';
  if(path.includes('project-readiness'))return 'readiness';
  if(path.includes('/valuation'))return 'valuation';
  const service=params().get('service');
  if(service==='feasibility_studies')return 'feasibility';
  if(service==='risk_analysis')return 'risk';
  return null;
};

async function session(){
  try{
    await window.BondsAuth?.ensureEnv?.();
    return (await window.BondsAuth?.getSession?.())?.data?.session||null;
  }catch(_){return null}
}
async function api(url,opts={}){
  const current=await session();
  if(!current?.access_token)throw new Error('AUTHENTICATION_REQUIRED');
  const res=await fetch(url,{
    ...opts,
    credentials:'same-origin',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+current.access_token,...(opts.headers||{})}
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||('HTTP '+res.status));
  return data;
}

function withContext(href,extra={}){
  const url=new URL(href,location.origin);
  const ctx={...context(),...extra};
  ['project_id','deal_id','opportunity_id'].forEach(key=>{
    if(ctx[key])url.searchParams.set(key,ctx[key]);
  });
  return url.pathname+url.search+url.hash;
}

async function saveArtifact(input={}){
  const type=input.artifact_type||toolType();
  if(!type)throw new Error('ARTIFACT_TYPE_REQUIRED');
  const ctx=context();
  if(!ctx.project_id&&!ctx.deal_id&&!ctx.opportunity_id)throw new Error('INVESTMENT_CONTEXT_REQUIRED');
  const snapshot=input.results||window.BondsInvestmentArtifactSnapshot||{};
  return api('/api/v3/investment-context/artifacts',{
    method:'POST',
    body:JSON.stringify({
      ...ctx,
      artifact_type:type,
      title:input.title||document.title,
      source_url:location.href,
      inputs:input.inputs||Object.fromEntries(params().entries()),
      results:snapshot&&typeof snapshot==='object'?snapshot:{value:snapshot},
      metadata:input.metadata||{source:'investment-context-runtime'}
    })
  });
}

async function saveOpportunity(input={}){
  const ctx=context();
  const sourceType=path.includes('investment-map')?'investment_map':'opportunity_bank';
  const p=params();
  const controlValue=id=>document.getElementById(id)?.value||null;
  const selectedCountry=input.country_code||p.get('country')||controlValue('countrySelect');
  const selectedCity=input.city_code||p.get('city')||p.get('locality')||controlValue('citySelect');
  const selectedSector=input.sector_code||p.get('sector')||controlValue('sectorSelect');
  const selectedActivity=input.activity_code||p.get('activity')||controlValue('activitySelect');
  const sourceKey=input.source_key||[
    path,selectedCountry||'',selectedCity||'',selectedSector||'',selectedActivity||'',p.get('year')||''
  ].join('|');
  const data=await api('/api/v3/investment-context/opportunities',{
    method:'POST',
    body:JSON.stringify({
      ...ctx,
      source_type:input.source_type||sourceType,
      source_key:sourceKey,
      title:input.title||document.title,
      country_code:selectedCountry,
      city_code:selectedCity,
      sector_code:selectedSector,
      activity_code:selectedActivity,
      score:input.score,
      summary:input.summary,
      snapshot:input.snapshot||window.BondsInvestmentArtifactSnapshot||Object.fromEntries(p.entries()),
      metadata:input.metadata||{source_url:location.href}
    })
  });
  const id=data.opportunity?.id;
  if(id){
    const url=new URL(location.href);
    url.searchParams.set('opportunity_id',id);
    history.replaceState({},'',url);
  }
  return data;
}

async function convertOpportunity(){
  const ctx=context();
  if(!ctx.opportunity_id)throw new Error('OPPORTUNITY_NOT_SELECTED');
  const data=await api('/api/v3/investment-context/opportunities/'+encodeURIComponent(ctx.opportunity_id)+'/convert',{
    method:'POST',body:JSON.stringify({})
  });
  if(data.project?.id){
    const url=new URL(location.href);
    url.searchParams.set('project_id',data.project.id);
    history.replaceState({},'',url);
  }
  return data;
}

function propagateLinks(){
  const ctx=context();
  if(!ctx.project_id&&!ctx.deal_id&&!ctx.opportunity_id)return;
  document.querySelectorAll('a[href]').forEach(a=>{
    const raw=a.getAttribute('href')||'';
    if(!raw||raw.startsWith('#')||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('http'))return;
    let u;try{u=new URL(raw,location.origin)}catch(_){return}
    if(u.origin!==location.origin)return;
    const invest=PATHS.some(p=>u.pathname===p||u.pathname===p+'.html'||u.pathname.startsWith(p))||u.pathname.startsWith('/my-bonds/deals/');
    if(invest)a.setAttribute('href',withContext(raw));
  });
}

async function mount(){
  const current=await session();
  if(!current)return;
  const projects=await api('/api/v3/projects').catch(()=>({projects:[]}));
  const host=document.createElement('section');
  host.id='bondsInvestmentContextBar';
  host.style.cssText='max-width:1180px;margin:10px auto;padding:10px 14px;border:1px solid rgba(180,138,43,.28);border-radius:12px;background:#fff;color:#10213c;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font:600 13px/1.5 system-ui;position:relative;z-index:40';
  const label=document.createElement('strong');
  label.textContent=tr('سياق الاستثمار','Investment context');
  const select=document.createElement('select');
  select.id='bondsInvestmentProject';
  select.style.cssText='min-width:220px;padding:8px;border:1px solid #d5dbea;border-radius:8px;background:#fff;color:#10213c';
  select.innerHTML='<option value="">'+tr('اختر مشروعًا','Select a project')+'</option>'+
    (projects.projects||[]).map(p=>'<option value="'+String(p.id).replace(/"/g,'&quot;')+'">'+String(p.name||p.project_number||p.id).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))+'</option>').join('');
  if(context().project_id)select.value=context().project_id;
  select.addEventListener('change',()=>{
    const url=new URL(location.href);
    if(select.value)url.searchParams.set('project_id',select.value);else url.searchParams.delete('project_id');
    location.href=url.toString();
  });
  host.append(label,select);

  const status=document.createElement('span');
  status.style.cssText='opacity:.72';
  const setStatus=(value,error)=>{status.textContent=value||'';status.style.color=error?'#b42318':'#52647c'};

  const type=toolType();
  if(type&&type!=='readiness'&&type!=='valuation'&&type!=='feasibility'&&type!=='risk'){
    const save=document.createElement('button');
    save.type='button';
    save.textContent=path.includes('opportunity-bank')||path.includes('investment-map')?tr('حفظ كفرصة','Save opportunity'):tr('حفظ التحليل للمشروع','Save analysis to project');
    save.style.cssText='padding:8px 12px;border:0;border-radius:8px;background:#b48a2b;color:#fff;font-weight:800;cursor:pointer';
    save.addEventListener('click',async()=>{
      try{
        setStatus(tr('جاري الحفظ...','Saving...'));
        if(path.includes('opportunity-bank')||path.includes('investment-map'))await saveOpportunity();
        else await saveArtifact();
        setStatus(tr('تم الربط والحفظ','Saved and linked'));
      }catch(err){setStatus(err.message,true)}
    });
    host.appendChild(save);
  }

  if(context().opportunity_id&&!context().project_id){
    const convert=document.createElement('button');
    convert.type='button';
    convert.textContent=tr('تحويل إلى مشروع','Convert to project');
    convert.style.cssText='padding:8px 12px;border:1px solid #b48a2b;border-radius:8px;background:#fff;color:#8b691e;font-weight:800;cursor:pointer';
    convert.addEventListener('click',async()=>{
      try{setStatus(tr('جاري إنشاء المشروع...','Creating project...'));await convertOpportunity();location.reload()}
      catch(err){setStatus(err.message,true)}
    });
    host.appendChild(convert);
  }
  host.appendChild(status);

  const header=document.getElementById('site-header');
  if(header?.parentNode)header.parentNode.insertBefore(host,header.nextSibling);else document.body.prepend(host);
  propagateLinks();
  const observer=new MutationObserver(()=>propagateLinks());
  observer.observe(document.body,{subtree:true,childList:true});
}

window.BondsInvestmentContext=Object.freeze({context,withContext,saveArtifact,saveOpportunity,convertOpportunity,propagateLinks});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
})();