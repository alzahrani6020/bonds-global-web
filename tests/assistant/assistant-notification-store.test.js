/** @jest-environment node */

const {
  normalizeStoredNotification,
  persistAssistantNotifications,
  listAssistantNotifications,
  markAssistantNotificationRead
} = require('../../lib/assistant/notification-store');

describe('assistant durable notification store', () => {
  test('normalization strips execution authority from notification actions', () => {
    expect(normalizeStoredNotification({
      id:'n-1',
      event_id:'e-1',
      event_type:'document_uploaded',
      boundary:'project:p-1',
      priority:'medium',
      action:{ type:'document_find', target:'doc-1', execution_authorized:true }
    })).toMatchObject({
      notification_id:'n-1',
      event_id:'e-1',
      event_type:'document_uploaded',
      boundary:'project:p-1',
      action:{
        type:'document_find',
        target:'doc-1',
        execution_authorized:false
      }
    });
  });

  test('persistence is user-scoped and deduplicated by composite key', async () => {
    const upsert = jest.fn().mockResolvedValue({ error:null });
    const supabase = {
      from:jest.fn(() => ({ upsert }))
    };

    const out = await persistAssistantNotifications({
      supabase,
      userId:'user-1',
      notifications:[{
        id:'n-1',
        event_id:'e-1',
        event_type:'document_uploaded',
        boundary:'project:p-1',
        priority:'medium'
      }]
    });

    expect(out).toEqual({ persisted:1 });
    expect(supabase.from).toHaveBeenCalledWith('assistant_notifications');
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({
        user_id:'user-1',
        notification_id:'n-1',
        event_id:'e-1'
      })],
      expect.objectContaining({
        onConflict:'user_id,notification_id'
      })
    );
  });

  test('list filters by user ownership and optional unread state', async () => {
    const result = {
      data:[{
        notification_id:'n-1',
        event_id:'e-1',
        event_type:'document_uploaded',
        boundary:'project:p-1',
        priority:'medium',
        read_at:null,
        created_at:'2026-10-22T00:00:00Z'
      }],
      error:null
    };

    const builder = {
      select:jest.fn().mockReturnThis(),
      eq:jest.fn().mockReturnThis(),
      order:jest.fn().mockReturnThis(),
      limit:jest.fn().mockReturnThis(),
      is:jest.fn().mockResolvedValue(result),
      then(resolve){ return Promise.resolve(result).then(resolve); }
    };
    const supabase = { from:jest.fn(() => builder) };

    const rows = await listAssistantNotifications({
      supabase,
      userId:'user-1',
      unreadOnly:true,
      limit:25
    });

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.is).toHaveBeenCalledWith('read_at', null);
    expect(rows[0]).toMatchObject({ id:'n-1', read:false });
  });

  test('mark read requires both user id and notification id ownership filters', async () => {
    const result = {
      data:{ notification_id:'n-1', read_at:'2026-10-22T01:00:00Z' },
      error:null
    };
    const builder = {
      update:jest.fn().mockReturnThis(),
      eq:jest.fn().mockReturnThis(),
      select:jest.fn().mockReturnThis(),
      maybeSingle:jest.fn().mockResolvedValue(result)
    };
    const supabase = { from:jest.fn(() => builder) };

    const out = await markAssistantNotificationRead({
      supabase,
      userId:'user-1',
      notificationId:'n-1'
    });

    expect(builder.eq.mock.calls).toEqual([
      ['user_id','user-1'],
      ['notification_id','n-1']
    ]);
    expect(out).toMatchObject({ id:'n-1', read:true });
  });
});
