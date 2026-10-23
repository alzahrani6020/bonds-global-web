'use strict';

const {
  createApprovedTarget,
  validateApprovedTarget,
  assertApprovalFresh,
  approvalCovers,
  assertTargetUnchanged
}=require('../../lib/evolution/approval-target');

const SHA='f7a28c3fa833c6b1b57318c4f1a46c342496a0e3';

function proposal(overrides={}){
  return {
    proposal_id:'11111111-1111-1111-1111-111111111111',
    fingerprint:'a'.repeat(64),
    problem_class:'execution_defect',
    target_component:'capability_execution',
    recommended_path:'development_candidate',
    risk_level:'high',
    ...overrides
  };
}

describe('Phase 4 approved target contract',()=>{
  test('creates deterministic SHA-bound full approval without execution authority',()=>{
    const a=createApprovedTarget({
      proposal:proposal(),
      baseSha:SHA,
      approvedBy:'owner',
      approvedAt:'2026-10-23T04:00:00Z'
    });
    const b=createApprovedTarget({
      proposal:proposal(),
      baseSha:SHA,
      approvedBy:'owner',
      approvedAt:'2026-10-23T04:00:00Z'
    });

    expect(a.approval_id).toBe(b.approval_id);
    expect(validateApprovedTarget(a)).toEqual(a);
    expect(a.policy).toEqual(expect.objectContaining({
      sha_bound:true,
      scope_bound:true,
      execution_authorized:false,
      validation_bypass:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('invalidates approval when main SHA moves',()=>{
    const approved=createApprovedTarget({
      proposal:proposal(),
      baseSha:SHA,
      approvedBy:'owner'
    });
    const result=assertApprovalFresh(approved,'0'.repeat(40));
    expect(result.fresh).toBe(false);
    expect(result.code).toBe('APPROVED_TARGET_BASE_STALE');
  });

  test('supports partial approval by path and component',()=>{
    const approved=createApprovedTarget({
      proposal:proposal(),
      baseSha:SHA,
      approvedBy:'owner',
      scope:{
        mode:'partial',
        allowed_paths:['lib/capabilities'],
        allowed_components:['capability_execution']
      }
    });

    expect(approvalCovers({
      approvedTarget:approved,
      targetComponent:'capability_execution',
      changedFiles:['lib/capabilities/a.js']
    }).covered).toBe(true);

    const rejected=approvalCovers({
      approvedTarget:approved,
      targetComponent:'capability_execution',
      changedFiles:['lib/security/auth.js']
    });
    expect(rejected.covered).toBe(false);
    expect(rejected.unapproved_paths).toEqual(['lib/security/auth.js']);
  });

  test('partial approval rejects unapproved component',()=>{
    const approved=createApprovedTarget({
      proposal:proposal(),
      baseSha:SHA,
      approvedBy:'owner',
      scope:{
        mode:'partial',
        allowed_components:['capability_execution']
      }
    });
    const result=approvalCovers({
      approvedTarget:approved,
      targetComponent:'security_runtime',
      changedFiles:[]
    });
    expect(result.covered).toBe(false);
    expect(result.component_covered).toBe(false);
  });

  test('material proposal change requires new approval',()=>{
    const approved=createApprovedTarget({
      proposal:proposal(),
      baseSha:SHA,
      approvedBy:'owner'
    });
    expect(assertTargetUnchanged(approved,proposal()).unchanged).toBe(true);
    const changed=assertTargetUnchanged(approved,proposal({
      fingerprint:'b'.repeat(64),
      target_component:'security_runtime'
    }));
    expect(changed.unchanged).toBe(false);
    expect(changed.code).toBe('APPROVED_TARGET_SCOPE_CHANGED');
  });

  test('partial approval must declare at least one bound',()=>{
    expect(()=>createApprovedTarget({
      proposal:proposal(),
      baseSha:SHA,
      approvedBy:'owner',
      scope:{mode:'partial'}
    })).toThrow('APPROVED_TARGET_PARTIAL_SCOPE_REQUIRED');
  });
});
