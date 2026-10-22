'use strict';

const crypto = require('crypto');

const PRIORITIES = new Set(['low','medium','high','critical']);

function clean(value, max = 300) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function notificationId(parts) {
  const source = parts.filter(Boolean).join('|');
  return 'assistant-notification-' + crypto.createHash('sha256').update(source).digest('hex').slice(0, 24);
}

function makeNotification({
  event,
  workflow,
  priority = 'medium',
  titleAr,
  titleEn,
  messageAr,
  messageEn,
  actionType = null,
  actionTarget = null
}) {
  const safePriority = PRIORITIES.has(priority) ? priority : 'medium';
  const action = actionType ? {
    type:actionType,
    target:clean(actionTarget, 160),
    execution_authorized:false
  } : null;

  return {
    id:notificationId([
      workflow && workflow.workflow_key,
      event && event.id,
      event && event.type,
      event && event.resource_id,
      event && event.occurred_at
    ]),
    source:'assistant_event',
    event_type:event.type,
    workflow_key:clean(workflow && workflow.workflow_key, 160),
    boundary:clean(event.boundary, 500),
    resource_id:clean(event.resource_id, 160),
    priority:safePriority,
    title_ar:clean(titleAr, 180),
    title_en:clean(titleEn, 180),
    message_ar:clean(messageAr, 500),
    message_en:clean(messageEn, 500),
    action,
    read:false,
    policy:{
      informational_only:true,
      auto_execute:false,
      authorization_granted:false
    }
  };
}

function notificationsFromAssistantEvent({ event, workflow, suggestions = [] }) {
  if (!event || !event.type) return [];

  const firstSuggestion = Array.isArray(suggestions) ? suggestions[0] : null;
  const actionType = firstSuggestion && firstSuggestion.type
    ? String(firstSuggestion.type)
    : null;

  switch (event.type) {
    case 'form_saved':
      return [makeNotification({
        event,
        workflow,
        priority:'low',
        titleAr:'تم حفظ المسودة',
        titleEn:'Draft saved',
        messageAr:'تم حفظ النموذج. يمكن للمساعد مراجعة الخطوة التالية عند طلبك.',
        messageEn:'The form was saved. The assistant can review the next step when requested.',
        actionType:actionType || 'funding_next_step'
      })];

    case 'document_uploaded':
      return [makeNotification({
        event,
        workflow,
        priority:'medium',
        titleAr:'تم رفع مستند',
        titleEn:'Document uploaded',
        messageAr:'المستند متاح للتحليل والمراجعة داخل نطاق سير العمل الحالي.',
        messageEn:'The document is available for analysis and review within the current workflow boundary.',
        actionType:actionType || 'document_find',
        actionTarget:event.resource_id
      })];

    case 'document_analyzed':
      return [makeNotification({
        event,
        workflow,
        priority:'medium',
        titleAr:'اكتمل تحليل المستند',
        titleEn:'Document analysis completed',
        messageAr:'نتائج التصنيف والاستخراج أصبحت جاهزة للمراجعة. لا يتم اعتمادها كبيانات عمل دون تأكيد.',
        messageEn:'Classification and extraction results are ready for review. They are not committed as business data without confirmation.',
        actionType:actionType || 'document_find',
        actionTarget:event.resource_id
      })];

    case 'funding_case_status_changed':
      return [makeNotification({
        event,
        workflow,
        priority:'high',
        titleAr:'تغيرت حالة ملف التمويل',
        titleEn:'Funding case status changed',
        messageAr:'تم تحديث حالة ملف التمويل. راجع الخطوة التالية قبل أي إجراء.',
        messageEn:'The funding case status changed. Review the next step before any action.',
        actionType:actionType || 'funding_next_step'
      })];

    case 'workflow_resumed':
      return [makeNotification({
        event,
        workflow,
        priority:'low',
        titleAr:'تم استئناف سير العمل',
        titleEn:'Workflow resumed',
        messageAr:'تم استئناف السياق السابق ويمكن متابعة المهام المفتوحة.',
        messageEn:'The previous workflow context was resumed and open tasks can be continued.',
        actionType:actionType || 'funding_next_step'
      })];

    case 'page_changed':
    default:
      return [];
  }
}

module.exports = {
  PRIORITIES,
  notificationId,
  makeNotification,
  notificationsFromAssistantEvent
};
