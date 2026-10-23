'use strict';

const { getInferenceRouter }=require('../ai/inference-router');
const { assertCandidateFresh }=require('./candidate-manager');
const { analyzeImpact }=require('./impact-analyzer');
const { normalizeRel }=require('./system-map');
const { STATES }=require('../dual-core/evolution-state-machine');

const CODE_PROVIDER_VERSION=1;
const MAX_SOURCE_FILES=8;
const DEFAULT_MAX_CONTEXT_CHARS=24000;
const ALLOWED_CANDIDATE_STATES=new Set([STATES.ENGINEERING,STATES.REPAIRING]);
const ALLOWED_OPERATIONS=new Set(['create','modify','delete']);
const FORBIDDEN_SOURCE_PATTERNS=[
  /(^|\/)\.env($|\.)/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)(credentials?|secrets?)(\.|\/|$)/i
];

function clean(value,max=500){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function safeRepoPath(value){
  const raw=String(value??'').trim();
  if(
    !raw ||
    raw.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(raw) ||
    /(^|[\\/])\.\.([\\/]|$)/.test(raw) ||
    raw.includes('\0')
  ){
    throw new Error('CODE_PROVIDER_PATH_INVALID');
  }
  const rel=normalizeRel(raw);
  if(!rel||rel.startsWith('..')||rel.includes('/../')){
    throw new Error('CODE_PROVIDER_PATH_INVALID');
  }
  return rel;
}

function sourcePathAllowed(rel){
  return !FORBIDDEN_SOURCE_PATTERNS.some(re=>re.test(rel));
}

function normalizeSourceFiles(files,{maxContextChars=DEFAULT_MAX_CONTEXT_CHARS}={}){
  const input=Array.isArray(files)?files:[];
  if(input.length>MAX_SOURCE_FILES)throw new Error('CODE_PROVIDER_SOURCE_FILE_LIMIT');
  const maxChars=Math.max(1000,Math.min(Number(maxContextChars)||DEFAULT_MAX_CONTEXT_CHARS,120000));
  let total=0;
  return input.map(file=>{
    if(!file||typeof file!=='object')throw new Error('CODE_PROVIDER_SOURCE_FILE_INVALID');
    const path=safeRepoPath(file.path);
    if(!sourcePathAllowed(path))throw new Error('CODE_PROVIDER_SOURCE_PATH_FORBIDDEN');
    const content=String(file.content??'');
    total+=content.length;
    if(total>maxChars)throw new Error('CODE_PROVIDER_CONTEXT_LIMIT');
    return {path,content};
  });
}

function buildPrompt({candidate,sourceFiles}){
  const target={
    proposal_id:candidate.target?.proposal_id||null,
    fingerprint:candidate.target?.fingerprint||null,
    problem_class:candidate.target?.problem_class||null,
    target_component:candidate.target?.target_component||null,
    recommended_path:candidate.target?.recommended_path||null
  };
  const impact={
    changed_files:candidate.impact?.changed_files||[],
    impacted_surfaces:candidate.impact?.impacted_surfaces||[],
    protected_surfaces:candidate.impact?.protected_surfaces||[],
    required_tests:candidate.impact?.required_tests||[],
    required_gates:candidate.impact?.required_gates||[]
  };

  const context=sourceFiles.map(file=>(
    'FILE: '+file.path+'\n---BEGIN FILE---\n'+file.content+'\n---END FILE---'
  )).join('\n\n');

  return [
    'You are BONDS CodeProvider operating inside an isolated candidate workspace.',
    'Return ONLY one valid JSON object. No markdown fences. No prose outside JSON.',
    'You are proposing code changes only. Do not execute anything.',
    'Do not emit shell commands, deployment commands, git commands, URLs to call, credentials, or secrets.',
    'Do not claim tests passed. Tests are run by deterministic CI outside this model.',
    'Required JSON shape:',
    '{"summary":"string","patches":[{"path":"repo/relative/path","operation":"create|modify|delete","unified_diff":"string"}],"tests":["tests/..."],"assumptions":["string"],"risk_notes":["string"]}',
    'For modify/create patches, unified_diff must describe the proposed repository change.',
    'For delete, unified_diff may be empty.',
    'Candidate target:',
    JSON.stringify(target),
    'Deterministic impact context:',
    JSON.stringify(impact),
    'Repository source context:',
    context||'(no source files supplied)'
  ].join('\n\n');
}

function extractNativeText(response){
  if(!response||response.ok!==true)throw new Error('CODE_PROVIDER_NATIVE_FAILED');
  if(response.external_llm_provider===true)throw new Error('CODE_PROVIDER_EXTERNAL_PROVIDER_FORBIDDEN');
  if(response.provider&&response.provider!=='BondsNativeProvider')throw new Error('CODE_PROVIDER_PROVIDER_INVALID');
  const envelope=response.result||{};
  const runtime=envelope.result||envelope;
  const text=runtime.text;
  if(typeof text!=='string'||!text.trim())throw new Error('CODE_PROVIDER_EMPTY_RESPONSE');
  return text.trim();
}

function parseStrictJson(text){
  const fence=String.fromCharCode(96).repeat(3);
  if(text.startsWith(fence)||text.endsWith(fence))throw new Error('CODE_PROVIDER_RESPONSE_NOT_STRICT_JSON');
  try{
    const parsed=JSON.parse(text);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('invalid');
    return parsed;
  }catch(_err){
    throw new Error('CODE_PROVIDER_RESPONSE_INVALID_JSON');
  }
}

function exactKeys(value,allowed,errorCode){
  for(const key of Object.keys(value||{})){
    if(!allowed.has(key))throw new Error(errorCode);
  }
}

function normalizeStringArray(value,maxItems=20,maxLength=500){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>maxItems)throw new Error('CODE_PROVIDER_ARRAY_INVALID');
  return value.map(item=>{
    const v=clean(item,maxLength);
    if(!v)throw new Error('CODE_PROVIDER_ARRAY_INVALID');
    return v;
  });
}

function validatePatchProposal(raw){
  exactKeys(raw,new Set(['summary','patches','tests','assumptions','risk_notes']),'CODE_PROVIDER_RESPONSE_FIELD_FORBIDDEN');
  const summary=clean(raw.summary,1000);
  if(!summary)throw new Error('CODE_PROVIDER_SUMMARY_REQUIRED');
  if(!Array.isArray(raw.patches)||raw.patches.length<1||raw.patches.length>20){
    throw new Error('CODE_PROVIDER_PATCHES_INVALID');
  }

  const seen=new Set();
  const patches=raw.patches.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('CODE_PROVIDER_PATCH_INVALID');
    exactKeys(item,new Set(['path','operation','unified_diff']),'CODE_PROVIDER_PATCH_FIELD_FORBIDDEN');
    const path=safeRepoPath(item.path);
    if(!sourcePathAllowed(path))throw new Error('CODE_PROVIDER_PATCH_PATH_FORBIDDEN');
    if(seen.has(path))throw new Error('CODE_PROVIDER_DUPLICATE_PATCH_PATH');
    seen.add(path);
    const operation=clean(item.operation,20);
    if(!ALLOWED_OPERATIONS.has(operation))throw new Error('CODE_PROVIDER_PATCH_OPERATION_INVALID');
    const unifiedDiff=String(item.unified_diff??'');
    if(operation!=='delete'&&!unifiedDiff.trim())throw new Error('CODE_PROVIDER_DIFF_REQUIRED');
    return {path,operation,unified_diff:unifiedDiff};
  });

  const tests=normalizeStringArray(raw.tests,30,300).map(test=>{
    const path=safeRepoPath(test);
    if(!/^tests\//.test(path))throw new Error('CODE_PROVIDER_TEST_PATH_INVALID');
    return path;
  });

  return {
    version:CODE_PROVIDER_VERSION,
    summary,
    patches,
    tests,
    assumptions:normalizeStringArray(raw.assumptions,20,500),
    risk_notes:normalizeStringArray(raw.risk_notes,20,500)
  };
}

class BondsNativeCodeProvider{
  constructor({router=null,routerOptions={}}={}){
    this.router=router||getInferenceRouter(routerOptions);
  }

  async propose({
    candidate,
    currentMainSha,
    sourceFiles=[],
    maxContextChars=DEFAULT_MAX_CONTEXT_CHARS
  }={}){
    if(!candidate||typeof candidate!=='object')throw new Error('CODE_PROVIDER_CANDIDATE_REQUIRED');
    if(!ALLOWED_CANDIDATE_STATES.has(candidate.state))throw new Error('CODE_PROVIDER_CANDIDATE_STATE_INVALID');

    const freshness=assertCandidateFresh(candidate,currentMainSha);
    if(!freshness.fresh)throw new Error('CODE_PROVIDER_CANDIDATE_STALE');

    const sources=normalizeSourceFiles(sourceFiles,{maxContextChars});
    const prompt=buildPrompt({candidate,sourceFiles:sources});
    const response=await this.router.generate(prompt,{
      temperature:0.1,
      context:{
        purpose:'bonds_code_provider',
        candidate_id:candidate.candidate_id,
        target_digest:candidate.target?.digest||null
      }
    });
    const proposal=validatePatchProposal(parseStrictJson(extractNativeText(response)));
    const impact=analyzeImpact({changedFiles:proposal.patches.map(p=>p.path)});

    return {
      version:CODE_PROVIDER_VERSION,
      provider:'BondsNativeProvider',
      candidate_id:candidate.candidate_id,
      base_sha:candidate.git?.base_sha||null,
      proposal,
      impact,
      inference:{
        mode:response.mode||null,
        external_llm_provider:false,
        native_node:response.meta?.native_node||null,
        latency_routing:response.meta?.latency_routing||null
      },
      policy:{
        proposal_only:true,
        patch_applied:false,
        shell_execution:false,
        free_text_execution:false,
        direct_file_write:false,
        execution_authorized:false,
        auto_merge:false,
        auto_deploy:false,
        deterministic_validation_required:true
      }
    };
  }
}

module.exports={
  CODE_PROVIDER_VERSION,
  MAX_SOURCE_FILES,
  DEFAULT_MAX_CONTEXT_CHARS,
  ALLOWED_CANDIDATE_STATES,
  ALLOWED_OPERATIONS,
  FORBIDDEN_SOURCE_PATTERNS,
  safeRepoPath,
  sourcePathAllowed,
  normalizeSourceFiles,
  buildPrompt,
  extractNativeText,
  parseStrictJson,
  validatePatchProposal,
  BondsNativeCodeProvider
};
