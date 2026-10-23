'use strict';

const { createCandidate }=require('../../lib/evolution/candidate-manager');
const { createApprovedTarget }=require('../../lib/evolution/approval-target');
const { evaluateDependencies, assertDependenciesReady }=require('../../lib/evolution/dependency-checks');

const SHA='4104f71676873e35a4f1d590563e575b7bd63087';

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

function candidate(files=['lib/evolution/dependency-checks.js']){
  return createCandidate({
    baseSha:SHA,
    observedMainSha:SHA,
    target:proposal(),
    proposedChangedFiles:files
  });
}

function approved(scope={mode:'full'}){
  return createApprovedTarget({
    proposal:proposal(),
    baseSha:SHA,
    approvedBy:'owner',
    approvedAt:'2026-10-23T04:20:00Z',
    scope
  });
}

function inventory(extra={}){
  return {
    files:['lib/evolution/dependency-checks.js'],
    tests:[
      'tests/dual-core/assistant-outcome-bridge.test.js',
      'tests/dual-core/evolution-proposal-aggregator.test.js',
      'tests/learning/phase2-learning-foundation.test.js'
    ],
    gates:['unit-integration'],
    capabilities:['capability_execution'],
    services:['service.execution'],
    ...extra
  };
}

describe('Phase 4 deterministic dependency checks',()=>{
  test('returns ready only when all deterministic dependencies exist',()=>{
    const result=evaluateDependencies({
      approvedTarget:approved(),
      candidate:candidate(),
      currentMainSha:SHA,
      changedFiles:['lib/evolution/dependency-checks.js'],
      inventory:inventory(),
      requiredCapabilities:['capability_execution'],
      requiredServices:['service.execution']
    });
    expect(result.status).toBe('ready');
    expect(result.blockers).toEqual([]);
    expect(result.policy).toEqual(expect.objectContaining({
      deterministic:true,
      ai_inference:false,
      fail_closed:true,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('blocks stale candidate',()=>{
    const result=evaluateDependencies({
      approvedTarget:approved(),
      candidate:candidate(),
      currentMainSha:'0'.repeat(40),
      changedFiles:['lib/evolution/dependency-checks.js'],
      inventory:inventory()
    });
    expect(result.status).toBe('blocked');
    expect(result.blockers.some(b=>b.code==='CANDIDATE_BASE_STALE')).toBe(true);
  });

  test('blocks scope expansion beyond partial approval',()=>{
    const result=evaluateDependencies({
      approvedTarget:approved({
        mode:'partial',
        allowed_paths:['lib/evolution'],
        allowed_components:['capability_execution']
      }),
      candidate:candidate(['lib/security/auth.js']),
      currentMainSha:SHA,
      changedFiles:['lib/security/auth.js'],
      inventory:inventory({files:['lib/security/auth.js']})
    });
    expect(result.status).toBe('blocked');
    expect(result.blockers.some(b=>b.code==='APPROVED_TARGET_SCOPE_EXCEEDED')).toBe(true);
  });

  test('blocks missing required test or gate',()=>{
    const result=evaluateDependencies({
      approvedTarget:approved(),
      candidate:candidate(),
      currentMainSha:SHA,
      changedFiles:['lib/evolution/dependency-checks.js'],
      inventory:inventory({tests:[],gates:[]})
    });
    expect(result.status).toBe('blocked');
    expect(result.blockers.some(b=>b.code==='DEPENDENCY_REQUIRED_TEST_MISSING')).toBe(true);
    expect(result.blockers.some(b=>b.code==='DEPENDENCY_REQUIRED_GATE_MISSING')).toBe(true);
  });

  test('blocks missing capability and service dependencies',()=>{
    const result=evaluateDependencies({
      approvedTarget:approved(),
      candidate:candidate(),
      currentMainSha:SHA,
      changedFiles:['lib/evolution/dependency-checks.js'],
      inventory:inventory({capabilities:[],services:[]}),
      requiredCapabilities:['capability_execution'],
      requiredServices:['service.execution']
    });
    expect(result.status).toBe('blocked');
    expect(result.blockers.some(b=>b.code==='DEPENDENCY_CAPABILITY_MISSING')).toBe(true);
    expect(result.blockers.some(b=>b.code==='DEPENDENCY_SERVICE_MISSING')).toBe(true);
  });

  test('assertDependenciesReady fails closed with structured result',()=>{
    expect(()=>assertDependenciesReady({
      approvedTarget:approved(),
      candidate:candidate(),
      currentMainSha:SHA,
      changedFiles:['missing/file.js'],
      inventory:inventory()
    })).toThrow('DEPENDENCY_CHECK_BLOCKED');
  });
});
