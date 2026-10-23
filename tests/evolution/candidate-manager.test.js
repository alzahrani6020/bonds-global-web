'use strict';

const {
  createCandidate,
  assertCandidateFresh,
  updateCandidateImpact
}=require('../../lib/evolution/candidate-manager');
const { STATES }=require('../../lib/dual-core/evolution-state-machine');

const SHA='97dc3caf892a803cd9b0212a9ade9dff1e5f7717';

function target(){
  return {
    proposal_id:'11111111-1111-1111-1111-111111111111',
    fingerprint:'a'.repeat(64),
    problem_class:'execution_defect',
    target_component:'capability_execution',
    recommended_path:'development_candidate'
  };
}

describe('Phase 3 isolated Candidate Manager',()=>{
  test('creates deterministic candidate from exact clean main SHA',()=>{
    const a=createCandidate({baseSha:SHA,observedMainSha:SHA,target:target()});
    const b=createCandidate({baseSha:SHA,observedMainSha:SHA,target:target()});
    expect(a.candidate_id).toBe(b.candidate_id);
    expect(a.git.branch).toMatch(/^evolution\/candidate\/cand-/);
    expect(a.git.direct_main_write).toBe(false);
    expect(a.workspace.isolated).toBe(true);
    expect(a.workspace.dirty_repo_reuse).toBe(false);
    expect(a.state).toBe(STATES.ENGINEERING);
  });

  test('refuses stale candidate creation',()=>{
    expect(()=>createCandidate({
      baseSha:SHA,
      observedMainSha:'a'.repeat(40),
      target:target()
    })).toThrow('CANDIDATE_BASE_STALE');
  });

  test('freshness check requires rebase when main moved',()=>{
    const candidate=createCandidate({baseSha:SHA,observedMainSha:SHA,target:target()});
    expect(assertCandidateFresh(candidate,SHA).fresh).toBe(true);
    expect(assertCandidateFresh(candidate,'b'.repeat(40))).toEqual(expect.objectContaining({
      fresh:false,
      required_state:STATES.REBASING
    }));
  });

  test('impact manifest is recomputed deterministically from changed files',()=>{
    const candidate=createCandidate({baseSha:SHA,observedMainSha:SHA,target:target()});
    const updated=updateCandidateImpact(candidate,[
      'services/bonds_token_runtime/bonds_security/server.py'
    ]);
    expect(updated.impact.risk).toBe('protected');
    expect(updated.impact.required_gates).toContain('token-runtime-windows-acceptance');
    expect(updated.policy.execution_authorized).toBe(false);
  });

  test('never emits shell/free-text execution or automatic promotion permissions',()=>{
    const candidate=createCandidate({baseSha:SHA,observedMainSha:SHA,target:target()});
    expect(candidate.policy).toEqual(expect.objectContaining({
      shell_command_generation:false,
      free_text_execution:false,
      direct_main_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });
});
