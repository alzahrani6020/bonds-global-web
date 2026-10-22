/** @jest-environment node */

const { EventEmitter } = require('events');

const mockList = jest.fn();
const mockRead = jest.fn();
const mockPersist = jest.fn();

jest.mock('../../lib/assistant/notification-store', () => ({
  persistAssistantNotifications:(args) => mockPersist(args),
  listAssistantNotifications:(args) => mockList(args),
  markAssistantNotificationRead:(args) => mockRead(args)
}));

jest.mock('../../lib/assistant/event-driven', () => ({
  applyAssistantEvent:jest.fn()
}));

jest.mock('../../lib/assistant/notification-engine', () => ({
  notificationsFromAssistantEvent:jest.fn()
}));

jest.mock('../../lib/assistant/audit-trail', () => ({
  appendAssistantAuditBestEffort:jest.fn()
}));

const mockSupabase = {};
jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient:() => mockSupabase
}));

const { assistantRouter } = require('../../v3/api/assistant');

function response(done) {
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[k.toLowerCase()] = v; },
    end(v){ done({ statusCode:this.statusCode, body:v ? JSON.parse(v) : null }); }
  };
}

function getReq(url) {
  const req = new EventEmitter();
  req.method = 'GET';
  req.url = url;
  return req;
}

function postReq(body, url) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.url = url;
  process.nextTick(() => {
    req.emit('data', Buffer.from(JSON.stringify(body || {})));
    req.emit('end');
  });
  return req;
}

describe('assistant notifications API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lists only the authenticated user notifications', async () => {
    mockList.mockResolvedValue([{
      id:'n-1',
      read:false,
      priority:'high'
    }]);

    const out = await new Promise(resolve => assistantRouter(
      getReq('/api/v3/assistant/notifications?unread=1&limit=10'),
      response(resolve),
      '/assistant/notifications',
      { id:'user-1' }
    ));

    expect(out.statusCode).toBe(200);
    expect(out.body.unread_count).toBe(1);
    expect(mockList).toHaveBeenCalledWith({
      supabase:mockSupabase,
      userId:'user-1',
      unreadOnly:true,
      limit:'10'
    });
  });

  test('marks only the authenticated user notification as read', async () => {
    mockRead.mockResolvedValue({
      id:'n-1',
      read:true,
      read_at:'2026-10-22T01:00:00Z'
    });

    const out = await new Promise(resolve => assistantRouter(
      postReq({ notification_id:'n-1' }, '/api/v3/assistant/notifications/read'),
      response(resolve),
      '/assistant/notifications/read',
      { id:'user-1' }
    ));

    expect(out.statusCode).toBe(200);
    expect(out.body.notification.read).toBe(true);
    expect(mockRead).toHaveBeenCalledWith({
      supabase:mockSupabase,
      userId:'user-1',
      notificationId:'n-1'
    });
  });

  test('requires authentication for notification inbox', async () => {
    const out = await new Promise(resolve => assistantRouter(
      getReq('/api/v3/assistant/notifications'),
      response(resolve),
      '/assistant/notifications',
      null
    ));

    expect(out.statusCode).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });
});
