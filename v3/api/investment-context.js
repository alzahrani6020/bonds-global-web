'use strict';

const { LifecycleEngine } = require('../../lib/enterprise-lifecycle');
const { evaluateReadiness } = require('../../lib/investment-intelligence');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPPORTUNITY_SOURCES = new Set(['opportunity_bank','investment_map','direct','manual','imported']);
const ARTIFACT_TYPES = new Set([
  'opportunity_snapshot','investment_map','city_comparison','scenario',
  'feasibility','risk','valuation','readiness','direct_interest'
]);

function sendJson(res,status,body){
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(body));
}

function parseBody(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{
      raw+=chunk;
      if(raw.length>1048576){
        reject(new Error('REQUEST_BODY_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end',()=>{
      try{resolve(raw?JSON.parse(raw):{})}
      catch(_){reject(new Error('INVALID_JSON_BODY'))}
    });
    req.on('error',reject);
  });
}

function text(value,max=500){
  const out=String(value==null?'':value).replace(/\s+/g,' ').trim();
  return out?out.slice(0,max):null;
}

function object(value){
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}

function uuid(value){
  const v=text(value,64);
  return v&&UUID_RE.test(v)?v:null;
}

async function ownedProject(supabase,userId,projectId){
  if(!projectId)return null;
  const {data,error}=await supabase.from('bonds_projects')
    .select('id,name,sector,activity,currency,language')
    .eq('id',projectId).eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data||null;
}

async function ownedDeal(supabase,userId,dealId){
  if(!dealId)return null;
  const {data,error}=await supabase.from('bonds_deals')
    .select('id,project_id,title')
    .eq('id',dealId).eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data||null;
}

async function ownedOpportunity(supabase,userId,opportunityId){
  if(!opportunityId)return null;
  const {data,error}=await supabase.from('bonds_investment_opportunities')
    .select('*').eq('id',opportunityId).eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data||null;
}

async function assertContextOwnership(supabase,user,body){
  const projectId=uuid(body.project_id);
  const dealId=uuid(body.deal_id);
  const opportunityId=uuid(body.opportunity_id);
  let project=null,deal=null,opportunity=null;
  if(body.project_id&& !projectId) throw new Error('PROJECT_ID_INVALID');
  if(body.deal_id&& !dealId) throw new Error('DEAL_ID_INVALID');
  if(body.opportunity_id&& !opportunityId) throw new Error('OPPORTUNITY_ID_INVALID');

  if(projectId){
    project=await ownedProject(supabase,user.id,projectId);
    if(!project)throw new Error('PROJECT_NOT_FOUND');
  }
  if(dealId){
    deal=await ownedDeal(supabase,user.id,dealId);
    if(!deal)throw new Error('DEAL_NOT_FOUND');
  }
  if(opportunityId){
    opportunity=await ownedOpportunity(supabase,user.id,opportunityId);
    if(!opportunity)throw new Error('OPPORTUNITY_NOT_FOUND');
  }

  const canonicalProjectId=projectId||deal?.project_id||opportunity?.project_id||null;
  if(projectId&&deal?.project_id&&deal.project_id!==projectId)throw new Error('CONTEXT_PROJECT_DEAL_MISMATCH');
  if(projectId&&opportunity?.project_id&&opportunity.project_id!==projectId)throw new Error('CONTEXT_PROJECT_OPPORTUNITY_MISMATCH');
  if(dealId&&opportunity?.deal_id&&opportunity.deal_id!==dealId)throw new Error('CONTEXT_DEAL_OPPORTUNITY_MISMATCH');
  if(deal?.project_id&&opportunity?.project_id&&deal.project_id!==opportunity.project_id)throw new Error('CONTEXT_DEAL_OPPORTUNITY_PROJECT_MISMATCH');

  return {projectId:canonicalProjectId,dealId,opportunityId,project,deal,opportunity};
}

async function listOpportunities(req,res,supabase,user){
  if(!user)return sendJson(res,401,{error:'Unauthorized'});
  const url=new URL(req.url,'http://localhost');
  let query=supabase.from('bonds_investment_opportunities').select('*')
    .eq('user_id',user.id).order('updated_at',{ascending:false}).limit(200);
  const projectId=uuid(url.searchParams.get('project_id'));
  if(projectId)query=query.eq('project_id',projectId);
  const {data,error}=await query;
  if(error)return sendJson(res,503,{error:'INVESTMENT_OPPORTUNITIES_READ_FAILED'});
  return sendJson(res,200,{opportunities:data||[]});
}

async function createOpportunity(req,res,supabase,user){
  if(!user)return sendJson(res,401,{error:'Unauthorized'});
  let body;
  try{body=await parseBody(req)}catch(err){return sendJson(res,400,{error:err.message})}
  const title=text(body.title,300);
  if(!title)return sendJson(res,422,{error:'OPPORTUNITY_TITLE_REQUIRED'});
  const sourceType=text(body.source_type,40)||'manual';
  if(!OPPORTUNITY_SOURCES.has(sourceType))return sendJson(res,422,{error:'OPPORTUNITY_SOURCE_INVALID'});
  let context;
  try{context=await assertContextOwnership(supabase,user,body)}
  catch(err){return sendJson(res,422,{error:err.message})}
  const score=body.score==null||body.score===''?null:Number(body.score);
  if(score!=null&&(!Number.isFinite(score)||score<0||score>100))return sendJson(res,422,{error:'OPPORTUNITY_SCORE_INVALID'});
  const row={
    user_id:user.id,
    project_id:context.projectId,
    deal_id:context.dealId,
    source_type:sourceType,
    source_key:text(body.source_key,240),
    title,
    country_code:text(body.country_code,8)?.toUpperCase()||null,
    city_code:text(body.city_code,80),
    sector_code:text(body.sector_code,160),
    activity_code:text(body.activity_code,160),
    score,
    status:'saved',
    summary:text(body.summary,4000),
    snapshot:object(body.snapshot),
    metadata:object(body.metadata)
  };
  let query=supabase.from('bonds_investment_opportunities').insert(row).select().single();
  if(row.source_key){
    const existing=await supabase.from('bonds_investment_opportunities').select('id')
      .eq('user_id',user.id).eq('source_type',sourceType).eq('source_key',row.source_key).maybeSingle();
    if(existing.data){
      const {data,error}=await supabase.from('bonds_investment_opportunities')
        .update({...row,updated_at:new Date().toISOString()}).eq('id',existing.data.id).eq('user_id',user.id).select().single();
      if(error)return sendJson(res,503,{error:'INVESTMENT_OPPORTUNITY_SAVE_FAILED'});
      return sendJson(res,200,{opportunity:data,reused:true});
    }
  }
  const {data,error}=await query;
  if(error)return sendJson(res,503,{error:'INVESTMENT_OPPORTUNITY_SAVE_FAILED'});
  return sendJson(res,201,{opportunity:data,reused:false});
}

async function convertOpportunity(req,res,supabase,user,opportunityId){
  if(!user)return sendJson(res,401,{error:'Unauthorized'});
  const opportunity=await ownedOpportunity(supabase,user.id,opportunityId);
  if(!opportunity)return sendJson(res,404,{error:'OPPORTUNITY_NOT_FOUND'});
  if(opportunity.project_id){
    const project=await ownedProject(supabase,user.id,opportunity.project_id);
    if (project && opportunity.deal_id) {
      const deal=await ownedDeal(supabase,user.id,opportunity.deal_id);
      if (deal && !deal.project_id) {
        await supabase.from('bonds_deals').update({project_id:project.id}).eq('id',deal.id).eq('user_id',user.id);
      } else if (deal?.project_id && deal.project_id !== project.id) {
        return sendJson(res,409,{error:'CONTEXT_DEAL_OPPORTUNITY_PROJECT_MISMATCH'});
      }
    }
    return sendJson(res,200,{opportunity,project,reused:true});
  }
  let body={};
  try{body=await parseBody(req)}catch(err){return sendJson(res,400,{error:err.message})}
  const sector=text(body.sector||opportunity.sector_code||opportunity.snapshot?.sector||opportunity.snapshot?.sector_code,160);
  if(!sector)return sendJson(res,422,{error:'PROJECT_SECTOR_REQUIRED'});

  let cityId=null;
  let geoPlaceId=null;
  let geoSnapshot={};
  if(opportunity.city_code){
    const {data:city}=await supabase.from('cities')
      .select('id,code,country_code,name_ar,name_en,geo_place_id,region')
      .eq('code',opportunity.city_code).maybeSingle();
    cityId=city?.id||null;
    geoPlaceId=city?.geo_place_id||null;
    if(city){
      geoSnapshot={
        city_code:city.code,
        country_code:city.country_code,
        name_ar:city.name_ar,
        name_en:city.name_en,
        region:city.region||null,
        source:'investment_opportunity'
      };
    }
  }
  const row={
    project_number:'PRJ-'+Date.now()+'-'+Math.floor(Math.random()*10000),
    user_id:user.id,
    name:text(body.name||opportunity.title,240),
    sector,
    activity:text(body.activity||opportunity.activity_code||sector,160),
    city_id:cityId,
    geo_place_id:geoPlaceId,
    geo_snapshot:geoSnapshot,
    currency:(text(body.currency,3)||'SAR').toUpperCase(),
    capital:Number.isFinite(Number(body.capital))?Number(body.capital):0,
    revenue:Number.isFinite(Number(body.revenue))?Number(body.revenue):0,
    annual_profit:Number.isFinite(Number(body.annual_profit))?Number(body.annual_profit):0,
    language:text(body.language,4)||'ar',
    status:'active',
    metadata:{
      investment_opportunity_id:opportunity.id,
      opportunity_source:opportunity.source_type,
      opportunity_snapshot:opportunity.snapshot||{}
    }
  };
  const {data:project,error}=await supabase.from('bonds_projects').insert(row).select().single();
  if(error)return sendJson(res,503,{error:'PROJECT_CREATE_FAILED'});
  await supabase.from('bonds_investment_opportunities')
    .update({project_id:project.id,status:'converted'}).eq('id',opportunity.id).eq('user_id',user.id);

  let lifecycleInstanceId=null;
  try{
    const engine=await new LifecycleEngine({supabase}).initialize();
    const created=await engine.createInstance({entityType:'project',entityId:project.id,userId:user.id});
    lifecycleInstanceId=created?.instance?.id||created?.instance?.instance_id||null;
  }catch(err){
    console.warn('[investment-context] lifecycle init failed:',err.message);
  }
  if(opportunity.deal_id){
    const deal=await ownedDeal(supabase,user.id,opportunity.deal_id);
    if(deal){
      await supabase.from('bonds_deals').update({
        project_id:project.id,
        ...(lifecycleInstanceId?{lifecycle_instance_id:lifecycleInstanceId}:{})
      }).eq('id',deal.id).eq('user_id',user.id);
    }
  }
  return sendJson(res,201,{opportunity:{...opportunity,project_id:project.id,status:'converted'},project,lifecycle_instance_id:lifecycleInstanceId,reused:false});
}

async function saveArtifact(req,res,supabase,user){
  if(!user)return sendJson(res,401,{error:'Unauthorized'});
  let body;
  try{body=await parseBody(req)}catch(err){return sendJson(res,400,{error:err.message})}
  const artifactType=text(body.artifact_type,60);
  if(!ARTIFACT_TYPES.has(artifactType))return sendJson(res,422,{error:'ARTIFACT_TYPE_INVALID'});
  let context;
  try{context=await assertContextOwnership(supabase,user,body)}
  catch(err){return sendJson(res,422,{error:err.message})}
  if(!context.projectId&&!context.dealId&&!context.opportunityId)return sendJson(res,422,{error:'INVESTMENT_CONTEXT_REQUIRED'});
  const row={
    user_id:user.id,
    opportunity_id:context.opportunityId,
    project_id:context.projectId,
    deal_id:context.dealId,
    artifact_type:artifactType,
    title:text(body.title,300),
    source_url:text(body.source_url,1000),
    inputs:object(body.inputs),
    results:object(body.results),
    metadata:object(body.metadata),
    status:['draft','saved','approved','archived'].includes(body.status)?body.status:'saved'
  };
  const {data,error}=await supabase.from('bonds_investment_artifacts').insert(row).select().single();
  if(error)return sendJson(res,503,{error:'INVESTMENT_ARTIFACT_SAVE_FAILED'});
  return sendJson(res,201,{artifact:data});
}

async function listArtifacts(req,res,supabase,user){
  if(!user)return sendJson(res,401,{error:'Unauthorized'});
  const url=new URL(req.url,'http://localhost');
  const projectId=uuid(url.searchParams.get('project_id'));
  const opportunityId=uuid(url.searchParams.get('opportunity_id'));
  const dealId=uuid(url.searchParams.get('deal_id'));
  let query=supabase.from('bonds_investment_artifacts').select('*').eq('user_id',user.id)
    .order('updated_at',{ascending:false}).limit(300);
  if(projectId)query=query.eq('project_id',projectId);
  if(opportunityId)query=query.eq('opportunity_id',opportunityId);
  if(dealId)query=query.eq('deal_id',dealId);
  const {data,error}=await query;
  if(error)return sendJson(res,503,{error:'INVESTMENT_ARTIFACTS_READ_FAILED'});
  return sendJson(res,200,{artifacts:data||[]});
}

async function saveReadiness(req,res,supabase,user){
  if(!user)return sendJson(res,401,{error:'Unauthorized'});
  let body;
  try{body=await parseBody(req)}catch(err){return sendJson(res,400,{error:err.message})}
  const projectId=uuid(body.project_id);
  if(!projectId)return sendJson(res,422,{error:'PROJECT_ID_REQUIRED'});
  const project=await ownedProject(supabase,user.id,projectId);
  if(!project)return sendJson(res,404,{error:'PROJECT_NOT_FOUND'});
  const score=Number(body.readiness_score);
  if(!Number.isFinite(score)||score<0||score>100)return sendJson(res,422,{error:'READINESS_SCORE_INVALID'});
  const grade=score>=90?'A':score>=80?'B':score>=70?'C':score>=50?'D':'E';
  const missingItems=Array.isArray(body.missing_items)?body.missing_items:[];
  const {error:artifactError}=await supabase.from('bonds_investment_artifacts').insert({
    user_id:user.id,project_id:projectId,artifact_type:'readiness',
    title:'Investment readiness self-assessment',source_url:text(body.source_url,1000),
    inputs:object(body.inputs),
    results:{
      readiness_score:score,grade,missing_items:missingItems,
      strengths:Array.isArray(body.strengths)?body.strengths:[],
      weaknesses:Array.isArray(body.weaknesses)?body.weaknesses:[],
      action_plan:Array.isArray(body.action_plan)?body.action_plan:[]
    },
    metadata:{...object(body.metadata),assessment:'self_reported'},status:'saved'
  });
  if(artifactError)return sendJson(res,503,{error:'READINESS_SAVE_FAILED'});

  // The lifecycle gate reads investment_readiness_scores, so only the institutional
  // engine may write it; the self-assessment above stays advisory.
  let readiness=null;
  try{
    const result=await evaluateReadiness({projectId,supabase});
    const {data}=await supabase.from('investment_readiness_scores').insert({
      project_id:projectId,user_id:user.id,
      readiness_score:result.output.readinessScore,grade:result.output.grade,
      strengths:result.output.strengths,weaknesses:result.output.weaknesses,
      missing_items:result.output.missingItems,action_plan:result.output.actionPlan
    }).select().single();
    readiness=data||null;
  }catch(err){
    console.warn('[investment-context/readiness] institutional evaluation skipped:',err.message);
  }
  return sendJson(res,201,{readiness,self_assessment:{readiness_score:score,grade}});
}

async function createDirectInterest(req,res,supabase){
  let body;
  try{body=await parseBody(req)}catch(err){return sendJson(res,400,{error:err.message})}
  if(text(body.website,200))return sendJson(res,200,{success:true});
  const name=text(body.name,200),phone=text(body.phone,80);
  if(!name||!phone)return sendJson(res,422,{error:'NAME_AND_PHONE_REQUIRED'});
  const row={
    name,phone,email:text(body.email,320),city:text(body.city,160),
    amount_band:text(body.amount,80),investor_type:text(body.investorType,80),
    message:text(body.message,4000),source:'investment-opportunities-page',
    metadata:{user_agent:text(req.headers?.['user-agent'],500)}
  };
  const {data,error}=await supabase.from('bonds_investment_interest_leads').insert(row).select('id,status,created_at').single();
  if(error)return sendJson(res,503,{error:'INVESTMENT_INTEREST_SAVE_FAILED'});
  return sendJson(res,201,{success:true,lead:data});
}

async function investmentContextRouter(req,res,path,supabase,user){
  if(path==='/investment-context/opportunities'&&req.method==='GET')return listOpportunities(req,res,supabase,user);
  if(path==='/investment-context/opportunities'&&req.method==='POST')return createOpportunity(req,res,supabase,user);
  const convert=path.match(/^\/investment-context\/opportunities\/([^/]+)\/convert$/);
  if(convert&&req.method==='POST')return convertOpportunity(req,res,supabase,user,convert[1]);
  if(path==='/investment-context/artifacts'&&req.method==='GET')return listArtifacts(req,res,supabase,user);
  if(path==='/investment-context/artifacts'&&req.method==='POST')return saveArtifact(req,res,supabase,user);
  if(path==='/investment-context/readiness'&&req.method==='POST')return saveReadiness(req,res,supabase,user);
  if(path==='/investment-context/direct-interest'&&req.method==='POST')return createDirectInterest(req,res,supabase);
  return sendJson(res,404,{error:'INVESTMENT_CONTEXT_ENDPOINT_NOT_FOUND'});
}

module.exports={investmentContextRouter,assertContextOwnership};
