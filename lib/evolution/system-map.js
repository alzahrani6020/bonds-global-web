'use strict';

const fs=require('fs');
const path=require('path');

const DEFAULT_ROOT=path.resolve(__dirname,'../..');

const PROTECTED_SURFACES=Object.freeze([
  {
    id:'service-token-runtime',
    match:[
      /^services\/bonds_token_runtime\//,
      /^lib\/security\/service-token-/,
      /^tests\/(integration\/governed-token-runtime|security\/service-token-)/
    ]
  },
  {
    id:'authorization-and-rls',
    match:[
      /^v3\/lib\/admin-access\.js$/,
      /^lib\/capabilities\/governance-gateway\.js$/,
      /^supabase\/migrations\//,
      /^tests\/security\/.*rls.*\.test\.js$/,
      /^tests\/security\/admin-.*\.test\.js$/
    ]
  },
  {
    id:'financial-deterministic-engines',
    match:[
      /^lib\/financial\//,
      /^v3\/engine\/.*financial/i,
      /^tests\/(finance|calculators|api\/calculator-regressions)\//
    ]
  },
  {
    id:'payments-and-billing',
    match:[
      /^api\/payments\.js$/,
      /^v3\/api\/billing\.js$/,
      /^tests\/security\/(payment|pricing|pro-subscription|pro-payment)/,
      /^tests\/api\/funding-bank-transfer\.test\.js$/
    ]
  },
  {
    id:'evolution-governance',
    match:[
      /^docs\/BONDS_DUAL_CORE_INVARIANTS\.md$/,
      /^lib\/dual-core\//,
      /^lib\/learning\//,
      /^lib\/evolution\//
    ]
  }
]);

function normalizeRel(value){
  return String(value||'').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+|\/+$/g,'');
}

function walkFiles(root,relative=''){
  const full=path.join(root,relative);
  const entries=fs.readdirSync(full,{withFileTypes:true})
    .sort((a,b)=>a.name.localeCompare(b.name));
  const out=[];
  for(const entry of entries){
    const rel=normalizeRel(path.join(relative,entry.name));
    if(entry.isDirectory()){
      if(['.git','node_modules','.next','.vercel','coverage'].includes(entry.name))continue;
      out.push(...walkFiles(root,rel));
    }else if(entry.isFile()){
      out.push(rel);
    }
  }
  return out;
}

function safeJson(root,rel){
  try{
    return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8').replace(/^\uFEFF/,''));
  }catch(_err){
    return null;
  }
}

function buildSystemMap({root=DEFAULT_ROOT,baselineSha=null}={}){
  const files=walkFiles(root);
  const tools=safeJson(root,'data/tools-registry.json')||{};
  const generatedRegistry=require(path.join(root,'lib/capabilities/generated-service-registry.js'));

  const apiRoutes=files.filter(p=>/^(api|v3\/api)\/.*\.(js|mjs)$/.test(p));
  const tests=files.filter(p=>/^tests\/.*\.(test\.js|js)$/.test(p));
  const migrations=files.filter(p=>/^supabase\/migrations\/\d+.*\.sql$/.test(p));
  const serviceManifests=files.filter(p=>/^services\/manifests\/.*\.service\.json$/.test(p));

  const protectedFiles={};
  for(const surface of PROTECTED_SURFACES){
    protectedFiles[surface.id]=files.filter(file=>surface.match.some(re=>re.test(file)));
  }

  return {
    version:1,
    generated_at:null,
    baseline_sha:baselineSha||null,
    source:'repository_filesystem',
    deterministic:true,
    counts:{
      files:files.length,
      api_routes:apiRoutes.length,
      tests:tests.length,
      migrations:migrations.length,
      service_manifests:serviceManifests.length,
      registered_services:Object.keys(generatedRegistry.services||{}).length,
      registered_capabilities:Object.keys(generatedRegistry.capabilities||{}).length,
      tools:Array.isArray(tools.tools)?tools.tools.length:0
    },
    api_routes:apiRoutes,
    service_manifests:serviceManifests,
    services:Object.keys(generatedRegistry.services||{}).sort(),
    capabilities:Object.keys(generatedRegistry.capabilities||{}).sort(),
    tool_ids:(tools.tools||[]).map(x=>x.id).sort(),
    migrations,
    protected_surfaces:protectedFiles,
    test_inventory:tests,
    policy:{
      ai_inference:false,
      repository_source_of_truth:true,
      generated_values_are_deterministic:true,
      execution_authorized:false
    }
  };
}

function protectedSurfaceForFile(file){
  const rel=normalizeRel(file);
  return PROTECTED_SURFACES
    .filter(surface=>surface.match.some(re=>re.test(rel)))
    .map(surface=>surface.id);
}

module.exports={
  DEFAULT_ROOT,
  PROTECTED_SURFACES,
  normalizeRel,
  walkFiles,
  buildSystemMap,
  protectedSurfaceForFile
};
