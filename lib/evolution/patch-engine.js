'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const { assertCandidateFresh }=require('./candidate-manager');
const { validatePatchProposal, safeRepoPath, sourcePathAllowed }=require('./code-provider');
const { analyzeImpact }=require('./impact-analyzer');
const { STATES }=require('../dual-core/evolution-state-machine');

const PATCH_ENGINE_VERSION=1;
const ALLOWED_STATES=new Set([STATES.ENGINEERING,STATES.REPAIRING]);

function sha256(value){
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assertWorkspace(candidate,workspaceRoot){
  if(!candidate||typeof candidate!=='object')throw new Error('PATCH_ENGINE_CANDIDATE_REQUIRED');
  if(!ALLOWED_STATES.has(candidate.state))throw new Error('PATCH_ENGINE_CANDIDATE_STATE_INVALID');
  if(candidate.workspace?.isolated!==true||candidate.workspace?.dirty_repo_reuse!==false){
    throw new Error('PATCH_ENGINE_WORKSPACE_POLICY_INVALID');
  }

  const raw=String(workspaceRoot||'').trim();
  if(!raw||!path.isAbsolute(raw))throw new Error('PATCH_ENGINE_WORKSPACE_ROOT_INVALID');
  const stat=fs.lstatSync(raw);
  if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('PATCH_ENGINE_WORKSPACE_ROOT_INVALID');
  const real=fs.realpathSync(raw);
  if(path.basename(real)!==candidate.candidate_id)throw new Error('PATCH_ENGINE_WORKSPACE_CANDIDATE_MISMATCH');
  return real;
}

function withinRoot(root,target){
  const rel=path.relative(root,target);
  return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);
}

function assertExistingAncestorsSafe(root,target){
  let current=path.dirname(target);
  const ancestors=[];
  while(current!==root){
    if(!withinRoot(root,current))throw new Error('PATCH_ENGINE_PATH_ESCAPE');
    ancestors.push(current);
    current=path.dirname(current);
  }
  for(const dir of ancestors.reverse()){
    if(!fs.existsSync(dir))throw new Error('PATCH_ENGINE_PARENT_MISSING');
    const st=fs.lstatSync(dir);
    if(st.isSymbolicLink()||!st.isDirectory())throw new Error('PATCH_ENGINE_PARENT_UNSAFE');
    const real=fs.realpathSync(dir);
    if(real!==root&&!withinRoot(root,real))throw new Error('PATCH_ENGINE_PATH_ESCAPE');
  }
}

function resolveTarget(root,repoPath){
  const rel=safeRepoPath(repoPath);
  if(!sourcePathAllowed(rel))throw new Error('PATCH_ENGINE_PATH_FORBIDDEN');
  const target=path.resolve(root,...rel.split('/'));
  if(!withinRoot(root,target))throw new Error('PATCH_ENGINE_PATH_ESCAPE');
  assertExistingAncestorsSafe(root,target);
  if(fs.existsSync(target)){
    const st=fs.lstatSync(target);
    if(st.isSymbolicLink())throw new Error('PATCH_ENGINE_SYMLINK_FORBIDDEN');
    if(!st.isFile())throw new Error('PATCH_ENGINE_TARGET_NOT_FILE');
    const real=fs.realpathSync(target);
    if(!withinRoot(root,real))throw new Error('PATCH_ENGINE_PATH_ESCAPE');
  }
  return {rel,target};
}

function parseHunkHeader(line){
  const m=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)?$/.exec(line);
  if(!m)throw new Error('PATCH_ENGINE_HUNK_HEADER_INVALID');
  return {
    oldStart:Number(m[1]),
    oldCount:m[2]===undefined?1:Number(m[2]),
    newStart:Number(m[3]),
    newCount:m[4]===undefined?1:Number(m[4])
  };
}

function parseUnifiedDiff(diff){
  const text=String(diff||'').replace(/\r\n/g,'\n');
  if(!text.trim())throw new Error('PATCH_ENGINE_DIFF_REQUIRED');
  if(text.includes('\\ No newline at end of file'))throw new Error('PATCH_ENGINE_NO_NEWLINE_MARKER_UNSUPPORTED');

  const lines=text.split('\n');
  const hunks=[];
  let current=null;

  for(const line of lines){
    if(line.startsWith('@@ ')){
      current={...parseHunkHeader(line),lines:[]};
      hunks.push(current);
      continue;
    }
    if(!current)continue;
    if(line===''&&current===hunks[hunks.length-1])continue;
    const prefix=line[0];
    if(prefix!==' '&&prefix!=='+'&&prefix!=='-')throw new Error('PATCH_ENGINE_DIFF_LINE_INVALID');
    current.lines.push({type:prefix,text:line.slice(1)});
  }

  if(!hunks.length)throw new Error('PATCH_ENGINE_HUNK_REQUIRED');
  return hunks;
}

function splitText(text){
  const value=String(text);
  const trailing=value.endsWith('\n');
  const body=trailing?value.slice(0,-1):value;
  return {lines:body===''?[]:body.split('\n'),trailing};
}

function applyUnifiedDiff(original,diff,{create=false}={}){
  const hunks=parseUnifiedDiff(diff);
  const src=splitText(original);
  const out=[];
  let cursor=0;

  for(const hunk of hunks){
    const start=hunk.oldStart===0?0:hunk.oldStart-1;
    if(start<cursor||start>src.lines.length)throw new Error('PATCH_ENGINE_HUNK_POSITION_INVALID');
    while(cursor<start)out.push(src.lines[cursor++]);

    let consumed=0;
    let produced=0;
    for(const line of hunk.lines){
      if(line.type===' '){
        if(src.lines[cursor]!==line.text)throw new Error('PATCH_ENGINE_CONTEXT_MISMATCH');
        out.push(line.text);
        cursor+=1; consumed+=1; produced+=1;
      }else if(line.type==='-'){
        if(src.lines[cursor]!==line.text)throw new Error('PATCH_ENGINE_REMOVE_MISMATCH');
        cursor+=1; consumed+=1;
      }else if(line.type==='+'){
        out.push(line.text);
        produced+=1;
      }
    }
    if(consumed!==hunk.oldCount||produced!==hunk.newCount){
      throw new Error('PATCH_ENGINE_HUNK_COUNT_MISMATCH');
    }
  }

  while(cursor<src.lines.length)out.push(src.lines[cursor++]);
  const trailing=create?true:src.trailing;
  return out.join('\n')+(trailing?'\n':'');
}

function prepareOperation(root,patch){
  const {rel,target}=resolveTarget(root,patch.path);
  const exists=fs.existsSync(target);
  const original=exists?fs.readFileSync(target,'utf8'):null;
  const mode=exists?fs.statSync(target).mode:null;

  if(patch.operation==='create'){
    if(exists)throw new Error('PATCH_ENGINE_CREATE_TARGET_EXISTS');
    return {
      rel,target,operation:'create',original:null,mode:null,
      next:applyUnifiedDiff('',patch.unified_diff,{create:true})
    };
  }

  if(patch.operation==='modify'){
    if(!exists)throw new Error('PATCH_ENGINE_MODIFY_TARGET_MISSING');
    return {
      rel,target,operation:'modify',original,mode,
      next:applyUnifiedDiff(original,patch.unified_diff)
    };
  }

  if(patch.operation==='delete'){
    if(!exists)throw new Error('PATCH_ENGINE_DELETE_TARGET_MISSING');
    return {rel,target,operation:'delete',original,mode,next:null};
  }

  throw new Error('PATCH_ENGINE_OPERATION_INVALID');
}

function tempName(target,transactionId,kind){
  return target+'.bonds-'+kind+'-'+transactionId;
}

function cleanupFile(file){
  try{ if(fs.existsSync(file))fs.unlinkSync(file); }catch(_err){}
}

function rollback(applied){
  for(const item of [...applied].reverse()){
    try{
      if(item.operation==='create'){
        cleanupFile(item.target);
      }else if(item.operation==='modify'){
        cleanupFile(item.target);
        if(item.backup&&fs.existsSync(item.backup))fs.renameSync(item.backup,item.target);
      }else if(item.operation==='delete'){
        if(item.backup&&fs.existsSync(item.backup))fs.renameSync(item.backup,item.target);
      }
    }catch(_err){}
    if(item.temp)cleanupFile(item.temp);
  }
}

function applyPrepared(prepared,transactionId){
  const applied=[];
  try{
    for(const item of prepared){
      const backup=tempName(item.target,transactionId,'backup');
      const temp=tempName(item.target,transactionId,'tmp');
      if(fs.existsSync(backup)||fs.existsSync(temp))throw new Error('PATCH_ENGINE_TEMP_COLLISION');

      if(item.operation==='create'){
        fs.writeFileSync(temp,item.next,{encoding:'utf8',flag:'wx'});
        fs.renameSync(temp,item.target);
        applied.push({...item,temp,backup:null});
        continue;
      }

      if(item.operation==='modify'){
        fs.writeFileSync(temp,item.next,{encoding:'utf8',flag:'wx',mode:item.mode});
        fs.renameSync(item.target,backup);
        try{
          fs.renameSync(temp,item.target);
        }catch(err){
          fs.renameSync(backup,item.target);
          cleanupFile(temp);
          throw err;
        }
        applied.push({...item,temp:null,backup});
        continue;
      }

      if(item.operation==='delete'){
        fs.renameSync(item.target,backup);
        applied.push({...item,temp:null,backup});
      }
    }

    for(const item of applied){
      if(item.backup)cleanupFile(item.backup);
    }
    return applied;
  }catch(err){
    rollback(applied);
    throw err;
  }
}

function applyPatchProposal({
  candidate,
  currentMainSha,
  workspaceRoot,
  codeProviderResult
}={}){
  if(!codeProviderResult||typeof codeProviderResult!=='object'){
    throw new Error('PATCH_ENGINE_PROPOSAL_REQUIRED');
  }
  if(codeProviderResult.candidate_id!==candidate?.candidate_id){
    throw new Error('PATCH_ENGINE_CANDIDATE_ID_MISMATCH');
  }
  if(codeProviderResult.provider!=='BondsNativeProvider'){
    throw new Error('PATCH_ENGINE_PROVIDER_INVALID');
  }
  if(codeProviderResult.policy?.proposal_only!==true||codeProviderResult.policy?.patch_applied!==false){
    throw new Error('PATCH_ENGINE_PROPOSAL_POLICY_INVALID');
  }

  const freshness=assertCandidateFresh(candidate,currentMainSha);
  if(!freshness.fresh)throw new Error('PATCH_ENGINE_CANDIDATE_STALE');

  const root=assertWorkspace(candidate,workspaceRoot);
  const proposal=validatePatchProposal(codeProviderResult.proposal);
  const prepared=proposal.patches.map(patch=>prepareOperation(root,patch));
  const transactionId=crypto.randomBytes(8).toString('hex');
  const applied=applyPrepared(prepared,transactionId);
  const changedFiles=applied.map(item=>item.rel).sort();
  const impact=analyzeImpact({changedFiles});

  return {
    version:PATCH_ENGINE_VERSION,
    candidate_id:candidate.candidate_id,
    base_sha:candidate.git?.base_sha||null,
    transaction_id:transactionId,
    changed_files:changedFiles,
    files:applied.map(item=>({
      path:item.rel,
      operation:item.operation,
      before_sha256:item.original===null?null:sha256(item.original),
      after_sha256:item.next===null?null:sha256(item.next)
    })),
    impact,
    policy:{
      isolated_workspace_only:true,
      candidate_workspace_write:true,
      main_write:false,
      production_write:false,
      shell_execution:false,
      free_text_execution:false,
      symlink_following:false,
      deterministic_patch_application:true,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

module.exports={
  PATCH_ENGINE_VERSION,
  ALLOWED_STATES,
  sha256,
  assertWorkspace,
  withinRoot,
  assertExistingAncestorsSafe,
  resolveTarget,
  parseHunkHeader,
  parseUnifiedDiff,
  applyUnifiedDiff,
  prepareOperation,
  applyPatchProposal
};
