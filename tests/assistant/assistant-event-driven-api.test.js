/** @jest-environment node */

const { EventEmitter } = require('events');

const mockApplyAssistantEvent = jest.fn();
const mockAppendAudit = jest.fn();
const mockSupabase = { rpc:jest.fn() };

jest.mock('../../lib/assistant/event-driven', () => ({
  applyAssistantEvent:(args) => mockApplyAssistantEvent(args)
}));

jest.mock('../../lib/assistant/audit-trail', () => ({
  appendAssistantAuditBestEffort:(args) => mockAppendAudit(args)
}));

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient:() => mockSupabase
}));

const { assistantRouter } = require('../../v3/api/assistant');

function req(body) {
  const r = new EventEmitter();
  r.method = 'POST';
  process.nextTick(() => {
    r.emit('data', Buffer.from(JSON.stringify(body || {})));
    r.emit('end');
  });
  return r;
}

function res(done) {
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[k.toLowerCase()] = v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}

function call(body, user={ id:'user-1' }) {
  return new Promise(resolve => assistantRouter(
    req(body), res(resolve), '/assistant/events/apply', user
  ));
}

describe('event-driven assistant API lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppendAudit.mockResolvedValue({ ok:true });
  });

  test('records received then applied for a new event', async () => {
    mockApplyAssistantEvent.mockResolvedValue({
      event:{ id:'evt-1', type:'document_uploaded', boundary:'project:p-1', resource_id:'doc-1' },
      workflow:{ workflow_key:'wf-1', version:2 },
      suggestions:[{ type:'document_find', execution_authorized:false }],
      notifications:[],
      authorization:{ granted:false, source:'event_context_only' },
      execution_triggered:false,
      replayed:false
    });

    const out = await call({
      workflow_key:'wf-1',
      expected_version:1,
      session_id:'session-1',
      event:{ id:'evt-1', type:'document_uploaded', boundary:'project:p-1', resource_id:'doc-1' }
    });

    expect(out.statusCode).toBe(200);
    expect(out.body.status).toBe('completed');
    expect(out.body.replayed).toBe(false);
    expect(mockApplyAssistantEvent).toHaveBeenCalledWith(expect.objectContaining({
      supabase:mockSupabase,
      userId:'user-1',
      workflowKey:'wf-1',
      expectedVersion:1
    }));
    expect(mockAppendAudit.mock.calls.map(call => call[0].eventType)).toEqual([
      'event_received',
      'event_applied'
    ]);
  });

  test('records replay without duplicate notifications or execution', async () => {
    mockApplyAssistantEvent.mockResolvedValue({
      event:{ id:'evt-1', type:'document_uploaded', boundary:'project:p-1', resource_id:'doc-1' },
      workflow:{ workflow_key:'wf-1', version:2 },
      suggestions:[],
      notifications:[],
      authorization:{ granted:false, source:'event_context_only' },
      execution_triggered:false,
      replayed:true
    });

    const out = await call({
      workflow_key:'wf-1',
      event:{ id:'evt-1', type:'document_uploaded', boundary:'project:p-1', resource_id:'doc-1' }
    });

    expect(out.statusCode).toBe(200);
    expect(out.body.replayed).toBe(true);
    expect(out.body.notifications).toEqual([]);
    expect(out.body.execution_triggered).toBe(false);
    expect(out.body.authorization.granted).toBe(false);
    expect(mockAppendAudit.mock.calls.map(call => call[0].eventType)).toEqual([
      'event_received',
      'event_replayed'
    ]);
  });

  test('records denied event and returns a client error for missing event id', async () => {
    mockApplyAssistantEvent.mockRejectedValue(new Error('ASSISTANT_EVENT_ID_REQUIRED'));

    const out = await call({
      workflow_key:'wf-1',
      event:{ type:'page_changed', boundary:'project:p-1' }
    });

    expect(out.statusCode).toBe(422);
    expect(out.body.status).toBe('denied');
    expect(out.body.error).toBe('ASSISTANT_EVENT_ID_REQUIRED');
    expect(mockAppendAudit.mock.calls.map(call => call[0].eventType)).toEqual([
      'event_received',
      'event_denied'
    ]);
  });
});
