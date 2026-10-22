/** @jest-environment node */

const mockListOwnedDrafts = jest.fn();
const mockListNotifications = jest.fn();

jest.mock('../../lib/assistant/draft-center', () => ({
  listOwnedDrafts:(args) => mockListOwnedDrafts(args)
}));
jest.mock('../../lib/assistant/notification-store', () => ({
  listAssistantNotifications:(args) => mockListNotifications(args)
}));

const {
  workflowInboxItems,
  listWorkflowInboxItems,
  unreadNotificationSignals,
  buildAgentInbox
} = require('../../lib/assistant/agent-inbox');

function workflowQuery(result) {
  const state={ filters:[], statusFilters:[], select:null, order:null, limit:null };
  const q={
    select(v){ state.select=v; return q; },
    eq(k,v){ state.filters.push([k,v]); return q; },
    in(k,v){ state.statusFilters.push([k,v]); return q; },
    order(k,v){ state.order=[k,v]; return q; },
    limit(v){ state.limit=v; return q; },
    then(resolve){ return Promise.resolve(result).then(resolve); }
  };
  return { q,state };
}

describe('assistant agent inbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListOwnedDrafts.mockResolvedValue({
      drafts:[],
      partial:false,
      policy:{ read_only:true, write_allowed:false, submit_allowed:false, execution_authorized:false }
    });
    mockListNotifications.mockResolvedValue([]);
  });

  test('derives only user-waiting workflow items and never exposes confirmation payload', () => {
    const items=workflowInboxItems({
      workflow_key:'funding.case-1',
      boundary:'project:p-1',
      status:'active',
      version:3,
      updated_at:'2026-10-22T12:00:00Z',
      state:{
        boundary:'project:p-1',
        goal:'Complete funding file',
        current_stage:'documents',
        required_data:['commercial_registration'],
        open_tasks:['upload_bank_statement'],
        pending_confirmation:{
          status:'pending',
          token:'must-not-be-exposed',
          payload:'must-not-be-exposed'
        }
      }
    });

    expect(items.map(x=>x.type).sort()).toEqual(['confirmation','open_task','required_data']);
    const confirmation=items.find(x=>x.type==='confirmation');
    expect(confirmation).not.toHaveProperty('pending_confirmation');
    expect(JSON.stringify(confirmation)).not.toContain('must-not-be-exposed');
    expect(items.every(x=>x.waiting_on_user===true)).toBe(true);
    expect(items.every(x=>x.execution_authorized===false)).toBe(true);
  });

  test('workflow source is explicitly user scoped and limited to active or paused', async () => {
    const {q,state}=workflowQuery({ data:[], error:null });
    const supabase={ from:jest.fn(() => q) };
    await listWorkflowInboxItems({ supabase, userId:'user-1', limit:12 });

    expect(supabase.from).toHaveBeenCalledWith('assistant_workflow_state');
    expect(state.filters).toContainEqual(['user_id','user-1']);
    expect(state.statusFilters).toContainEqual(['status',['active','paused']]);
    expect(state.limit).toBe(12);
  });

  test('unread notification signals strip execution authority from actions', () => {
    const signals=unreadNotificationSignals([{
      id:'n-1',
      read:false,
      priority:'high',
      event_type:'document_uploaded',
      workflow_key:'wf-1',
      boundary:'project:p-1',
      action:{ type:'document_find', target:'doc-1', execution_authorized:true }
    }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].action.execution_authorized).toBe(false);
    expect(signals[0].informational_only).toBe(true);
  });

  test('combines workflows, drafts and unread notification context without write authority', async () => {
    const {q}=workflowQuery({
      data:[{
        workflow_key:'wf-1',
        boundary:'project:p-1',
        status:'paused',
        version:2,
        updated_at:'2026-10-22T12:00:00Z',
        state:{
          boundary:'project:p-1',
          required_data:['bank_statement'],
          open_tasks:[],
          pending_confirmation:null
        }
      }],
      error:null
    });
    const supabase={ from:jest.fn(() => q) };

    mockListOwnedDrafts.mockResolvedValue({
      drafts:[{
        id:'draft-1',
        form_code:'cash_flow',
        status:'draft',
        navigation_target:'cash_flow',
        updated_at:'2026-10-22T11:00:00Z'
      }],
      partial:false
    });
    mockListNotifications.mockResolvedValue([{
      id:'n-1', read:false, priority:'medium', event_type:'form_saved',
      boundary:'project:p-1', action:null
    }]);

    const out=await buildAgentInbox({ supabase, userId:'user-1' });
    expect(out.items.map(x=>x.type).sort()).toEqual(['draft','required_data']);
    expect(out.unread_notification_count).toBe(1);
    expect(out.policy).toEqual({
      read_only:true,
      write_allowed:false,
      submit_allowed:false,
      auto_execute:false,
      execution_authorized:false
    });
  });

  test('keeps available sources when one inbox source fails', async () => {
    const {q}=workflowQuery({ data:[], error:{ message:'down' } });
    const supabase={ from:jest.fn(() => q) };
    mockListOwnedDrafts.mockResolvedValue({
      drafts:[{ id:'d-1', form_code:'kyc', status:'draft', navigation_target:'kyc' }],
      partial:false
    });
    mockListNotifications.mockResolvedValue([]);

    const out=await buildAgentInbox({ supabase, userId:'user-1' });
    expect(out.partial).toBe(true);
    expect(out.items).toHaveLength(1);
    expect(out.source_status).toContainEqual(expect.objectContaining({
      source:'workflows', status:'unavailable'
    }));
  });
});
