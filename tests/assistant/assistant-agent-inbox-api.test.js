/** @jest-environment node */

const { EventEmitter } = require('events');
const mockBuildAgentInbox = jest.fn();

jest.mock('../../lib/assistant/agent-inbox', () => ({
  buildAgentInbox:(args) => mockBuildAgentInbox(args)
}));
jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient:() => ({ from:jest.fn(), rpc:jest.fn() })
}));

const { assistantRouter } = require('../../v3/api/assistant');

function reqGet() {
  const req=new EventEmitter();
  req.method='GET';
  req.url='/api/v3/assistant/inbox';
  return req;
}
function res(done) {
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[String(k).toLowerCase()]=v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}
function call(user={ id:'user-1' }) {
  return new Promise(resolve => assistantRouter(reqGet(),res(resolve),'/assistant/inbox',user));
}

describe('assistant agent inbox API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildAgentInbox.mockResolvedValue({
      version:1,
      items:[],
      counts:{},
      unread_notifications:[],
      unread_notification_count:0,
      partial:false,
      source_status:[],
      policy:{
        read_only:true,
        write_allowed:false,
        submit_allowed:false,
        auto_execute:false,
        execution_authorized:false
      }
    });
  });

  test('requires authentication', async () => {
    const out=await call(null);
    expect(out.statusCode).toBe(401);
    expect(mockBuildAgentInbox).not.toHaveBeenCalled();
  });

  test('returns the user scoped read-only inbox', async () => {
    const out=await call({ id:'user-1' });
    expect(out.statusCode).toBe(200);
    expect(out.body.status).toBe('completed');
    expect(out.body.agent_inbox.policy.execution_authorized).toBe(false);
    expect(mockBuildAgentInbox).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1'
    }));
  });

  test('does not convert source failure into execution authority', async () => {
    mockBuildAgentInbox.mockRejectedValue(new Error('AGENT_INBOX_UNAVAILABLE'));
    const out=await call({ id:'user-1' });
    expect(out.statusCode).toBe(503);
    expect(out.body.status).toBe('denied');
  });
});
