/** @jest-environment node */

const mockLoadWorkflowState = jest.fn();
const mockReviewCriticalAction = jest.fn();

jest.mock('../../lib/assistant/workflow-state', () => ({
  loadWorkflowState: (...args) => mockLoadWorkflowState(...args)
}));

jest.mock('../../lib/assistant/critical-multi-model-consensus', () => ({
  reviewCriticalAction: (...args) => mockReviewCriticalAction(...args),
  publicCriticalConsensus: value => value || null
}));

const { requestHumanApproval } = require('../../lib/assistant/human-approval');

function action(risk) {
  return {
    id:'approval-action-1',
    type:'form_submit',
    capability:'form_submit',
    target:'funding',
    input:{ application_id:'app-1' },
    risk,
    requires_confirmation:true,
    status:'ready'
  };
}

function supabaseMock() {
  const inserted = [];
  return {
    inserted,
    from:jest.fn(() => ({
      select:jest.fn(() => ({
        eq:jest.fn(() => ({
          eq:jest.fn(() => ({
            eq:jest.fn(() => ({
              maybeSingle:jest.fn().mockResolvedValue({ data:null, error:null })
            }))
          }))
        }))
      })),
      insert:jest.fn(row => {
        inserted.push(row);
        return {
          select:jest.fn(() => ({
            single:jest.fn().mockResolvedValue({
              data:{
                id:'approval-1',
                ...row,
                created_at:'2026-10-23T00:00:00.000Z',
                updated_at:'2026-10-23T00:00:00.000Z'
              },
              error:null
            })
          }))
        };
      })
    }))
  };
}

describe('Human Approval critical consensus integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadWorkflowState.mockResolvedValue({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      version:1,
      status:'active'
    });
    mockReviewCriticalAction.mockResolvedValue({
      version:1,
      type:'critical_multi_model_consensus',
      status:'completed',
      verdict:'consensus_approve_for_review',
      critical:true,
      action_id:'approval-action-1',
      action_fingerprint:'f'.repeat(64),
      reviewer_count:2,
      distinct_model_count:2,
      reviews:[],
      advisory_only:true,
      human_review_required:true,
      execution_authorized:false,
      auto_execute:false,
      authorization_source:false,
      model_used:true,
      multi_model:true,
      reason:null
    });
  });

  test('attaches advisory consensus only for critical approvals', async () => {
    const supabase=supabaseMock();
    const critical=action('critical');

    const result=await requestHumanApproval({
      supabase,
      userId:'user-1',
      workflowKey:'wf-1',
      boundary:'project:p-1',
      expectedVersion:1,
      action:critical,
      idempotencyKey:'approval-001'
    });

    expect(mockReviewCriticalAction).toHaveBeenCalledTimes(1);
    expect(mockReviewCriticalAction).toHaveBeenCalledWith({ action:critical });
    expect(supabase.inserted[0].payload.consensus).toEqual(expect.objectContaining({
      status:'completed',
      multi_model:true,
      execution_authorized:false,
      authorization_source:false
    }));
    expect(result.approval.consensus).toEqual(expect.objectContaining({
      multi_model:true,
      execution_authorized:false
    }));
    expect(result.execution_authorized).toBe(false);
  });

  test('does not invoke model consensus for high-risk approvals', async () => {
    const supabase=supabaseMock();

    const result=await requestHumanApproval({
      supabase,
      userId:'user-1',
      workflowKey:'wf-1',
      boundary:'project:p-1',
      expectedVersion:1,
      action:action('high'),
      idempotencyKey:'approval-002'
    });

    expect(mockReviewCriticalAction).not.toHaveBeenCalled();
    expect(supabase.inserted[0].payload.consensus).toBeNull();
    expect(result.approval.consensus).toBeNull();
    expect(result.execution_authorized).toBe(false);
  });
});
