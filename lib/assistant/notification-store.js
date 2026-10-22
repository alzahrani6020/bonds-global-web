'use strict';

function clean(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function normalizeStoredNotification(notification) {
  if (!notification || typeof notification !== 'object') {
    throw new Error('INVALID_ASSISTANT_NOTIFICATION');
  }

  const id = clean(notification.id, 160);
  const eventId = clean(notification.event_id, 160);
  const eventType = clean(notification.event_type, 100);
  const boundary = clean(notification.boundary, 500);
  if (!id || !eventId || !eventType || !boundary) {
    throw new Error('INVALID_ASSISTANT_NOTIFICATION');
  }

  const action = notification.action && typeof notification.action === 'object'
    ? {
        type:clean(notification.action.type, 100),
        target:clean(notification.action.target, 160),
        execution_authorized:false
      }
    : null;

  return {
    notification_id:id,
    event_id:eventId,
    event_type:eventType,
    workflow_key:clean(notification.workflow_key, 160),
    boundary,
    resource_id:clean(notification.resource_id, 160),
    priority:['low','medium','high','critical'].includes(notification.priority)
      ? notification.priority
      : 'medium',
    title_ar:clean(notification.title_ar, 180),
    title_en:clean(notification.title_en, 180),
    message_ar:clean(notification.message_ar, 500),
    message_en:clean(notification.message_en, 500),
    action
  };
}

async function persistAssistantNotifications({ supabase, userId, notifications = [] }) {
  if (!userId) throw new Error('NOTIFICATION_USER_REQUIRED');
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return { persisted:0 };
  }

  const rows = notifications.map(notification => ({
    user_id:userId,
    ...normalizeStoredNotification(notification),
    updated_at:new Date().toISOString()
  }));

  const { error } = await supabase
    .from('assistant_notifications')
    .upsert(rows, {
      onConflict:'user_id,notification_id',
      ignoreDuplicates:true
    });

  if (error) throw new Error('NOTIFICATION_PERSIST_FAILED');
  return { persisted:rows.length };
}

async function listAssistantNotifications({
  supabase,
  userId,
  unreadOnly = false,
  limit = 25
}) {
  if (!userId) throw new Error('NOTIFICATION_USER_REQUIRED');

  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
  let query = supabase
    .from('assistant_notifications')
    .select('notification_id,event_id,event_type,workflow_key,boundary,resource_id,priority,title_ar,title_en,message_ar,message_en,action,read_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending:false })
    .limit(safeLimit);

  if (unreadOnly) query = query.is('read_at', null);

  const { data, error } = await query;
  if (error) throw new Error('NOTIFICATION_LIST_FAILED');

  return (data || []).map(row => ({
    id:row.notification_id,
    event_id:row.event_id,
    event_type:row.event_type,
    workflow_key:row.workflow_key,
    boundary:row.boundary,
    resource_id:row.resource_id,
    priority:row.priority,
    title_ar:row.title_ar,
    title_en:row.title_en,
    message_ar:row.message_ar,
    message_en:row.message_en,
    action:row.action,
    read:Boolean(row.read_at),
    read_at:row.read_at,
    created_at:row.created_at,
    policy:{
      informational_only:true,
      auto_execute:false,
      authorization_granted:false
    }
  }));
}

async function markAssistantNotificationRead({
  supabase,
  userId,
  notificationId
}) {
  if (!userId) throw new Error('NOTIFICATION_USER_REQUIRED');
  const id = clean(notificationId, 160);
  if (!id) throw new Error('INVALID_NOTIFICATION_ID');

  const readAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('assistant_notifications')
    .update({ read_at:readAt, updated_at:readAt })
    .eq('user_id', userId)
    .eq('notification_id', id)
    .select('notification_id,read_at')
    .maybeSingle();

  if (error) throw new Error('NOTIFICATION_READ_FAILED');
  if (!data) throw new Error('NOTIFICATION_NOT_FOUND');

  return {
    id:data.notification_id,
    read:true,
    read_at:data.read_at
  };
}

module.exports = {
  normalizeStoredNotification,
  persistAssistantNotifications,
  listAssistantNotifications,
  markAssistantNotificationRead
};
