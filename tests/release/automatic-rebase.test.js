'use strict';

const { createCandidate }=require('../../lib/evolution/candidate-manager');
const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const {
  buildAutomaticRebasePlan,
  materializeRebasedCandidate
}=require('../../lib/release/automatic-rebase');

const OLD='09e05842d8a3542523e140c0aa42d181fe332f52';
const NEW='1'.repeat(40);

function target(){
  return {
    proposal_id:'11111111-1111-1111-1111-111111111111',
    fingerprint:'a'.repeat(64),
    problem_class:'execution_defect',
    target_component:'capability_execution',
    recommended_path:'development_candidate'
  };
}

function candidate(base=OLD){
  return createCandidate({
    baseSha:base,
    observedMainSha:base,
    target:target(),
    proposedChangedFiles:['lib/release/automatic-rebase.js']
  });
}

describe('Phase 5 automatic rebase planner',()=>{
  test('returns not_required when candidate base matches current main',()=>{
    const c=candidate(OLD);
    const result=buildAutomaticRebasePlan({
      candidate:c,
      currentMainSha:OLD,
      changedFiles:['lib/release/automatic-rebase.js']
    });
    expect(result.status).toBe('not_required');
    expect(result.required_state).toBeNull();
    expect(result.policy.revalidation_required).toBe(false);
    expect(result.policy.force_rebase).toBe(false);
  });

  test('requires clean rebuild on latest main when base is stale',()=>{
    const c=candidate(OLD);
    const result=buildAutomaticRebasePlan({
      candidate:c,
      currentMainSha:NEW,
      changedFiles:['lib/release/automatic-rebase.js']
    });
    expect(result.status).toBe('rebuild_required');
    expect(result.required_state).toBe(STATES.REBASING);
    expect(result.next_state_after_rebuild).toBe(STATES.REVALIDATING);
    expect(result.policy).toEqual(expect.objectContaining({
      recreate_candidate_from_latest_main:true,
      force_rebase:false,
      force_push:false,
      direct_main_write:false,
      conflict_auto_resolution:false,
      revalidation_required:true,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('blocks instead of auto-resolving conflicts',()=>{
    const c=candidate(OLD);
    const result=buildAutomaticRebasePlan({
      candidate:c,
      currentMainSha:NEW,
      changedFiles:['lib/release/automatic-rebase.js'],
      conflictingFiles:['lib/release/automatic-rebase.js']
    });
    expect(result.status).toBe('blocked');
    expect(result.required_state).toBe(STATES.BLOCKED);
    expect(result.conflicting_files).toEqual(['lib/release/automatic-rebase.js']);
    expect(result.policy.conflict_auto_resolution).toBe(false);
  });

  test('materializes rebuilt candidate only on exact new base and same target',()=>{
    const oldCandidate=candidate(OLD);
    const plan=buildAutomaticRebasePlan({
      candidate:oldCandidate,
      currentMainSha:NEW,
      changedFiles:['lib/release/automatic-rebase.js']
    });
    const newCandidate=candidate(NEW);
    const result=materializeRebasedCandidate({
      candidate:oldCandidate,
      rebasePlan:plan,
      newCandidate
    });

    expect(result.state).toBe(STATES.REVALIDATING);
    expect(result.git.base_sha).toBe(NEW);
    expect(result.rebase.previous_candidate_id).toBe(oldCandidate.candidate_id);
    expect(result.policy.revalidation_required).toBe(true);
    expect(result.policy.execution_authorized).toBe(false);
    expect(result.policy.auto_merge).toBe(false);
  });

  test('rejects rebuilt candidate when target identity changed',()=>{
    const oldCandidate=candidate(OLD);
    const plan=buildAutomaticRebasePlan({
      candidate:oldCandidate,
      currentMainSha:NEW
    });
    const newCandidate={
      ...candidate(NEW),
      target:{...candidate(NEW).target,fingerprint:'b'.repeat(64)}
    };
    expect(()=>materializeRebasedCandidate({
      candidate:oldCandidate,
      rebasePlan:plan,
      newCandidate
    })).toThrow('AUTOREBASE_TARGET_CHANGED');
  });
});
