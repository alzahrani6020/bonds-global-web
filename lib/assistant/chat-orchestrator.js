'use strict';

const crypto = require('crypto');
const { executeService, loadExecutionProfile } = require('../services/service-execution-router');
const { createHumanEscalation } = require('./human-escalation');
const { persistCaseState, nextBestAction } = require('./case-engine');

const CHAT_ORCHESTRATOR_VERSION = 1;

function clean(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function normalizePath(value) {
  const path = clean(value, 500) || '/';
  const noQuery = path.split('?')[0].split('#')[0] || '/';
  if (!noQuery.startsWith('/')) return '/';
  return noQuery.replace(/\/{2,}/g, '/');
}

function isHomepage(path) {
  return ['/', '/index.html', '/en', '/en/', '/en/index.html'].includes(normalizePath(path));
}

function resolveIntent(message) {
  const text = String(message || '').toLowerCase();
  if (/(بشري|موظف|مستشار|تصعيد|انسان|إنسان|human|advisor|agent)/i.test(text)) return 'escalation';
  if (/(مستند|وثيق|ارفق|أرفق|ارفع|ملف|document|upload|attach)/i.test(text)) return 'document';
  if (/(نفذ|نفّذ|ابدأ|ابدء|شغل|شغّل|ارسال|إرسال|اعتمد|execute|run|submit)/i.test(text)) return 'execution';
  if (/(احسب|حساب|كم|نسبة|هامش|تدفق|قيمة|تقييم|سيناريو|calculate|valuation|cash flow|scenario)/i.test(text)) return 'calculation';
  if (/(حلل|تحليل|مخاطر|جدوى|ائتمان|تمويل|analysis|risk|feasibility|credit)/i.test(text)) return 'analysis';
  if (/(متابعة|أين وصل|وين وصل|الحالة|التالي|next|status|follow)/i.test(text)) return 'follow_up';
  return 'information';
}

function asksCurrentService(message) {
  return /(ما الخدمة.*(موجود|انا|أنا)|أي خدمة.*(موجود|انا|أنا)|الخدمة الحالية|current service|which service)/i.test(String(message || ''));
}

function workflowKeyFor(boundary) {
  const digest = crypto.createHash('sha256').update(boundary).digest('hex').slice(0, 32);
  return `assistant-case:${digest}`;
}

function userIdOf(user) {
  return user?.id || user?.user?.id || user?.sub || null;
}

function uiCard(type, title, body, extra = {}) {
  return { type, title, body, ...extra };
}

async function serviceFromPage({ supabase, pagePath }) {
  if (!supabase || isHomepage(pagePath)) return null;
  const path = normalizePath(pagePath);
  const { data, error } = await supabase
    .from('service_catalog')
    .select('id,code,name_ar,name_en,default_route_ar,default_route_en,status,is_active')
    .eq('status', 'published')
    .eq('is_active', true)
    .or(`default_route_ar.eq.${path},default_route_en.eq.${path}`)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

function missingRequirements(context) {
  const requirements = Array.isArray(context?.serviceRequirements) ? context.serviceRequirements : [];
  const facts = context?.confirmedFacts && typeof context.confirmedFacts === 'object'
    ? context.confirmedFacts
    : {};
  return requirements
    .filter(row => row?.required === true)
    .map(row => row.label)
    .filter(label => label && facts[label] === undefined)
    .slice(0, 25);
}

function executionInputs(context, assistantState) {
  return {
    ...(assistantState?.confirmed_facts && typeof assistantState.confirmed_facts === 'object'
      ? assistantState.confirmed_facts
      : {}),
    ...(context?.calculationInputs && typeof context.calculationInputs === 'object'
      ? context.calculationInputs
      : {}),
    ...(context?.executionInputs && typeof context.executionInputs === 'object'
      ? context.executionInputs
      : {})
  };
}

async function orchestrateChat({
  req,
  user,
  supabase,
  message,
  context = {},
  assistantState = null
}) {
  const pagePath = normalizePath(context.pagePath);
  const pageTitle = clean(context.pageTitle, 300);
  const pageService = await serviceFromPage({ supabase, pagePath });
  const homepage = isHomepage(pagePath);

  const sessionServiceCode = clean(context.serviceCode, 100);
  const activeServiceCode = pageService?.code || (homepage ? null : sessionServiceCode);
  const contextState = homepage
    ? 'homepage/no_service_selected'
    : (activeServiceCode ? 'service_selected' : 'page/no_registered_service');

  const resolvedContext = {
    ...context,
    pagePath,
    pageTitle,
    serviceCode: activeServiceCode,
    serviceName: pageService?.name_ar || pageService?.name_en || context.serviceName || null,
    contextState,
    contextAuthority: pageService ? 'page' : (homepage ? 'page' : (sessionServiceCode ? 'session' : 'page'))
  };

  const intent = resolveIntent(message);
  const currentServiceQuestion = asksCurrentService(message);

  if (currentServiceQuestion) {
    const reply = homepage
      ? 'أنت الآن في الصفحة الرئيسية، ولا توجد خدمة محددة حالياً.'
      : activeServiceCode
        ? `أنت الآن ضمن خدمة "${resolvedContext.serviceName || activeServiceCode}".`
        : 'الصفحة الحالية ليست مرتبطة بخدمة مسجلة في سجل خدمات بوندز.';
    return {
      handled: true,
      response: {
        reply,
        source: 'bonds-chat-orchestrator',
        orchestrator: { version: CHAT_ORCHESTRATOR_VERSION, intent, handled: true },
        context: {
          pagePath,
          pageTitle,
          serviceCode: activeServiceCode,
          serviceName: resolvedContext.serviceName,
          state: contextState,
          authority: resolvedContext.contextAuthority,
          current_stage: 'discovery'
        },
        ui: [
          uiCard('result_card', 'سياق الصفحة', reply, {
            provenance: [{ source: 'page_context', authority: resolvedContext.contextAuthority }]
          })
        ],
        provenance: [{ source: 'page_context', authority: resolvedContext.contextAuthority }]
      }
    };
  }

  if (!activeServiceCode && !homepage) {
    return {
      handled: false,
      resolvedContext,
      intent
    };
  }

  let executionProfile = null;
  if (activeServiceCode) {
    try {
      executionProfile = await loadExecutionProfile(supabase, activeServiceCode);
    } catch (_) {
      executionProfile = null;
    }
  }

  const missing = missingRequirements({
    ...resolvedContext,
    confirmedFacts: assistantState?.confirmed_facts || {}
  });
  const boundary = homepage
    ? 'homepage/no_service_selected'
    : `page:${pagePath}|service:${activeServiceCode || 'none'}`;
  const workflowKey = workflowKeyFor(boundary);
  const userId = userIdOf(user);

  if (intent === 'escalation' && userId) {
    const persisted = await persistCaseState({
      supabase,
      userId,
      workflowKey,
      boundary,
      userMessage: message,
      serviceCode: activeServiceCode,
      intent,
      missingRequirements: missing,
      executed: false
    });

    const escalation = await createHumanEscalation({
      supabase,
      userId,
      workflowKey,
      boundary,
      expectedVersion: persisted.version,
      reasonCode: 'user_requested',
      summary: clean(message, 500),
      idempotencyKey: `chat:${crypto.createHash('sha256').update(String(message) + boundary).digest('hex').slice(0, 40)}`
    });

    return {
      handled: true,
      response: {
        reply: 'تم إنشاء طلب مراجعة بشرية داخل Agent Inbox وربطه بهذه الحالة.',
        source: 'bonds-chat-orchestrator',
        orchestrator: { version: CHAT_ORCHESTRATOR_VERSION, intent, handled: true },
        context: { serviceCode: activeServiceCode, current_stage: 'review', state: contextState },
        ui: [uiCard('escalation', 'مراجعة بشرية', 'الحالة بانتظار المراجعة البشرية داخل Agent Inbox.')],
        escalation: escalation.escalation,
        provenance: [{ source: 'agent_inbox', authority: 'governed_runtime' }]
      }
    };
  }

  const canRun = user && activeServiceCode &&
    ['calculation', 'analysis', 'execution'].includes(intent) &&
    executionProfile?.profile?.execution_mode === 'capability_plan' &&
    executionProfile?.profile?.primary_action;

  if (canRun) {
    const inputs = executionInputs(resolvedContext, assistantState);
    if (Object.keys(inputs).length || missing.length === 0) {
      const result = await executeService({
        req,
        user,
        supabase,
        serviceCode: activeServiceCode,
        body: {
          language: context.language === 'en' ? 'en' : 'ar',
          inputs,
          context: {
            pagePath,
            pageTitle,
            serviceCode: activeServiceCode
          }
        }
      });

      const executed = Boolean(result?.body?.executed && result?.body?.ok);
      const persisted = userId ? await persistCaseState({
        supabase,
        userId,
        workflowKey,
        boundary,
        userMessage: message,
        serviceCode: activeServiceCode,
        intent,
        missingRequirements: executed ? [] : missing,
        executed
      }).catch(() => null) : null;

      if (executed) {
        const reply = 'تم تشغيل القدرة المسجلة للخدمة بنجاح. الحساب صادر من المحرك/القدرة الحتمية المسجلة، وليس من تخمين النموذج.';
        return {
          handled: true,
          response: {
            reply,
            source: 'service-execution-layer',
            orchestrator: { version: CHAT_ORCHESTRATOR_VERSION, intent, handled: true },
            context: {
              serviceCode: activeServiceCode,
              current_stage: persisted?.state?.current_stage || 'review',
              state: contextState
            },
            ui: [uiCard('calculation', 'نتيجة تشغيل', reply, {
              result: result.body.result || result.body
            })],
            execution: result.body,
            provenance: [
              { source: 'service_execution_profile', service_code: activeServiceCode },
              { source: 'registered_capability', capability: result.body?.capability || executionProfile.profile.primary_action }
            ]
          }
        };
      }
    }
  }

  const nba = nextBestAction({
    serviceCode: activeServiceCode,
    missingRequirements: missing,
    intent,
    executed: false
  });

  if (activeServiceCode && ['calculation', 'analysis', 'execution', 'document', 'follow_up'].includes(intent)) {
    const persisted = userId ? await persistCaseState({
      supabase,
      userId,
      workflowKey,
      boundary,
      userMessage: message,
      serviceCode: activeServiceCode,
      intent,
      missingRequirements: missing,
      executed: false
    }).catch(() => null) : null;

    if (missing.length) {
      const reply = `قبل التنفيذ، يلزم استكمال ${missing.length} متطلب/بيان مسجل للخدمة.`;
      return {
        handled: true,
        response: {
          reply,
          source: 'bonds-chat-orchestrator',
          orchestrator: { version: CHAT_ORCHESTRATOR_VERSION, intent, handled: true },
          context: {
            serviceCode: activeServiceCode,
            current_stage: persisted?.state?.current_stage || 'data_collection',
            state: contextState
          },
          ui: [uiCard('requirements', 'المتطلبات الناقصة', missing.join('\n'), { items: missing })],
          next_best_action: nba,
          provenance: [{ source: 'service_requirements', service_code: activeServiceCode }]
        }
      };
    }
  }

  return {
    handled: false,
    resolvedContext,
    intent,
    executionProfile,
    nextBestAction: nba
  };
}

module.exports = {
  CHAT_ORCHESTRATOR_VERSION,
  normalizePath,
  isHomepage,
  resolveIntent,
  asksCurrentService,
  workflowKeyFor,
  serviceFromPage,
  orchestrateChat
};
