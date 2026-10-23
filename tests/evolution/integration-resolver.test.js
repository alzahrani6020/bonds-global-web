'use strict';

const { createCandidate }=require('../../lib/evolution/candidate-manager');
const { createApprovedTarget }=require('../../lib/evolution/approval-target');
const { evaluateDependencies }=require('../../lib/evolution/dependency-checks');
const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const {
  resolveIntegration,
  verifyStagedIntegration
}=require('../../lib/evolution/integration-resolver');

const SHA='6af9d8b54a564d94660ccd66c419ddfd03483af0';
const HEAD='1'.repeat(40);

function proposal(){
  return {
    proposal_id:'11111111-1111-1111-1111-111111111111',
    fingerprint:'a'.repeat(64),
    problem_class:'execution_defect',
    target_component:'capability_execution',
    recommended_path:'development_candidate',
    risk_level:null
  };
}

function candidate(){
  return {
    ...createCandidate({
      baseSha:SHA,
      observedMainSha:SHA,
      target:proposal(),
      proposedChangedFiles:['lib/evolution/integration-resolver.js']
    }),
    state:STATES.VALIDATING
  };
}

function approved(){
  return createApprovedTarget({
    proposal:proposal(),
    baseSha:SHA,
    approvedBy:'owner',
    approvedAt:'2026-10-23T04:30:00Z'
  });
}

function deps(c,a){
  return evaluateDependencies({
    approvedTarget:a,
    candidate:c,
    currentMainSha:SHA,
    changedFiles:['lib/evolution/integration-resolver.js'],
    inventory:{
      files:['lib/evolution/integration-resolver.js'],
      tests:[
        'tests/dual-core/assistant-outcome-bridge.test.js',
        'tests/dual-core/evolution-proposal-aggregator.test.js',
        'tests/learning/phase2-learning-foundation.test.js'
      ],
      gates:['unit-integration'],
      capabilities:[],
      services:[]
    }
  });
}

describe('Phase 4 deterministic Integration Resolver',()=>{
  test('resolves only approved dependency-ready candidate into staging manifest',()=>{
    const c=candidate();
    const a=approved();
    const d=deps(c,a);

    const result=resolveIntegration({
      candidate:c,
      approvedTarget:a,
      dependencyResult:d,
      currentMainSha:SHA,
      candidateHeadSha:HEAD,
      changedFiles:['lib/evolution/integration-resolver.js']
    });

    expect(result.state).toBe(STATES.STAGING);
    expect(result.base_sha).toBe(SHA);
    expect(result.candidate_head_sha).toBe(HEAD);
    expect(result.integration_id).toMatch(/^integration-/);
    expect(result.policy).toEqual(expect.objectContaining({
      deterministic:true,
      approval_bound:true,
      dependency_bound:true,
      sha_bound:true,
      staging_required:true,
      direct_main_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('blocks stale candidate before integration resolution',()=>{
    const c=candidate();
    const a=approved();
    const d=deps(c,a);

    expect(()=>resolveIntegration({
      candidate:c,
      approvedTarget:a,
      dependencyResult:d,
      currentMainSha:'0'.repeat(40),
      candidateHeadSha:HEAD,
      changedFiles:['lib/evolution/integration-resolver.js']
    })).toThrow('INTEGRATION_CANDIDATE_STALE');
  });

  test('rejects dependency result that is not ready',()=>{
    const c=candidate();
    const a=approved();
    const d={...deps(c,a),status:'blocked'};

    expect(()=>resolveIntegration({
      candidate:c,
      approvedTarget:a,
      dependencyResult:d,
      currentMainSha:SHA,
      candidateHeadSha:HEAD,
      changedFiles:['lib/evolution/integration-resolver.js']
    })).toThrow('INTEGRATION_DEPENDENCIES_NOT_READY');
  });

  test('rejects dependency result bound to another candidate',()=>{
    const c=candidate();
    const a=approved();
    const d={...deps(c,a),candidate_id:'cand-other'};

    expect(()=>resolveIntegration({
      candidate:c,
      approvedTarget:a,
      dependencyResult:d,
      currentMainSha:SHA,
      candidateHeadSha:HEAD,
      changedFiles:['lib/evolution/integration-resolver.js']
    })).toThrow('INTEGRATION_DEPENDENCY_CANDIDATE_MISMATCH');
  });

  test('staging verification fails closed on any failed check',()=>{
    const c=candidate();
    const a=approved();
    const d=deps(c,a);
    const manifest=resolveIntegration({
      candidate:c,
      approvedTarget:a,
      dependencyResult:d,
      currentMainSha:SHA,
      candidateHeadSha:HEAD,
      changedFiles:['lib/evolution/integration-resolver.js']
    });

    const result=verifyStagedIntegration({
      integration:manifest,
      stagedHeadSha:HEAD,
      checks:[
        {id:'unit',passed:true,code:'OK'},
        {id:'registry',passed:false,code:'REGISTRY_MISMATCH'}
      ]
    });

    expect(result.state).toBe(STATES.BLOCKED);
    expect(result.blockers).toEqual([
      {id:'registry',passed:false,code:'REGISTRY_MISMATCH'}
    ]);
    expect(result.policy.auto_merge).toBe(false);
  });

  test('staging verification yields INTEGRATION_VERIFIED without performing merge',()=>{
    const c=candidate();
    const a=approved();
    const d=deps(c,a);
    const manifest=resolveIntegration({
      candidate:c,
      approvedTarget:a,
      dependencyResult:d,
      currentMainSha:SHA,
      candidateHeadSha:HEAD,
      changedFiles:['lib/evolution/integration-resolver.js']
    });

    const result=verifyStagedIntegration({
      integration:manifest,
      stagedHeadSha:HEAD,
      checks:[
        {id:'unit',passed:true,code:'OK'},
        {id:'registry',passed:true,code:'OK'}
      ]
    });

    expect(result.state).toBe(STATES.INTEGRATION_VERIFIED);
    expect(result.policy).toEqual({
      merge_execution:false,
      direct_main_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    });
  });

  test('rejects staging verification against a different candidate head SHA',()=>{
    const c=candidate();
    const a=approved();
    const d=deps(c,a);
    const manifest=resolveIntegration({
      candidate:c,
      approvedTarget:a,
      dependencyResult:d,
      currentMainSha:SHA,
      candidateHeadSha:HEAD,
      changedFiles:['lib/evolution/integration-resolver.js']
    });

    expect(()=>verifyStagedIntegration({
      integration:manifest,
      stagedHeadSha:'2'.repeat(40),
      checks:[{id:'unit',passed:true,code:'OK'}]
    })).toThrow('INTEGRATION_STAGED_SHA_MISMATCH');
  });
});
