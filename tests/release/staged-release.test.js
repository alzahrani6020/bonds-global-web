'use strict';

const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const {
  createStagedRelease,
  verifyStagedRelease
}=require('../../lib/release/staged-release');

const MAIN='ee5e60ffed2324ce81f07d1f3ba7936ba0cffa42';
const CANDIDATE='1'.repeat(40);

function simulation(){
  return {
    simulation_id:'merge-sim-'+'a'.repeat(24),
    integration_id:'integration-'+'b'.repeat(24),
    candidate_id:'cand-'+'c'.repeat(24),
    candidate_head_sha:CANDIDATE,
    status:'merge_ready',
    state:STATES.MERGE_READY
  };
}

function mergeEvidence(){
  return {
    merged:true,
    merge_commit_sha:MAIN,
    candidate_head_sha:CANDIDATE
  };
}

describe('Phase 5 deterministic staged release',()=>{
  test('creates staging-required release bound to exact merged main SHA',()=>{
    const result=createStagedRelease({
      mergeSimulation:simulation(),
      mergeEvidence:mergeEvidence(),
      currentMainSha:MAIN
    });

    expect(result.status).toBe('staging_required');
    expect(result.state).toBe(STATES.MERGED);
    expect(result.merge_commit_sha).toBe(MAIN);
    expect(result.environment).toBe('staging');
    expect(result.policy).toEqual(expect.objectContaining({
      deterministic:true,
      exact_merge_sha_required:true,
      staging_required:true,
      production_promotion:false,
      direct_production_write:false,
      execution_authorized:false,
      auto_promote:false,
      auto_deploy:false
    }));
  });

  test('rejects release when current main is not exact merge SHA',()=>{
    expect(()=>createStagedRelease({
      mergeSimulation:simulation(),
      mergeEvidence:mergeEvidence(),
      currentMainSha:'2'.repeat(40)
    })).toThrow('STAGED_RELEASE_MAIN_NOT_MERGE_SHA');
  });

  test('rejects candidate mismatch between merge simulation and merge evidence',()=>{
    expect(()=>createStagedRelease({
      mergeSimulation:simulation(),
      mergeEvidence:{...mergeEvidence(),candidate_head_sha:'3'.repeat(40)},
      currentMainSha:MAIN
    })).toThrow('STAGED_RELEASE_CANDIDATE_MISMATCH');
  });

  test('staging verification blocks on any failed check',()=>{
    const staged=createStagedRelease({
      mergeSimulation:simulation(),
      mergeEvidence:mergeEvidence(),
      currentMainSha:MAIN
    });
    const result=verifyStagedRelease({
      stagedRelease:staged,
      deployedSha:MAIN,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'smoke',passed:false,code:'SMOKE_FAILED'}
      ]
    });

    expect(result.status).toBe('blocked');
    expect(result.state).toBe(STATES.BLOCKED);
    expect(result.blockers).toEqual([
      {id:'smoke',passed:false,code:'SMOKE_FAILED'}
    ]);
    expect(result.policy.production_promotion).toBe(false);
  });

  test('staging verification succeeds without promoting production',()=>{
    const staged=createStagedRelease({
      mergeSimulation:simulation(),
      mergeEvidence:mergeEvidence(),
      currentMainSha:MAIN
    });
    const result=verifyStagedRelease({
      stagedRelease:staged,
      deployedSha:MAIN,
      checks:[
        {id:'health',passed:true,code:'OK'},
        {id:'smoke',passed:true,code:'OK'}
      ]
    });

    expect(result.status).toBe('staging_verified');
    expect(result.state).toBe(STATES.MERGED);
    expect(result.policy).toEqual({
      production_promotion:false,
      promotion_requires_next_gate:true,
      execution_authorized:false,
      auto_promote:false,
      auto_deploy:false
    });
  });

  test('rejects staging evidence for a different deployed SHA',()=>{
    const staged=createStagedRelease({
      mergeSimulation:simulation(),
      mergeEvidence:mergeEvidence(),
      currentMainSha:MAIN
    });

    expect(()=>verifyStagedRelease({
      stagedRelease:staged,
      deployedSha:'4'.repeat(40),
      checks:[{id:'health',passed:true,code:'OK'}]
    })).toThrow('STAGED_RELEASE_SHA_MISMATCH');
  });
});
