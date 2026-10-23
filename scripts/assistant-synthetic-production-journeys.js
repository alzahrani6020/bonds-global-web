'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const navigation = require('../lib/assistant/navigation-registry.json');
const forms = require('../lib/assistant/form-registry.json');

const cfg = {
  baseUrl:(process.env.PRODUCTION_URL || 'https://bonds-global.com').replace(/\/$/,''),
  supabaseUrl:process.env.SUPABASE_URL,
  supabaseAnonKey:process.env.SUPABASE_ANON_KEY,
  email:process.env.E2E_ADMIN_EMAIL,
  password:process.env.E2E_ADMIN_PASSWORD,
  totpSecret:process.env.E2E_ADMIN_TOTP_SECRET || '',
  expectedSha:process.env.GITHUB_SHA
};

function requireEnv(name,value){ if(!value) throw new Error(`Missing required environment variable: ${name}`); }
function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }

function decodeBase32(input){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean=String(input||'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits='';
  for(const ch of clean){
    const index=alphabet.indexOf(ch);
    if(index<0) throw new Error('Invalid TOTP secret');
    bits += index.toString(2).padStart(5,'0');
  }
  const bytes=[];
  for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  return Buffer.from(bytes);
}

function generateTotp(secret, now=Date.now()){
  const key=decodeBase32(secret);
  const counter=Math.floor(now/1000/30);
  const buffer=Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest=crypto.createHmac('sha1',key).update(buffer).digest();
  const offset=digest[digest.length-1]&0x0f;
  const binary=((digest[offset]&0x7f)<<24)|((digest[offset+1]&0xff)<<16)|((digest[offset+2]&0xff)<<8)|(digest[offset+3]&0xff);
  return String(binary%1000000).padStart(6,'0');
}

function resolveSupabaseUrl(){
  if(cfg.supabaseUrl){
    try{
      const parsed=new URL(cfg.supabaseUrl);
      if(['http:','https:'].includes(parsed.protocol)) return parsed.origin;
    }catch{}
  }
  requireEnv('SUPABASE_ANON_KEY',cfg.supabaseAnonKey);
  const parts=String(cfg.supabaseAnonKey).split('.');
  if(parts.length===3){
    try{
      const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
      if(payload?.ref && /^[a-z0-9]+$/i.test(payload.ref)) return `https://${payload.ref}.supabase.co`;
    }catch{}
  }
  throw new Error('Unable to resolve Supabase project URL');
}

async function getAuthenticatedToken(){
  for(const [name,value] of [
    ['SUPABASE_ANON_KEY',cfg.supabaseAnonKey],
    ['E2E_ADMIN_EMAIL',cfg.email],
    ['E2E_ADMIN_PASSWORD',cfg.password]
  ]) requireEnv(name,value);

  const supabase=createClient(resolveSupabaseUrl(),cfg.supabaseAnonKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  const { error:signInError }=await supabase.auth.signInWithPassword({email:cfg.email,password:cfg.password});
  if(signInError) throw new Error(`Synthetic journey sign-in failed: ${signInError.message}`);

  const { data:aalData,error:aalError }=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aalError) throw new Error(`Unable to determine MFA assurance level: ${aalError.message}`);
  if(aalData?.currentLevel!=='aal2' && aalData?.nextLevel==='aal2'){
    requireEnv('E2E_ADMIN_TOTP_SECRET',cfg.totpSecret);
    const { data:factorsData,error:factorsError }=await supabase.auth.mfa.listFactors();
    if(factorsError) throw new Error(`Unable to list MFA factors: ${factorsError.message}`);
    const factor=(factorsData?.totp||[]).find(item=>item.status==='verified');
    if(!factor) throw new Error('No verified TOTP factor found for synthetic journey account');
    const { error:verifyError }=await supabase.auth.mfa.challengeAndVerify({
      factorId:factor.id,code:generateTotp(cfg.totpSecret)
    });
    if(verifyError) throw new Error(`Synthetic journey MFA failed: ${verifyError.message}`);
  }
  const { data:sessionData,error:sessionError }=await supabase.auth.getSession();
  if(sessionError || !sessionData?.session?.access_token) throw new Error('Synthetic journey session token missing');
  return sessionData.session.access_token;
}

function check(condition,label){ if(!condition) throw new Error(`Synthetic journey failed: ${label}`); }

async function runSyntheticProductionJourneys({
  baseUrl=cfg.baseUrl,
  token,
  expectedSha=cfg.expectedSha,
  fetchImpl=global.fetch,
  sleepImpl=sleep,
  log=console.log
}={}){
  requireEnv('GITHUB_SHA',expectedSha);
  check(/^[0-9a-f]{40}$/i.test(expectedSha),'exact release SHA required');
  requireEnv('authenticated token',token);

  const marker=`assistant-journey-${expectedSha.slice(0,12)}-${crypto.randomUUID()}`;
  const origin=new URL(baseUrl);
  const evidence=[];

  async function request(path,{method='GET',body}={}){
    const headers={
      Authorization:`Bearer ${token}`,
      'Cache-Control':'no-cache',
      'X-Request-ID':marker
    };
    if(body!==undefined) headers['Content-Type']='application/json';

    for(let attempt=1;attempt<=2;attempt++){
      const res=await fetchImpl(`${origin.origin}${path}`,{
        method,headers,
        body:body===undefined?undefined:JSON.stringify(body),
        redirect:'error',
        signal:AbortSignal.timeout(20000)
      });
      if(res.status===429 && attempt===1){
        const retryAfter=Number(res.headers.get('retry-after'));
        await sleepImpl(Number.isFinite(retryAfter)?Math.max(0,Math.min(65000,retryAfter*1000)):1000);
        continue;
      }
      const text=await res.text();
      let data=null;
      try{ data=text?JSON.parse(text):null; }catch{ throw new Error(`Invalid JSON from ${path}`); }
      return {status:res.status,data};
    }
    throw new Error(`Request retries exhausted: ${path}`);
  }

  async function journey(name,fn){
    const started=Date.now();
    await fn();
    const duration_ms=Date.now()-started;
    evidence.push({name,status:'pass',duration_ms});
    log(`Synthetic journey PASS: ${name} (${duration_ms}ms)`);
  }

  await journey('homepage_page_authority_clears_stale_service',async()=>{
    const result=await request('/api/v3/ai/chat',{
      method:'POST',
      body:{
        messages:[{role:'user',content:'ما الخدمة الحالية؟'}],
        context:{pagePath:'/',serviceCode:'stale-session-service',serviceName:'stale'},
        options:{max_tokens:8}
      }
    });
    check(result.status===200,'homepage context HTTP 200');
    check(result.data?.source==='bonds-chat-orchestrator','homepage handled by chat orchestrator');
    check(result.data?.context?.state==='homepage/no_service_selected','homepage official context state');
    check(result.data?.context?.authority==='page','homepage page authority');
    check(result.data?.context?.serviceCode==null,'stale session service cleared');
  });

  await journey('bilingual_registered_navigation',async()=>{
    for(const language of ['ar','en']){
      const result=await request('/api/v3/assistant/plan',{
        method:'POST',
        body:{type:'site_navigate',target:'kyc',language}
      });
      check(result.status===200,`navigation ${language} HTTP 200`);
      check(result.data?.status==='ready',`navigation ${language} ready`);
      check(result.data?.actions?.[0]?.type==='site_navigate',`navigation ${language} action type`);
      check(result.data?.actions?.[0]?.target==='kyc',`navigation ${language} target`);
      check(result.data?.context?.navigation?.route===navigation.destinations.kyc.routes[language],
        `navigation ${language} registered route`);
    }
  });

  await journey('registered_form_load_is_plan_only',async()=>{
    const result=await request('/api/v3/assistant/plan',{
      method:'POST',
      body:{type:'form_load',form:'kyc',language:'en'}
    });
    check(result.status===200,'form load HTTP 200');
    check(result.data?.status==='ready','form load ready');
    check(result.data?.actions?.[0]?.type==='form_load','form load action type');
    check(result.data?.actions?.[0]?.target==='kyc','form load registered target');
    check(result.data?.actions?.[0]?.requires_confirmation===false,'form load no confirmation');
    check(result.data?.context?.form?.navigation_target===forms.forms.kyc.navigation_target,
      'form load registry binding');
    check(result.data?.context?.navigation?.route===navigation.destinations.kyc.routes.en,
      'form load English route');
  });

  await journey('unregistered_target_fails_closed',async()=>{
    const result=await request('/api/v3/assistant/plan',{
      method:'POST',
      body:{type:'site_navigate',target:'synthetic-unregistered-target',language:'ar'}
    });
    check(result.status===422,'unregistered navigation HTTP 422');
    check(result.data?.status==='denied','unregistered navigation denied');
    check(result.data?.context?.code==='NAVIGATION_TARGET_NOT_REGISTERED','unregistered navigation code');
    check(Array.isArray(result.data?.actions) && result.data.actions.length===0,'unregistered navigation has no action');
  });

  log(`Synthetic production journeys PASS (marker=${marker}, journeys=${evidence.length})`);
  return {marker,expectedSha,journeys:evidence};
}

async function main(){
  console.log('Starting Assistant synthetic production journeys');
  const token=await getAuthenticatedToken();
  await runSyntheticProductionJourneys({token});
}

if(require.main===module){
  main().catch(error=>{
    console.error(`Assistant synthetic production journeys: FAIL - ${error.message}`);
    process.exit(1);
  });
}

module.exports={runSyntheticProductionJourneys,generateTotp};
