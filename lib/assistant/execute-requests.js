'use strict';

const { createEnvelope, planRegisteredAction, resolveForm } = require('./protocol');

const FORM_NAMES = [
  ['kyc', /اعرف عميلك|هوية العميل|\bkyc\b/iu],
  ['establishment', /المنش[أا]ة|المنش[أا]ه|establishment|company (?:details|information)/iu],
  ['activity', /النشاط|activity/iu],
  ['cash_flow', /التدفق|تدفقات|cash.flow/iu],
  ['receivables', /الذمم المدينة|المستحقات المدينة|receivables/iu],
  ['payables', /الذمم الدائنة|المستحقات الدائنة|payables/iu]
];

// Resolve on-site form commands before public research. This only prepares
// registered UI actions; existing plan/entitlement/idempotency gates execute them.
function resolveExecuteRequest(message, context = {}, options = {}) {
  if (options.conversationMode !== 'execute') return null;
  const text = String(message || '').trim();
  const en = options.language === 'en' || !/[\u0600-\u06ff]/u.test(text);
  const localCommand = /(?:ابحث|افتح|حم[ّ]?ل|احفظ|امل[أا]|عب[ّ]?ئ|find|open|load|save|fill|prefill)/iu.test(text);
  const formRequest = /نموذج|نماذج|مسودة|\b(?:form|draft)\b/iu.test(text);
  if (!localCommand || !formRequest) return null;
  // Explicit internet research is not an on-site form request.
  if (/ويكيبيديا|wikipedia|في (?:الانترنت|الإنترنت|الويب)|on the (?:web|internet)/iu.test(text)) return null;

  const form = FORM_NAMES.find(([, pattern]) => pattern.test(text))?.[0] ||
    (/الحالي|الحالية|current|this form/iu.test(text)
      ? FORM_NAMES.find(([key]) => resolveForm(key)?.navigation_target &&
          String(context.pagePath || '').split('?')[0].replace(/\/$/, '').endsWith(
            ({ kyc:'/client/kyc', establishment:'/client/establishment-information', activity:'/client/business-activity', cash_flow:'/client/cash-flow' })[key] || '/__unmatched__'
          ))?.[0]
      : null);
  const save = /احفظ|حفظ|\bsave\b/iu.test(text);
  const fill = /امل[أا]|عب[ّ]?ئ|\b(?:fill|prefill)\b/iu.test(text);
  const load = /افتح|حم[ّ]?ل|\b(?:open|load)\b/iu.test(text);
  if (form) {
    if (fill) {
      return createEnvelope({
        reply:en ? 'Open the registered form and specify the suggested fields. Nothing has been filled or saved.'
          : 'افتح النموذج المسجل وحدد الحقول المقترحة. لم تُعبأ حقول ولم تُحفظ بيانات.',
        actions:planRegisteredAction({ type:'form_load', form, language:en ? 'en' : 'ar' }).actions
      });
    }
    const plan = planRegisteredAction({ type:save ? 'form_save_draft' : load ? 'form_load' : 'form_find', form, language:en ? 'en' : 'ar' });
    if (save) plan.reply = en ? 'Draft saving is ready for this form. Use the action below; no draft has been saved yet.'
      : 'إجراء حفظ المسودة جاهز لهذا النموذج. استخدم الزر أدناه؛ لم تُحفظ مسودة بعد.';
    return plan;
  }
  // Never invent a funding-request form code or a saved draft. Offer registered
  // forms and ask the user to select one when the requested form is ambiguous.
  const choices = /تمويل|funding|financ/iu.test(text)
    ? ['kyc','establishment','activity'] : FORM_NAMES.map(([key]) => key);
  return createEnvelope({
    status:'needs_input',
    reply:en ? 'Choose the registered form to open or save. No data has been saved.'
      : 'اختر النموذج المسجل الذي تريد فتحه أو حفظ مسودته. لم تُحفظ بيانات.',
    actions:choices.map(form => ({ type:'form_load', capability:'form_load', target:form, risk:'low' }))
  });
}

module.exports = { resolveExecuteRequest };
