'use strict';

const generated=require('../../lib/capabilities/generated-service-registry');
const assistantManifest=require('../../services/manifests/assistant.service.json');
const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const {
  buildAssistantRegistrySync,
  assertAssistantRegistrySynchronized
}=require('../../lib/evolution/registry-sync');

function verified(){
  return {
    version:1,
    integration_id:'integration-'+'a'.repeat(24),
    state:STATES.INTEGRATION_VERIFIED
  };
}

describe('Phase 4 Assistant and Capability Registry synchronization',()=>{
  test('current assistant manifest and generated registry are synchronized',()=>{
    const result=buildAssistantRegistrySync({
      integrationVerification:verified(),
      generatedRegistry:generated,
      assistantManifest
    });
    expect(result.status).toBe('synchronized');
    expect(result.discrepancies).toEqual([]);
    expect(result.assistant_capability_count).toBeGreaterThan(0);
    expect(result.policy).toEqual(expect.objectContaining({
      deterministic:true,
      validation_only:true,
      registry_write:false,
      manifest_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('blocks when integration has not been verified',()=>{
    expect(()=>buildAssistantRegistrySync({
      integrationVerification:{state:STATES.STAGING},
      generatedRegistry:generated,
      assistantManifest
    })).toThrow('REGISTRY_SYNC_INTEGRATION_NOT_VERIFIED');
  });

  test('detects missing manifest capability',()=>{
    const clone=JSON.parse(JSON.stringify(assistantManifest));
    clone.capabilities=clone.capabilities.slice(1);
    const result=buildAssistantRegistrySync({
      integrationVerification:verified(),
      generatedRegistry:generated,
      assistantManifest:clone
    });
    expect(result.status).toBe('blocked');
    expect(result.discrepancies.some(x=>x.type==='manifest_capability_missing')).toBe(true);
  });

  test('detects service version mismatch',()=>{
    const clone=JSON.parse(JSON.stringify(assistantManifest));
    clone.version=999;
    const result=buildAssistantRegistrySync({
      integrationVerification:verified(),
      generatedRegistry:generated,
      assistantManifest:clone
    });
    expect(result.status).toBe('blocked');
    expect(result.discrepancies.some(x=>x.type==='service_version_mismatch')).toBe(true);
  });

  test('detects capability contract drift',()=>{
    const clone=JSON.parse(JSON.stringify(assistantManifest));
    clone.capabilities[0].runtime.adapter='wrong_adapter';
    const result=buildAssistantRegistrySync({
      integrationVerification:verified(),
      generatedRegistry:generated,
      assistantManifest:clone
    });
    expect(result.status).toBe('blocked');
    expect(result.discrepancies.some(x=>x.type==='capability_contract_mismatch')).toBe(true);
  });

  test('assert helper fails closed with structured result',()=>{
    const clone=JSON.parse(JSON.stringify(assistantManifest));
    clone.capabilities=[];
    expect(()=>assertAssistantRegistrySynchronized({
      integrationVerification:verified(),
      generatedRegistry:generated,
      assistantManifest:clone
    })).toThrow('REGISTRY_SYNC_BLOCKED');
  });
});
