'use strict';

const { STATES }=require('../dual-core/evolution-state-machine');

const REGISTRY_SYNC_VERSION=1;

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function normalizeManifestCapability(item){
  return {
    action:clean(item?.action,160),
    id:clean(item?.id,160),
    sideEffect:clean(item?.side_effect,80),
    adapter:clean(item?.runtime?.adapter,160)
  };
}

function normalizeGeneratedCapability(action,spec){
  return {
    action:clean(action,160),
    id:clean(spec?.id,160),
    sideEffect:clean(spec?.sideEffect,80),
    adapter:clean(spec?.runtime?.adapter,160),
    serviceCode:clean(spec?.serviceCode,120),
    active:spec?.active!==false
  };
}

function buildAssistantRegistrySync({
  integrationVerification,
  generatedRegistry,
  assistantManifest
}={}){
  if(!integrationVerification||integrationVerification.state!==STATES.INTEGRATION_VERIFIED){
    throw new Error('REGISTRY_SYNC_INTEGRATION_NOT_VERIFIED');
  }
  if(!generatedRegistry||typeof generatedRegistry!=='object'){
    throw new Error('REGISTRY_SYNC_GENERATED_REGISTRY_REQUIRED');
  }
  if(!assistantManifest||typeof assistantManifest!=='object'){
    throw new Error('REGISTRY_SYNC_ASSISTANT_MANIFEST_REQUIRED');
  }

  const generatedService=generatedRegistry.services?.assistant;
  if(!generatedService)throw new Error('REGISTRY_SYNC_ASSISTANT_SERVICE_MISSING');

  const generatedCaps=Object.entries(generatedRegistry.capabilities||{})
    .map(([action,spec])=>normalizeGeneratedCapability(action,spec))
    .filter(item=>item.serviceCode==='assistant'&&item.active)
    .sort((a,b)=>a.action.localeCompare(b.action));

  const manifestCaps=(assistantManifest.capabilities||[])
    .map(normalizeManifestCapability)
    .sort((a,b)=>String(a.action).localeCompare(String(b.action)));

  const generatedByAction=new Map(generatedCaps.map(item=>[item.action,item]));
  const manifestByAction=new Map(manifestCaps.map(item=>[item.action,item]));
  const discrepancies=[];

  if(Number(generatedService.version)!==Number(assistantManifest.version)){
    discrepancies.push({
      type:'service_version_mismatch',
      generated:Number(generatedService.version),
      manifest:Number(assistantManifest.version)
    });
  }

  for(const item of generatedCaps){
    const manifest=manifestByAction.get(item.action);
    if(!manifest){
      discrepancies.push({type:'manifest_capability_missing',action:item.action});
      continue;
    }
    for(const field of ['id','sideEffect','adapter']){
      if(item[field]!==manifest[field]){
        discrepancies.push({
          type:'capability_contract_mismatch',
          action:item.action,
          field,
          generated:item[field],
          manifest:manifest[field]
        });
      }
    }
  }

  for(const item of manifestCaps){
    if(!generatedByAction.has(item.action)){
      discrepancies.push({type:'generated_capability_missing',action:item.action});
    }
  }

  discrepancies.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return {
    version:REGISTRY_SYNC_VERSION,
    status:discrepancies.length?'blocked':'synchronized',
    integration_id:integrationVerification.integration_id,
    assistant_service_version:Number(assistantManifest.version),
    generated_service_version:Number(generatedService.version),
    assistant_capability_count:manifestCaps.length,
    generated_assistant_capability_count:generatedCaps.length,
    discrepancies,
    synchronized_actions:discrepancies.length?[]:generatedCaps.map(item=>item.action),
    policy:{
      deterministic:true,
      validation_only:true,
      registry_write:false,
      manifest_write:false,
      execution_authorized:false,
      validation_bypass:false,
      auto_merge:false,
      auto_deploy:false
    }
  };
}

function assertAssistantRegistrySynchronized(args={}){
  const result=buildAssistantRegistrySync(args);
  if(result.status!=='synchronized'){
    const err=new Error('REGISTRY_SYNC_BLOCKED');
    err.result=result;
    throw err;
  }
  return result;
}

module.exports={
  REGISTRY_SYNC_VERSION,
  normalizeManifestCapability,
  normalizeGeneratedCapability,
  buildAssistantRegistrySync,
  assertAssistantRegistrySynchronized
};
