/**
 * Enterprise Lifecycle Approval Engine
 *
 * Supports single, multi, sequential, parallel, and committee approvals.
 */

class ApprovalEngine {
  async createApproval({ instanceId, transitionId, stageId, rule, requestedBy, store }) {
    const approval = await store.createApproval({
      instance_id: instanceId,
      transition_id: transitionId,
      stage_id: stageId,
      approval_type: rule.type || 'single',
      approver_roles: rule.approverRoles || [],
      min_approvals: rule.minApprovals || 1,
      status: 'pending',
      decisions: [],
      requested_by: requestedBy
    });
    return approval;
  }

  async submitDecision({ approvalId, userId, role, decision, reason, store }) {
    const approval = await store.getApproval(approvalId);
    if (!approval) throw new Error('Approval not found');
    if (approval.status !== 'pending') throw new Error('Approval is already ' + approval.status);

    const decisions = [...(approval.decisions || []), {
      user_id: userId,
      role,
      decision,
      reason,
      decided_at: new Date().toISOString()
    }];

    const status = this._computeStatus({ ...approval, decisions });
    const updates = { decisions, status };
    if (status !== 'pending') {
      updates.completed_at = new Date().toISOString();
    }

    return await store.updateApproval(approvalId, updates);
  }

  _computeStatus(approval) {
    const type = approval.approval_type;
    const decisions = approval.decisions || [];
    const approverRoles = approval.approver_roles || [];
    const min = approval.min_approvals || 1;
    const approved = decisions.filter(d => d.decision === 'approved');
    const rejected = decisions.filter(d => d.decision === 'rejected');

    if (type === 'single') {
      if (approved.length > 0) return 'approved';
      if (rejected.length > 0) return 'rejected';
      return 'pending';
    }

    if (type === 'multi' || type === 'parallel' || type === 'committee') {
      if (rejected.length > 0) return 'rejected';
      if (approved.length >= min) return 'approved';
      return 'pending';
    }

    if (type === 'sequential') {
      if (rejected.length > 0) return 'rejected';
      const expectedRoles = approverRoles.slice(0, decisions.length);
      const orderOk = decisions.every((d, i) => d.role === expectedRoles[i]);
      if (!orderOk) return 'pending';
      if (decisions.length === approverRoles.length && approved.length === approverRoles.length) return 'approved';
      return 'pending';
    }

    return 'pending';
  }

  isApproved(approval) {
    return approval && approval.status === 'approved';
  }
}

module.exports = { ApprovalEngine };
