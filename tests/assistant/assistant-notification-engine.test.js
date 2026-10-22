/** @jest-environment node */

const {
  notificationId,
  notificationsFromAssistantEvent
} = require('../../lib/assistant/notification-engine');

describe('assistant structured notifications', () => {
  const workflow = {
    workflow_key:'funding.case-1',
    boundary:'project:p-1'
  };

  test('notification ids are deterministic for the same event identity', () => {
    const parts = ['funding.case-1','event-1','document_uploaded','doc-1'];
    expect(notificationId(parts)).toBe(notificationId(parts));
  });

  test('document upload creates a structured non-executable notification', () => {
    const notifications = notificationsFromAssistantEvent({
      workflow,
      event:{
        id:'event-1',
        type:'document_uploaded',
        boundary:'project:p-1',
        resource_id:'doc-1'
      },
      suggestions:[{
        type:'document_find',
        execution_authorized:false
      }]
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      source:'assistant_event',
      event_type:'document_uploaded',
      priority:'medium',
      action:{
        type:'document_find',
        target:'doc-1',
        execution_authorized:false
      },
      policy:{
        informational_only:true,
        auto_execute:false,
        authorization_granted:false
      }
    });
    expect(notifications[0].action.url).toBeUndefined();
    expect(notifications[0].action.href).toBeUndefined();
  });

  test('funding status change suggests review without executing it', () => {
    const [notification] = notificationsFromAssistantEvent({
      workflow,
      event:{
        id:'event-2',
        type:'funding_case_status_changed',
        boundary:'project:p-1',
        data:{ status:'under_review' }
      },
      suggestions:[{ type:'funding_next_step', execution_authorized:false }]
    });

    expect(notification.priority).toBe('high');
    expect(notification.action.type).toBe('funding_next_step');
    expect(notification.action.execution_authorized).toBe(false);
    expect(notification.policy.auto_execute).toBe(false);
  });

  test('page changes do not generate notification noise', () => {
    expect(notificationsFromAssistantEvent({
      workflow,
      event:{
        type:'page_changed',
        boundary:'project:p-1',
        data:{ page_key:'funding_case' }
      },
      suggestions:[]
    })).toEqual([]);
  });

  test('document analysis warns that extracted data remains uncommitted', () => {
    const [notification] = notificationsFromAssistantEvent({
      workflow,
      event:{
        id:'event-3',
        type:'document_analyzed',
        boundary:'project:p-1',
        resource_id:'doc-2'
      },
      suggestions:[{ type:'document_find', execution_authorized:false }]
    });

    expect(notification.message_ar).toContain('دون تأكيد');
    expect(notification.policy.authorization_granted).toBe(false);
  });
});
