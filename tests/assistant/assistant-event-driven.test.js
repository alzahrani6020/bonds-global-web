/** @jest-environment node */

jest.mock('../../lib/assistant/workflow-state', () => ({
  loadWorkflowState: jest.fn(),
  saveWorkflowState: jest.fn()
}));

const {
  normalizeAssistantEvent,
  deriveEventPatch,
  applyAssistantEvent
} = require('../../lib/assistant/event-driven');
const {
  loadWorkflowState,
  saveWorkflowState
} = require('../../lib/assistant/workflow-state');

describe('assistant event-driven workflow updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('accepts registered context events and rejects unknown types', () => {
    expect(normalizeAssistantEvent({
      type:'document_uploaded',
      boundary:'project:p-1',
      resource_id:'doc-1',
      data:{ status:'uploaded' }
    })).toMatchObject({
      type:'document_uploaded',
      boundary:'project:p-1'
    });

    expect(() => normalizeAssistantEvent({
      type:'run_shell',
      boundary:'project:p-1'
    })).toThrow('ASSISTANT_EVENT_NOT_ALLOWED');
  });

  test('rejects executable fields inside event payloads', () => {
    expect(() => normalizeAssistantEvent({
      type:'page_changed',
      boundary:'project:p-1',
      data:{ url:'https://example.com' }
    })).toThrow('FORBIDDEN_EVENT_FIELD');

    expect(() => normalizeAssistantEvent({
      type:'page_changed',
      boundary:'project:p-1',
      data:{ selector:'#admin' }
    })).toThrow('FORBIDDEN_EVENT_FIELD');
  });

  test('event derivation never grants execution authorization', () => {
    const event = normalizeAssistantEvent({
      type:'funding_case_status_changed',
      boundary:'project:p-1',
      data:{ status:'under_review' }
    });
    const out = deriveEventPatch(event, {
      boundary:'project:p-1',
      open_tasks:[]
    });

    expect(out.authorization).toEqual({
      granted:false,
      source:'event_context_only'
    });
    expect(out.suggestions[0]).toMatchObject({
      type:'funding_next_step',
      execution_authorized:false
    });
  });

  test('applies event only inside the exact workflow boundary', async () => {
    loadWorkflowState.mockResolvedValue({
      workflow_key:'funding.case-1',
      boundary:'project:p-1',
      status:'active',
      version:4,
      state:{
        boundary:'project:p-1',
        goal:'Continue case',
        open_tasks:['analyze_uploaded_document'],
        required_data:[]
      }
    });
    saveWorkflowState.mockResolvedValue({
      workflow_key:'funding.case-1',
      boundary:'project:p-1',
      status:'active',
      version:5,
      state:{ boundary:'project:p-1' }
    });

    const out = await applyAssistantEvent({
      supabase:{ rpc:jest.fn() },
      userId:'user-1',
      workflowKey:'funding.case-1',
      event:{
        type:'document_analyzed',
        boundary:'project:p-1',
        resource_id:'doc-1'
      },
      expectedVersion:4
    });

    expect(saveWorkflowState).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1',
      workflowKey:'funding.case-1',
      boundary:'project:p-1',
      expectedVersion:4
    }));
    expect(out.execution_triggered).toBe(false);
    expect(out.authorization.granted).toBe(false);
  });

  test('fails closed on workflow boundary mismatch', async () => {
    loadWorkflowState.mockResolvedValue({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      version:1,
      state:{ boundary:'project:p-1' }
    });

    await expect(applyAssistantEvent({
      supabase:{ rpc:jest.fn() },
      userId:'user-1',
      workflowKey:'wf-1',
      event:{
        type:'page_changed',
        boundary:'project:p-2',
        data:{ page_key:'funding_case' }
      }
    })).rejects.toThrow('ASSISTANT_EVENT_BOUNDARY_CONFLICT');

    expect(saveWorkflowState).not.toHaveBeenCalled();
  });

  test('completed workflows do not accept context events', async () => {
    loadWorkflowState.mockResolvedValue({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'completed',
      version:3,
      state:{ boundary:'project:p-1' }
    });

    await expect(applyAssistantEvent({
      supabase:{ rpc:jest.fn() },
      userId:'user-1',
      workflowKey:'wf-1',
      event:{
        type:'workflow_resumed',
        boundary:'project:p-1'
      }
    })).rejects.toThrow('WORKFLOW_EVENT_STATUS_BLOCKED');
  });
});
