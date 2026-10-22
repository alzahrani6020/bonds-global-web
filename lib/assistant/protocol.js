'use strict';

const contract = require('./assistant-protocol.contract.json');
const navigationRegistry = require('./navigation-registry.json');
const formRegistry = require('./form-registry.json');
const {
  evaluateAssistantActionPolicy,
  hasForbiddenPolicyField
} = require('./policy-engine');

const PROTOCOL = contract.protocol;

function hasForbiddenField(value) {
  return hasForbiddenPolicyField(value);
}

function actionId(index = 0) {
  return `action-${String(index + 1).padStart(3, '0')}`;
}

function normalizeAction(action, index = 0) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new Error('INVALID_ACTION');
  }
  const type = String(action.type || '').trim();
  const capability = String(action.capability || type).trim();
  const risk = String(action.risk || 'low').trim();

  const policyDecision=evaluateAssistantActionPolicy({
    ...action,
    type,
    risk
  });
  if (policyDecision.decision === 'deny') {
    throw new Error(policyDecision.code || 'ASSISTANT_POLICY_DENIED');
  }

  return {
    id: String(action.id || actionId(index)),
    type,
    capability,
    target: action.target == null ? null : String(action.target),
    input: action.input && typeof action.input === 'object' && !Array.isArray(action.input)
      ? action.input
      : {},
    risk,
    requires_confirmation: policyDecision.requires_confirmation,
    status: String(action.status || 'ready')
  };
}

function createEnvelope({ reply = '', status = 'ready', actions = [], ui = [], context = {} } = {}) {
  const normalizedActions = actions.map(normalizeAction);
  return {
    protocol: PROTOCOL,
    status,
    reply: String(reply || ''),
    actions: normalizedActions,
    ui: Array.isArray(ui) ? ui : [],
    context: context && typeof context === 'object' && !Array.isArray(context) ? context : {}
  };
}

function resolveNavigation(target, language = 'ar') {
  const key = String(target || '').trim();
  const entry = navigationRegistry.destinations[key];
  if (!entry) return null;
  const locale = language === 'en' ? 'en' : 'ar';
  return { key, ...entry, route: entry.routes[locale] || entry.routes.ar };
}

function resolveForm(formCode) {
  const key = String(formCode || '').trim();
  const entry = formRegistry.forms[key];
  if (!entry) return null;
  return { key, ...entry };
}

function planRegisteredAction({ type, target, form, language = 'ar' } = {}) {
  if (type === 'site_navigate') {
    const destination = resolveNavigation(target, language);
    if (!destination) {
      return createEnvelope({
        status: 'denied',
        reply: 'الوجهة المطلوبة غير مسجلة.',
        context: { code: 'NAVIGATION_TARGET_NOT_REGISTERED' }
      });
    }
    return createEnvelope({
      reply: 'الوجهة معتمدة وجاهزة للانتقال.',
      actions: [{ type:'site_navigate', capability:'site_navigate', target:destination.key, risk:'low' }],
      ui: [{ type:'navigation_card', action_id:'action-001', label:destination.key }],
      context: { navigation: { target: destination.key, route: destination.route } }
    });
  }

  if (type === 'form_find' || type === 'form_load') {
    const formEntry = resolveForm(form);
    if (!formEntry) {
      return createEnvelope({
        status: 'denied',
        reply: 'النموذج المطلوب غير مسجل.',
        context: { code: 'FORM_NOT_REGISTERED' }
      });
    }
    const destination = resolveNavigation(formEntry.navigation_target, language);
    return createEnvelope({
      reply: type === 'form_find' ? 'تم العثور على النموذج المسجل.' : 'النموذج المسجل جاهز للتحميل.',
      actions: [{
        type,
        capability:type,
        target:formEntry.key,
        input:{ navigation_target: formEntry.navigation_target },
        risk:'low'
      }],
      ui: [{ type:'form_card', action_id:'action-001', form:formEntry.key }],
      context: {
        form: formEntry,
        navigation: destination ? { target: destination.key, route: destination.route } : null
      }
    });
  }

  if (type === 'form_save_draft') {
    const formEntry = resolveForm(form);
    if (!formEntry) {
      return createEnvelope({
        status:'denied',
        reply:'النموذج المطلوب غير مسجل.',
        context:{ code:'FORM_NOT_REGISTERED' }
      });
    }
    return createEnvelope({
      reply:'مسودة النموذج جاهزة للحفظ عبر محول الصفحة المسجل.',
      actions:[{
        type:'form_save_draft',
        capability:'form_save_draft',
        target:formEntry.key,
        input:{ navigation_target:formEntry.navigation_target },
        risk:formEntry.risk?.save_draft || 'medium'
      }],
      ui:[{ type:'form_card', action_id:'action-001', form:formEntry.key }],
      context:{ form:formEntry }
    });
  }

  return createEnvelope({
    status:'denied',
    reply:'هذا الإجراء غير مدعوم في مرحلة التخطيط الحالية.',
    context:{ code:'ASSISTANT_ACTION_NOT_IMPLEMENTED' }
  });
}

module.exports = {
  PROTOCOL,
  createEnvelope,
  normalizeAction,
  resolveNavigation,
  resolveForm,
  planRegisteredAction,
  hasForbiddenField
};
