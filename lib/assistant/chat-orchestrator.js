'use strict';

const crypto = require('crypto');
const { executeService, loadExecutionProfile } = require('../services/service-execution-router');
const { createHumanEscalation } = require('./human-escalation');
const { persistCaseState, nextBestAction, workflowKeyFor } = require('./case-engine');
const { detectIntent } = require('../intent/intent-engine');
const { resolveLanguageQuery } = require('./language-query-resolver');

const CHAT_ORCHESTRATOR_VERSION = 1;

function clean(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function normalizePath(value) {
  const raw = clean(value, 500) || '/';
  const hashIndex = raw.indexOf('#');
  const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const rawHash = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
  const pathOnly = (beforeHash.split('?')[0] || '/').replace(/\/{2,}/g, '/');
  if (!pathOnly.startsWith('/')) return '/';
  const hash = rawHash.split('?')[0].trim().slice(0, 160);
  return hash ? `${pathOnly}#${hash}` : pathOnly;
}

function isHomepage(path) {
  return ['/', '/index.html', '/en', '/en/', '/en/index.html'].includes(normalizePath(path));
}

function isFollowUpReference(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;
  return /^(اكمل|أكمل|كمل|كمّل|تابع|وماذا(?:\s+أيضاً|\s+أيضا|\s+أيضًا)?[؟?]?|ماذا(?:\s+أيضاً|\s+أيضا|\s+أيضًا)[؟?]?|نفس(?:ه|ها| السابق)?|هذا|هذه|هو|هي|عليه|عليها|المشروع السابق|الطلب نفسه)$/i.test(text);
}

function operationalIntentFromSemantic(intentId) {
  const id = String(intentId || '').trim();
  if (['request_financing', 'feasibility', 'market_analysis', 'risk_analysis',
    'review_report', 'buy_asset', 'sell_asset'].includes(id)) return 'analysis';
  if (['compare_scenarios', 'value_asset', 'revalue'].includes(id)) return 'calculation';
  if (['create_report', 'issue_certificate'].includes(id)) return 'execution';
  return null;
}

function resolveConversationReference(message, assistantState = null, recentMessages = []) {
  const raw = clean(message, 2000) || '';
  const followUp = isFollowUpReference(raw);
  const stateTopic = clean(assistantState?.active_topic || assistantState?.goal, 500);
  const stateIntent = clean(assistantState?.last_intent, 120);
  const previousUser = [...(Array.isArray(recentMessages) ? recentMessages : [])]
    .reverse()
    .find(item => item && item.role === 'user' && clean(item.content, 1000) !== raw);
  const previousText = clean(previousUser?.content, 500);

  if (!followUp) {
    return { message: raw, follow_up: false, active_topic: stateTopic, inherited_intent: null };
  }

  const reference = stateTopic || previousText || null;
  return {
    message: reference ? `${reference}\nمتابعة المستخدم: ${raw}` : raw,
    follow_up: true,
    active_topic: reference,
    inherited_intent: stateIntent
  };
}

function asksHumanEscalationIntent(message) {
  const text = String(message || '').trim();
  if (!text) return false;

  return /(?:^|\s)(?:أريد|اريد|أبغى|ابغى|احتاج|أحتاج|حولني|حوّلني|وصلني|وصّلني|اربطني|أطلب|اطلب|طلب|تصعيد|صعّد|صعد|تواصل|اكلم|أكلم|حدثني|حدّثني|let me speak to|connect me to|escalate to|i want|i need)\s+(?:إلى\s+|الى\s+|مع\s+)?(?:مستشار(?:\s+بشري)?|موظف|إنسان|انسان|دعم\s+بشري|human(?:\s+advisor|\s+agent|\s+support)?|advisor|agent)(?:\s|$)/iu.test(text) ||
    /(?:مراجعة\s+بشرية|human\s+review|طلب\s+تصعيد|escalation\s+request)/iu.test(text);
}

function resolveIntents(message, { assistantState = null, recentMessages = [], context = {} } = {}) {
  const raw = String(message || '').trim();
  const text = raw.toLowerCase();

  // Person/entity understanding outranks ambiguous escalation wording.
  // Explicit human requests such as "أريد مستشار بشري" are not person_lookup
  // and continue to the escalation fast path below.
  const languagePlan = resolveLanguageQuery(raw);
  if (languagePlan?.intent === 'person_lookup') return ['information'];

  // Only categorical, unambiguous fast paths remain regex-based.
  if (asksHumanEscalationIntent(raw)) return ['escalation'];
  if (/(مستند|وثيق|ارفق|أرفق|ارفع|ملف|document|upload|attach)/i.test(text)) return ['document'];
  if (/(نفذ|نفّذ|ابدأ|ابدء|شغل|شغّل|ارسال|إرسال|اعتمد|execute|run|submit)/i.test(text)) return ['execution'];

  const reference = resolveConversationReference(raw, assistantState, recentMessages);
  if (reference.follow_up) {
    const inherited = operationalIntentFromSemantic(reference.inherited_intent) || reference.inherited_intent;
    return [['analysis', 'calculation', 'execution', 'document'].includes(inherited)
      ? inherited
      : 'follow_up'];
  }

  const intents = [];
  const add = value => {
    if (value && !intents.includes(value)) intents.push(value);
  };

  const semantic = detectIntent(reference.message, {
    action: context?.action || null,
    sector: context?.sector || null,
    project_type: context?.projectType || context?.project_type || null
  });
  add(operationalIntentFromSemantic(semantic?.intent));

  if (/(احسب|حساب|نسبة|هامش|تدفق|قيمة|تقييم|سيناريو|calculate|valuation|cash flow|scenario)/i.test(text)) add('calculation');
  if (/(حلل|تحليل|مخاطر|جدوى|ائتمان|تمويل|analysis|risk|feasibility|credit)/i.test(text)) add('analysis');
  if (/(متابعة|أين وصل|وين وصل|الحالة|التالي|next|status|follow)/i.test(text)) add('follow_up');

  return intents.length ? intents : ['information'];
}

function resolveIntent(message, options = {}) {
  return resolveIntents(message, options)[0];
}

function asksAssistantIdentity(message) {
  return /^(من أنت|من انت|عرف نفسك|عرّف نفسك|who are you)[؟?]?$/i.test(String(message || '').trim());
}

function asksUserIdentity(message) {
  return /^(هل تعرف من أنا|هل تعرف من انا|من أنا|من انا|do you know who i am|who am i)[؟?]?$/i.test(String(message || '').trim());
}

async function loadTrustedUserContext({ user, supabase, resolvedContext }) {
  const userId = userIdOf(user);
  if (!userId) {
    return {
      authenticated: false,
      display_name: null,
      role: null,
      current_page: resolvedContext?.pagePath || null,
      current_service: resolvedContext?.serviceCode || null
    };
  }

  let role = null;
  if (supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,role,status')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data?.id === userId && data?.status === 'active') {
      role = clean(data.role, 120);
    }
  }

  return {
    authenticated: true,
    user_id: userId,
    display_name: null,
    role,
    current_page: resolvedContext?.pagePath || null,
    current_service: resolvedContext?.serviceCode || null
  };
}

function asksCurrentService(message) {
  return /(ما الخدمة.*(موجود|انا|أنا)|أي خدمة.*(موجود|انا|أنا)|الخدمة الحالية|current service|which service)/i.test(String(message || ''));
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

async function loadRequiredServiceRequirements({ supabase, serviceCode }) {
  if (!supabase || !serviceCode) return [];
  const { data: service, error: serviceError } = await supabase
    .from('service_catalog')
    .select('id')
    .eq('code', serviceCode)
    .eq('status', 'published')
    .eq('is_active', true)
    .maybeSingle();
  if (serviceError || !service) return [];

  const { data, error } = await supabase
    .from('service_requirements')
    .select('label_ar,label_en,is_required,sort_order')
    .eq('service_id', service.id)
    .eq('is_required', true)
    .order('sort_order');
  if (error) return [];
  return (data || [])
    .map(row => row.label_ar || row.label_en)
    .filter(Boolean)
    .slice(0, 25);
}

function missingRequirements(requirements, confirmedFacts = {}) {
  const facts = confirmedFacts && typeof confirmedFacts === 'object'
    ? confirmedFacts
    : {};
  return (Array.isArray(requirements) ? requirements : [])
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
  assistantState = null,
  messages = []
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

  const trustedUserContext = await loadTrustedUserContext({
    user,
    supabase,
    resolvedContext
  });
  const reference = resolveConversationReference(message, assistantState, messages);
  const intents = resolveIntents(message, {
    assistantState,
    recentMessages: messages,
    context: resolvedContext
  });
  const intent = intents[0];
  resolvedContext.intents = intents;
  const currentServiceQuestion = asksCurrentService(message);

  if (asksAssistantIdentity(message)) {
    return {
      handled: true,
      response: {
        reply: 'أنا مساعد بوندز (BONDS Assistant)، المساعد الذكي داخل منصة بوندز.',
        source: 'bonds-assistant-identity',
        orchestrator: { version: CHAT_ORCHESTRATOR_VERSION, intent: 'identity', handled: true },
        context: {
          serviceCode: activeServiceCode,
          state: contextState,
          authenticated: trustedUserContext.authenticated
        },
        provenance: [{ source: 'assistant_identity_contract', authority: 'system' }]
      }
    };
  }

  if (asksUserIdentity(message)) {
    const reply = !trustedUserContext.authenticated
      ? 'لا أملك سياقاً موثوقاً يحدد هويتك لأنك غير مسجل الدخول.'
      : trustedUserContext.display_name
        ? `أعرفك ضمن الجلسة المسجلة باسم "${trustedUserContext.display_name}"${trustedUserContext.role ? `، والدور المسجل: ${trustedUserContext.role}` : ''}.`
        : trustedUserContext.role
          ? `أعرف أنك مستخدم مسجل الدخول، والدور الموثوق في الحساب هو: ${trustedUserContext.role}. لا يتوفر اسم عرض موثوق في سياق الجلسة الحالي.`
          : 'أعرف أنك مستخدم مسجل الدخول، لكن لا يتوفر اسم عرض موثوق في سياق الجلسة الحالي.';
    return {
      handled: true,
      response: {
        reply,
        source: 'bonds-authenticated-user-context',
        orchestrator: { version: CHAT_ORCHESTRATOR_VERSION, intent: 'identity', handled: true },
        context: {
          serviceCode: activeServiceCode,
          state: contextState,
          authenticated: trustedUserContext.authenticated,
          role: trustedUserContext.role
        },
        provenance: [{ source: 'authenticated_session_context', authority: 'server' }]
      }
    };
  }

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

  const requiredServiceRequirements = activeServiceCode
    ? await loadRequiredServiceRequirements({ supabase, serviceCode: activeServiceCode })
    : [];
  const missing = missingRequirements(
    requiredServiceRequirements,
    assistantState?.confirmed_facts || {}
  );
  const boundary = homepage
    ? 'homepage/no_service_selected'
    : `page:${pagePath}|service:${activeServiceCode || 'none'}`;
  const workflowKey = workflowKeyFor(boundary);
  const userId = userIdOf(user);

  if (intent === 'escalation' && !userId) {
    return {
      handled: true,
      response: {
        reply: 'يلزم تسجيل الدخول لربط طلب المراجعة البشرية بحالتك داخل Agent Inbox. سيبقى سياق المحادثة الحالي محفوظاً في الجلسة المحلية حتى تسجيل الدخول.',
        source: 'bonds-chat-orchestrator',
        orchestrator: { version: CHAT_ORCHESTRATOR_VERSION, intent, handled: true },
        context: { serviceCode: activeServiceCode, current_stage: 'review', state: contextState },
        ui: [uiCard('warning', 'تسجيل الدخول مطلوب', 'يلزم تسجيل الدخول لإنشاء حالة مراجعة بشرية مرتبطة بالمستخدم.', {
          code: 'AUTHENTICATION_REQUIRED_FOR_HUMAN_ESCALATION'
        })],
        error: { code: 'AUTHENTICATION_REQUIRED_FOR_HUMAN_ESCALATION' },
        provenance: [{ source: 'assistant_session_context', authority: 'session_only' }]
      }
    };
  }

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

      // A registered deterministic execution path was selected but did not complete.
      // Do not fall through to AI and let it fabricate a financial result.
      const errorCode = result?.body?.error?.code || 'SERVICE_EXECUTION_INCOMPLETE';
      const reply = 'لم يكتمل تشغيل القدرة المسجلة للخدمة. لن أستبدل نتيجة المحرك بحساب من الذكاء الاصطناعي؛ يلزم استكمال المدخلات أو معالجة خطأ التنفيذ أولاً.';
      return {
        handled: true,
        response: {
          reply,
          source: 'service-execution-layer',
          orchestrator: { version: CHAT_ORCHESTRATOR_VERSION, intent, handled: true },
          context: {
            serviceCode: activeServiceCode,
            current_stage: persisted?.state?.current_stage || (missing.length ? 'data_collection' : 'validation'),
            state: contextState
          },
          ui: [uiCard('warning', 'تعذر إكمال التنفيذ الحتمي', reply, {
            code: errorCode
          })],
          execution: result.body,
          next_best_action: nextBestAction({
            serviceCode: activeServiceCode,
            missingRequirements: missing,
            intent,
            executed: false
          }),
          provenance: [
            { source: 'service_execution_profile', service_code: activeServiceCode },
            { source: 'registered_capability', capability: executionProfile.profile.primary_action }
          ]
        }
      };
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
    resolvedContext: {
      ...resolvedContext,
      authenticated: trustedUserContext.authenticated,
      userRole: trustedUserContext.role,
      conversationReference: reference
    },
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
  resolveIntents,
  resolveConversationReference,
  isFollowUpReference,
  asksHumanEscalationIntent,
  asksAssistantIdentity,
  asksUserIdentity,
  loadTrustedUserContext,
  asksCurrentService,
  workflowKeyFor,
  serviceFromPage,
  loadRequiredServiceRequirements,
  missingRequirements,
  orchestrateChat
};
