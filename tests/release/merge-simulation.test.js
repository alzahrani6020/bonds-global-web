'use strict';

const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const { simulateMerge, assertMergeReady }=require('../../lib/release/merge-simulation');

const MAIN='fcce547fdf5c1ad33b02743f50cdb5540a745f26';
const HEAD='1'.repeat(40);

function verified(overrides={}){
  return {
    integration_id:'integration-'+'a'.repeat(24),
    state:STATES.INTEGRATION_VERIFIED,
    candidate_id:'cand-'+'b'.repeat(24),
    base_sha:MAIN,
    candidate_head_sha:HEAD,
    ...overrides
  };
}

describe('Phase 5 deterministic merge simulation',()=>{
  test('produces MERGE_READY when exact SHAs and all checks pass',()=>{
    const result=simulateMerge({
      integrationVerification:verified(),
      currentMainSha:MAIN,
      candidateHeadSha:HEAD,
      mergeBaseSha:MAIN,
      changedFiles:['lib/release/merge-simulation.js'],
      checks:[
        {id:'ci',passed:true,code:'OK'},
        {id:'integration',passed:true,code:'OK'}
      ]
    });

    expect(result.status).toBe('merge_ready');
    expect(result.state).toBe(STATES.MERGE_READY);
    expect(result.blockers).toEqual([]);
    expect(result.policy).toEqual(expect.objectContaining({
      deterministic:true,
      simulation_only:true,
      merge_execution:false,
      direct_main_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('blocks when current main moved after integration verification',()=>{
    expect(()=>simulateMerge({
      integrationVerification:verified(),
      currentMainSha:'2'.repeat(40),
      candidateHeadSha:HEAD,
      mergeBaseSha:'2'.repeat(40),
      checks:[{id:'ci',passed:true,code:'OK'}]
    })).toThrow('MERGE_SIMULATION_MAIN_MOVED');
  });

  test('blocks candidate head mismatch',()=>{
    expect(()=>simulateMerge({
      integrationVerification:verified(),
      currentMainSha:MAIN,
      candidateHeadSha:'3'.repeat(40),
      mergeBaseSha:MAIN,
      checks:[{id:'ci',passed:true,code:'OK'}]
    })).toThrow('MERGE_SIMULATION_HEAD_MISMATCH');
  });

  test('returns BLOCKED when conflicts are present',()=>{
    const result=simulateMerge({
      integrationVerification:verified(),
      currentMainSha:MAIN,
      candidateHeadSha:HEAD,
      mergeBaseSha:MAIN,
      conflictingFiles:['lib/release/merge-simulation.js'],
      checks:[{id:'ci',passed:true,code:'OK'}]
    });

    expect(result.status).toBe('blocked');
    expect(result.state).toBe(STATES.BLOCKED);
    expect(result.blockers).toEqual([
      {type:'conflict',file:'lib/release/merge-simulation.js',code:'MERGE_CONFLICT'}
    ]);
    expect(result.policy.conflict_auto_resolution).toBe(false);
  });

  test('returns BLOCKED when a required check fails',()=>{
    const result=simulateMerge({
      integrationVerification:verified(),
      currentMainSha:MAIN,
      candidateHeadSha:HEAD,
      mergeBaseSha:MAIN,
      checks:[
        {id:'ci',passed:false,code:'CI_FAILED'},
        {id:'integration',passed:true,code:'OK'}
      ]
    });

    expect(result.status).toBe('blocked');
    expect(result.blockers.some(x=>x.code==='CI_FAILED')).toBe(true);
  });

  test('assertMergeReady fails closed with structured result',()=>{
    expect(()=>assertMergeReady({
      integrationVerification:verified(),
      currentMainSha:MAIN,
      candidateHeadSha:HEAD,
      mergeBaseSha:MAIN,
      conflictingFiles:['x.js'],
      checks:[{id:'ci',passed:true,code:'OK'}]
    })).toThrow('MERGE_SIMULATION_BLOCKED');
  });
});
