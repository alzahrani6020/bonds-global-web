'use strict';

const { executeGovernedAction } = require('../services/service-execution-router');
const { listCapabilities, getCapability } = require('../capabilities/bonds-capability-registry');
const { runResearchWorkflow } = require('../intelligence/research-workflow');
const { resolveLanguageQuery } = require('./language-query-resolver');
const { buildAnswerPlan } = require('../intelligence/answer-planner');

const MAX_TOOL_STEPS = 4;
const ALLOWED_EFFECTS = new Set(['none', 'network_read', 'database_read', 'compute']);
const REPAIRABLE_QUALITY_CODES = new Set([
  'PERSON_IDENTITY_TOO_GENERIC',
  'PERSON_IDENTITY_NOT_ANSWERED',
  'PERSON_IDENTITY_CONTAMINATED',
  'META_ONLY_ANSWER'
]);

function compactJson(value, maxLength) {
  const text = JSON.stringify(value || {});
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function capabilityCatalog() {
  return listCapabilities()
    .filter(spec => spec.active !== false &&
      !['ai_reason', 'native_generate', 'native_health'].includes(spec.action) &&
      ALLOWED_EFFECTS.has(spec.sideEffect || 'none'))
    .map(spec => ({
      action: spec.action,
      purpose: spec.purpose,
      action_type: spec.actionType || null,
      side_effect: spec.sideEffect || 'none',
      required: Array.isArray(spec.required) ? spec.required : [],
      required_any: Array.isArray(spec.requiredAny) ? spec.requiredAny : []
    }))
    .slice(0, 80);
}

function parsePlannerDecision(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const unfenced = raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    if (parsed.mode === 'answer' && typeof parsed.answer === 'string' && parsed.answer.trim()) {
      return { mode: 'answer', answer: parsed.answer.trim() };
    }

    if (parsed.mode === 'tool' && typeof parsed.action === 'string') {
      const action = parsed.action.trim();
      const capability = getCapability(action);
      if (!capability || capability.active === false || !ALLOWED_EFFECTS.has(capability.sideEffect || 'none')) {
        return null;
      }
      return {
        mode: 'tool',
        action,
        input: parsed.input && typeof parsed.input === 'object' && !Array.isArray(parsed.input)
          ? parsed.input
          : {}
      };
    }
  } catch (_) {}
  return null;
}

function recentMessages(messages) {
  const rows = (Array.isArray(messages) ? messages : []).slice(-12);
  let latestUserIndex = -1;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]?.role === 'user') {
      latestUserIndex = index;
      break;
    }
  }
  return rows.map((item, index) => ({
    role: String((item && item.role) || 'user').slice(0, 20),
    content: String((item && item.content) || '').slice(
      0,
      index === latestUserIndex ? 12000 : 2400
    )
  }));
}

function compactTrace(trace) {
  return (Array.isArray(trace) ? trace : []).slice(-MAX_TOOL_STEPS).map(item => ({
    step: item.step,
    action: item.action,
    input: item.input,
    ok: item.execution?.ok === true,
    error: item.execution?.error || null,
    result: item.execution?.result || null,
    evidence: item.execution?.evidence || null
  }));
}

async function callReasoner(prompt, options, maxTokens) {
  const response = await executeGovernedAction({
    action: 'ai_reason',
    input: { prompt, temperature: 0.1, max_tokens: maxTokens },
    req: options.req,
    user: options.user,
    supabase: options.supabase,
    requestId: options.requestId || null,
    runtimeContext: { timeoutMs: options.timeoutMs, latencyAwareRouting: true }
  });
  if (!response || response.ok !== true) {
    console.error('[assistant-ai-reason-failed]', JSON.stringify({
      response_present: Boolean(response),
      ok: response?.ok ?? null,
      executed: response?.executed ?? null,
      httpStatus: response?.httpStatus ?? null,
      error: response?.error || null,
      action: response?.action || 'ai_reason',
      service: response?.service || null
    }));
    return null;
  }
  const envelope = response.result || {};
  const runtime = envelope.result || envelope;
  return String(runtime.text || '').trim() || null;
}

async function planOpenTurn(messages, context, options = {}) {
  const recent = recentMessages(messages);
  const userRows = recent.filter(item => item.role === 'user');
  const currentRequest = userRows.length ? userRows[userRows.length - 1].content : '';
  const trace = compactTrace(options.toolTrace);

  const prompt = [
    'You are the BONDS open-chat planner. The signed-in user may ask about ANY topic.',
    'Return JSON only. Choose exactly one mode: answer or tool.',
    'For answer mode return {"mode":"answer","answer":"..."} and answer naturally in the user language.',
    'For tool mode return {"mode":"tool","action":"<registered action>","input":{...}}.',
    'Use the complete recent conversation to resolve short follow-ups and references. Never treat the last sentence in isolation when earlier messages define the topic.',
    'For public facts, people, companies, current events, or information not already present in verified context: use web_search first unless a trustworthy URL is already known.',
    'After web_search, factual claims should be based on fetched page content; use web_explore on the best result URLs before answering.',
    'For a known public URL use web_fetch or web_explore. For financial calculations use deterministic registered calculator/financial actions.',
    'Never invent tool names or URLs. Never request credentials or service tokens. Never claim execution before a governed tool result exists.',
    'Do not repeat an already executed action with the same input. Maximum governed tool calls for this turn: ' + MAX_TOOL_STEPS + '.',
    'CAPABILITY_CATALOG=' + compactJson(capabilityCatalog(), 16000),
    'VERIFIED_BONDS_CONTEXT=' + compactJson({
      cityName: context && context.cityName || null,
      activityName: context && context.activityName || null,
      serviceCode: context && context.serviceCode || null,
      serviceName: context && context.serviceName || null,
      marketData: context && context.marketData || null,
      indicators: context && context.indicators || null
    }, 6000),
    'RECENT_MESSAGES=' + compactJson(recent.slice(0, -1), 12000),
    'CURRENT_REQUEST=' + JSON.stringify(currentRequest.slice(0, 12000)),
    'GOVERNED_TOOL_TRACE=' + compactJson(trace, 18000)
  ].join('\n');

  const text = await callReasoner(prompt, options, 420);
  return parsePlannerDecision(text);
}

async function executePlannedTool(decision, options) {
  if (!decision || decision.mode !== 'tool') return null;
  return executeGovernedAction({
    action: decision.action,
    input: decision.input || {},
    req: options.req,
    user: options.user,
    supabase: options.supabase,
    requestId: options.requestId || null
  });
}

function searchQueryFromConversation(messages) {
  const recent = recentMessages(messages);
  const users = recent.filter(item => item.role === 'user');
  if (!users.length) return '';

  const current = users[users.length - 1].content.trim();
  if (!current) return '';

  const commandOnly = /^(?:ابحث|ابحثوا|بحث|فتش|دور\s+لي|دور\s+لنا|شوف\s+لي|شوف\s+لنا|search|look\s+up|find\s+online)(?:\s+(?:في\s+)?(?:النت|الإنترنت|الانترنت|الويب|web|online))?[\s.!؟?،,]*$/i.test(current);
  if (commandOnly && users.length > 1) {
    for (let index = users.length - 2; index >= 0; index -= 1) {
      const candidate = users[index].content.trim();
      if (candidate && !/^(?:نعم|لا|تمام|اكمل|أكمل|ابحث|ابحثوا|بحث|فتش|دور\s+لي|شوف\s+لي)[\s.!؟?،,]*$/i.test(candidate)) {
        return candidate.slice(0, 500);
      }
    }
  }

  return current.slice(0, 500);
}

function researchIntent(messages) {
  const query = searchQueryFromConversation(messages);
  if (!query) return { required:false, query:'', language_plan:null };

  const recent = recentMessages(messages);
  const users = recent.filter(item => item.role === 'user');
  const current = users.length ? users[users.length - 1].content.trim() : query;
  const languagePlan = resolveLanguageQuery(query);

  const explicitSearch = /(?:^|\s)(?:ابحث|ابحثوا|بحث|فتش|دور\s+لي|شوف\s+لي|search|look\s+up|find\s+online)(?:\s|$)/i.test(current);

  return {
    required: explicitSearch || languagePlan.requires_research === true,
    query: languagePlan.selected_query || query,
    current,
    language_plan: languagePlan,
    query_variants: languagePlan.query_variants || [query]
  };
}


function parseAliasCandidates(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    const values = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    const out = [];
    const seen = new Set();
    for (const value of values) {
      const item = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      const key = item.toLocaleLowerCase('en-US');
      if (!item || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 5) break;
    }
    return out;
  } catch (_) {
    return [];
  }
}

async function suggestUnverifiedQueryAliases(intent, options = {}) {
  const plan = intent?.language_plan;
  if (!plan?.entity?.text) return [];
  const prompt = [
    'You are a multilingual query candidate generator for BONDS research.',
    'Return JSON only: {"candidates":["..."]}.',
    'Candidates are NOT facts and will be verified by web search before use.',
    'Generate up to 5 concise search aliases or likely spelling/transliteration corrections for the same entity.',
    'Preserve uncertainty. Do not add biographical facts, titles, employers, dates, or claims.',
    'Use Arabic and English variants when useful.',
    'LANGUAGE=' + JSON.stringify(plan.language),
    'INTENT=' + JSON.stringify(plan.intent),
    'ENTITY=' + JSON.stringify(plan.entity),
    'RAW_TEXT=' + JSON.stringify(plan.raw_text),
    'NORMALIZED_TEXT=' + JSON.stringify(plan.normalized_text)
  ].join('\n');
  const raw = await callReasoner(prompt, options, 220);
  return parseAliasCandidates(raw);
}

function initialSearchDecision(messages, trace = []) {
  if (Array.isArray(trace) && trace.length) return null;
  const query = searchQueryFromConversation(messages);
  if (!query) return null;

  const intent = researchIntent(messages);
  if (!intent.required) return null;

  return {
    mode: 'tool',
    action: 'web_search',
    input: {
      query: intent.query,
      limit: 5
    }
  };
}




function containsPlannerMetaLeak(value) {
  const text = normalizeEvidenceText(value);
  if (!text) return false;

  return /\b(?:web_search|web_explore|evidence_verify|research_synthesize|native_generate|ai_reason)\b/i.test(text) ||
    /(?:^|[.!?؟]\s*)(?:the query|this query|the request|this request).{0,180}(?:translates to|means|is a request|will use|i will use)/i.test(text) ||
    /\bI\s+(?:will|would|need to)\s+(?:use|search|look up|browse)\b/i.test(text) ||
    /(?:سأستخدم|سوف أستخدم|سأبحث|سوف أبحث|أحتاج إلى استخدام).{0,120}(?:أداة|البحث|الويب|الإنترنت)/i.test(text);
}

function parseGroundingDecision(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const unfenced = raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1));
    if (typeof parsed?.grounded !== 'boolean') return null;
    return {
      grounded:parsed.grounded,
      unsupported_claims:Array.isArray(parsed.unsupported_claims)
        ? parsed.unsupported_claims.map(value => String(value).slice(0, 500)).slice(0, 12)
        : [],
      missing_citations:Array.isArray(parsed.missing_citations)
        ? parsed.missing_citations.map(value => String(value).slice(0, 500)).slice(0, 12)
        : []
    };
  } catch (_) {
    return null;
  }
}



function normalizeEvidenceText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function researchQueryTerms(query) {
  const stop = new Set([
    '\u0645\u0646','\u0645\u0627','\u0645\u0627\u0630\u0627','\u0639\u0646','\u0647\u0648','\u0647\u064a',
    '\u0641\u064a','\u0639\u0644\u0649','\u0627\u0644\u0649','\u0625\u0644\u0649','\u0648\u0634','\u0627\u064a\u0634',
    'who','what','about','the','is','are','tell','me'
  ]);

  return [...new Set(
    normalizeEvidenceText(query)
      .toLocaleLowerCase('ar')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(value => value.length >= 2 && !stop.has(value))
  )].slice(0, 12);
}

function relevantEvidenceExcerpt(text, query, maxChars = 700) {
  const clean = normalizeEvidenceText(text);
  if (!clean) return '';

  const terms = researchQueryTerms(query);
  const sentences = clean
    .split(/(?<=[.!?\u061f])\s+|\n+/u)
    .map(value => value.trim())
    .filter(value => value.length >= 24);

  if (!sentences.length) return clean.slice(0, maxChars);

  const ranked = sentences
    .map((sentence, index) => {
      const lower = sentence.toLocaleLowerCase('ar');
      const hits = terms.reduce(
        (sum, term) => sum + (lower.includes(term) ? 1 : 0),
        0
      );
      return { sentence, index, score:hits };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = [];
  let length = 0;

  for (const item of ranked) {
    if (selected.length >= 3) break;
    if (terms.length && item.score === 0 && selected.length) continue;

    const remaining = maxChars - length;
    if (remaining <= 0) break;

    const piece = item.sentence.slice(0, remaining);
    if (!piece) continue;

    selected.push(piece);
    length += piece.length + 1;
  }

  return (selected.length ? selected.join(' ') : clean).slice(0, maxChars);
}

function publicSource(source = {}) {
  const urlText = String(source.url || '').trim();
  let url = null;
  try {
    const parsed = new URL(urlText);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') url = parsed.toString();
  } catch (_) {}

  return {
    title:source.title || null,
    publisher:source.publisher || null,
    url,
    observed_at:source.observed_at || null,
    retrieved_at:source.retrieved_at || null
  };
}

function containsInternalResearchIdentifier(value) {
  const text = String(value || '');
  return /\b(?:web-source-|source_id\b|source_ids\b|research_source_id\b|INTERNAL_[A-Z0-9_]+\b)/i.test(text);
}

function sanitizeResearchReply(reply, sourceRows = []) {
  let text = String(reply || '').trim();
  if (!text) return '';

  sourceRows.slice(0, 20).forEach((source, index) => {
    const url = publicSource(source).url;
    if (!url) return;
    const tokens = [
      String(source?.id || '').trim(),
      'web-source-' + (index + 1)
    ].filter(Boolean);
    for (const token of tokens) {
      text = text.split(token).join(url);
    }
  });

  text = text
    .replace(/\b(?:source_id|source_ids|research_source_id)\s*[:=]\s*[^\s,;]+/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (containsInternalResearchIdentifier(text)) return '';
  return text;
}

function buildResearchAnswerPackage(workflow, sourceRows, query) {
  const synthesis = workflow?.synthesis?.result || {};
  const rows = Array.isArray(sourceRows) ? sourceRows : [];
  const sourceById = new Map(rows.map(source => [source.id, source]));

  const known = Array.isArray(synthesis.known)
    ? synthesis.known
      .filter(item => item && (item.claim || item.value !== undefined))
      .slice(0, 16)
      .map(item => ({
        claim:item.claim || null,
        value:item.value,
        sources:(Array.isArray(item.source_ids) ? item.source_ids : [])
          .map(id => sourceById.get(id))
          .filter(Boolean)
          .map(publicSource)
      }))
    : [];

  if (known.length) {
    return {
      mode:'structured_synthesis',
      verification_state:
        synthesis.verification_state ||
        workflow?.verification?.result?.verification_state ||
        workflow?.status ||
        null,
      known,
      unknown:Array.isArray(synthesis.unknown)
        ? synthesis.unknown.slice(0, 12)
        : [],
      contradictions:Array.isArray(synthesis.contradictions)
        ? synthesis.contradictions.slice(0, 12)
        : [],
      sources:rows.slice(0, 5).map(publicSource)
    };
  }

  const sources = rows
    .slice(0, 3)
    .map(source => {
      const candidates = Array.isArray(source.candidate_claims)
        ? source.candidate_claims
            .slice(0, 3)
            .map(item => normalizeEvidenceText(item?.text))
            .filter(Boolean)
        : [];

      return {
        ...publicSource(source),
        claims:candidates,
        excerpt:candidates.length
          ? candidates.join(' ').slice(0, 700)
          : relevantEvidenceExcerpt(source.text, query, 700)
      };
    })
    .filter(source => source.url && source.excerpt);

  return {
    mode:'verified_source_digest',
    verification_state:
      workflow?.verification?.result?.verification_state ||
      workflow?.status ||
      null,
    known:[],
    unknown:Array.isArray(workflow?.unknowns)
      ? workflow.unknowns.slice(0, 12)
      : [],
    contradictions:Array.isArray(workflow?.contradictions)
      ? workflow.contradictions.slice(0, 12)
      : [],
    sources
  };
}

function buildResearchVerificationPackage(workflow, sourceRows, query) {
  return {
    person_entity_frame:workflow?.person_entity_frame || null,
    verified_identity:workflow?.verified_identity || null,
    verification_state:
      workflow?.verification?.result?.verification_state ||
      workflow?.status ||
      null,
    supported_claims:
      workflow?.verification?.result?.supported_claims || [],
    contradictions:
      workflow?.verification?.result?.contradictions || [],
    sources:(Array.isArray(sourceRows) ? sourceRows : [])
      .slice(0, 5)
      .map(source => ({
        id:source.id || null,
        title:source.title || null,
        publisher:source.publisher || null,
        url:source.url || null,
        observed_at:source.observed_at || null,
        retrieved_at:source.retrieved_at || null,
        excerpt:relevantEvidenceExcerpt(source.text, query, 900)
      }))
  };
}

function researchAnswerContract(intent = {}) {
  const type = String(intent?.language_plan?.intent || '');

  if (type === 'person_lookup') {
    return [
      'Answer the identity question directly in the first sentence.',
      'The first sentence must name the requested person and include at least one specific identifying role, office, profession, organization, or other distinguishing fact supported by the supplied evidence.',
      'Do not use public figure, prominent person, well-known person, notable person, شخصية عامة, شخصية معروفة, or شخصية بارزة as the only identification.',
      'Treat VERIFIED_IDENTITY in ANSWER_CONTEXT as the only authority for asserting that the evidence belongs to the requested person.',
      'Never promote a user-supplied qualifier to fact unless it appears in verified_identity.verified_qualifiers, verified_relations, or verified_organizations.',
      'Use verified evidence for current or changing roles, dates, numbers, and identity-sensitive details.',
      'Stable background knowledge and reasonable inference may be used when helpful.',
      'Do not answer by merely saying that articles, pages, or sources exist.'
    ].join(' ');
  }

  if (type === 'company_lookup') {
    return [
      'Identify the company directly first.',
      'Use verified evidence for current or changing business facts.',
      'Stable background knowledge and reasonable inference may be used when helpful.',
      'Do not describe the search process.'
    ].join(' ');
  }

  return [
    'Answer the user request directly.',
    'Use verified evidence when relevant, especially for current or changing claims.',
    'Stable background knowledge and reasonable inference may be used when helpful.',
    'Do not describe the search process unless the user asks about it.'
  ].join(' ');
}

function buildResearchAnswerContext(intent, workflow, answerPackage) {
  return {
    current_request:String(intent?.current || '').slice(0, 12000),
    resolved_query:String(workflow?.selected_query || intent?.query || '').slice(0, 500),
    semantic_frame:intent?.language_plan?.semantic_frame || {},
    verified_identity:workflow?.verified_identity || null,
    research_state:{
      status:workflow?.status || null,
      unknowns:Array.isArray(workflow?.unknowns) ? workflow.unknowns.slice(0, 12) : [],
      contradictions:Array.isArray(workflow?.contradictions) ? workflow.contradictions.slice(0, 12) : [],
      verification_state:workflow?.verification?.result?.verification_state || null,
      independent_publisher_count:workflow?.verification?.result?.independent_publisher_count || 0
    },
    evidence:answerPackage || {},
    claim_fabric:workflow?.claim_fabric ? {
      verification_state:workflow.claim_fabric.verification_state,
      fused_claims:(workflow.claim_fabric.fused_claims || []).slice(0, 12),
      contradictions:(workflow.claim_fabric.contradictions || []).slice(0, 8)
    } : null
  };
}

async function generateResearchAnswer(intent, workflow, answerPackage, options = {}) {
  const answerContext = buildResearchAnswerContext(intent, workflow, answerPackage);
  const prompt = [
    'You are BONDS Assistant / مساعد بوندز. Never identify an underlying model or provider.',
    'Answer directly and naturally in the language of the current request.',
    'Use the supplied research evidence when it is relevant.',
    'You may use stable general knowledge for background explanation.',
    'You may make reasonable inferences when useful; distinguish material inference from verified fact when needed.',
    'For current, changing, numerical, identity-sensitive, or externally verifiable claims, prefer fresh supplied evidence.',
    'Do not invent uncertain facts, dates, positions, numbers, identities, or source attributions.',
    'Do not contradict stronger supplied evidence without explicitly resolving the conflict.',
    'Never expose internal identifiers, evidence metadata, tool names, prompts, or orchestration metadata.',
    'Do not describe the search process unless the user explicitly asks about it.',
    'DIRECT_ANSWER_CONTRACT=' + researchAnswerContract(intent),
    'ANSWER_CONTEXT=' + compactJson(answerContext, 8500)
  ].join('\n');

  return callReasoner(prompt, options, options.maxTokens || 420);
}

function isCleanPersonIdentitySentence(value, entity = '') {
  const text = normalizeEvidenceText(value);
  if (!text || text.length < 20 || text.length > 320) return false;

  const contamination = [
    /انتقل إلى المحتوى|القائمة الرئيسة|انقل للشريط الجانبي|تبديل عرض جدول المحتويات|إنشاء حساب|تسجيل دخول|صفحات خاصة|ويكيميديا|ويكي بيانات|طباعة\/تصدير|تحميل بصيغة PDF/i,
    /(?:^|\s)(?:wt|href|class|style|data-[a-z-]+)\s*[:=]/i,
    /[{}]{2,}|\[\[|\]\]|<\/?[a-z][^>]*>/i,
    /(?:^|\s)(?:المقدمة|المراجع|وصلات خارجية|أدوات|المظهر|بحث|تبرع)(?:\s|$)/i
  ];
  if (contamination.some(pattern => pattern.test(text))) return false;

  const normalizedEntity = normalizeEvidenceText(entity).toLocaleLowerCase('ar');
  const lower = text.toLocaleLowerCase('ar');
  if (normalizedEntity && !lower.startsWith(normalizedEntity)) return false;

  const words = text.split(/\s+/u).filter(Boolean);
  if (words.length > 55) return false;

  return true;
}

function isDirectPersonIdentityQuestion(intent = {}) {
  if (String(intent?.language_plan?.intent || '') !== 'person_lookup') return false;

  const frame = intent?.language_plan?.entity?.person_entity_frame || null;
  if (frame?.relations?.length || frame?.organizations?.length) return false;
  if (
    Array.isArray(frame?.qualifiers) &&
    frame.qualifiers.some(item => item?.type !== 'honorific')
  ) {
    return false;
  }

  const text = normalizeEvidenceText(
    intent?.current ||
    intent?.language_plan?.raw_text ||
    ''
  );

  return /^(?:من\s+(?:هو|هي)\s+|من\s+).+[؟?]?$/u.test(text) ||
    /^who\s+is\s+.+[?!.]*$/i.test(text) ||
    /^[\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+){1,5}\s+من[؟?]?$/u.test(text);
}

function canonicalizePersonIdentityEvidenceSentence(value, entity, language = '') {
  const text = normalizeEvidenceText(value);
  const canonical = normalizeEvidenceText(entity);
  if (!text || !canonical) return null;

  if (
    hasConcretePersonIdentity(text) &&
    isCleanPersonIdentitySentence(text, canonical)
  ) {
    return text;
  }

  const lower = text.toLocaleLowerCase('ar');
  const canonicalLower = canonical.toLocaleLowerCase('ar');
  const entityIndex = lower.indexOf(canonicalLower);
  if (entityIndex < 0) return null;

  const cleanEdgeNoise = (value) => normalizeEvidenceText(value)
    .replace(/^[\s:;،,\-–—"'“”‘’«»↑↓•·*#()\[\]{}<>]+|[\s:;،,\-–—"'“”‘’«»↑↓•·*#()\[\]{}<>]+$/g, '');

  const before = cleanEdgeNoise(text.slice(0, entityIndex));
  const after = cleanEdgeNoise(text.slice(entityIndex + canonical.length));

  const candidates = [];

  if (after && after.length <= 220 && hasConcretePersonIdentity(after)) {
    candidates.push(canonical + ' ' + after);
  }

  const sourceShapedPrefix =
    /^(?:لقاء|مقابلة|حديث|تصريحات|تصريح|خبر|فيديو|صورة|صفحة|سيرة|حول|عن|مع)(?=\s|$)/iu.test(before) ||
    /^(?:interview|video|photo|profile|biography|news|about|with)(?=\s|$)/i.test(before);

  if (
    before &&
    before.length <= 120 &&
    !sourceShapedPrefix &&
    hasConcretePersonIdentity(before)
  ) {
    candidates.push(
      String(language || '').toLowerCase() === 'en'
        ? canonical + ' is ' + before
        : canonical + ' هو ' + before
    );
  }

  return candidates.find(candidate =>
    hasConcretePersonIdentity(candidate) &&
    isCleanPersonIdentitySentence(candidate, canonical)
  ) || null;
}

function evidenceGroundedPersonIdentityRepair(intent, answerPackage, sourceRows = [], verifiedIdentity = null) {
  if (String(intent?.language_plan?.intent || '') !== 'person_lookup') return null;
  if (verifiedIdentity && verifiedIdentity.verification_state !== 'VERIFIED') return null;

  const entity = normalizeEvidenceText(
    verifiedIdentity?.canonical_name ||
    intent?.language_plan?.entity?.person_entity_frame?.canonical_name ||
    intent?.language_plan?.entity?.text
  );
  if (!entity) return null;

  const terms = researchQueryTerms(entity);
  const requiredEntityMatches = terms.length <= 3
    ? terms.length
    : Math.max(3, Math.ceil(terms.length * 0.75));
  const language = String(intent?.language_plan?.language?.language || intent?.language_plan?.language || '').toLowerCase();
  const candidates = [];

  const pushCandidate = (value) => {
    const text = normalizeEvidenceText(value);
    if (!text) return;
    for (const sentence of text.split(/(?<=[.!?\u061f])\s+|\n+/u)) {
      const normalized = normalizeEvidenceText(sentence);
      if (normalized) candidates.push(normalized);
    }
  };

  for (const item of Array.isArray(answerPackage?.known) ? answerPackage.known : []) {
    pushCandidate(item?.claim);
    if (typeof item?.value === 'string') pushCandidate(item.value);
  }

  for (const source of Array.isArray(answerPackage?.sources) ? answerPackage.sources : []) {
    for (const claim of Array.isArray(source?.claims) ? source.claims : []) pushCandidate(claim);
    pushCandidate(source?.excerpt);
  }

  for (const source of Array.isArray(sourceRows) ? sourceRows.slice(0, 8) : []) {
    pushCandidate(source?.text);
    for (const claim of Array.isArray(source?.candidate_claims) ? source.candidate_claims.slice(0, 8) : []) {
      pushCandidate(claim?.text);
    }
  }

  const scored = candidates
    .map(text => {
      if (language === 'ar' && !/[\u0600-\u06FF]/u.test(text)) return null;
      if (language === 'en' && /[\u0600-\u06FF]/u.test(text)) return null;

      const lower = text.toLocaleLowerCase('ar');
      const entityMatches = terms.reduce(
        (count, term) => count + (lower.includes(term) ? 1 : 0),
        0
      );

      if (entityMatches < requiredEntityMatches) return null;

      const directIdentity = canonicalizePersonIdentityEvidenceSentence(
        text,
        entity,
        language
      );
      if (!directIdentity) return null;

      return {
        text:directIdentity,
        score:(entityMatches * 100) + Math.max(0, 400 - directIdentity.length)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text || null;
}

function repairQualityInstruction(qualityCode) {
  switch (String(qualityCode || '')) {
    case 'PERSON_IDENTITY_TOO_GENERIC':
      return [
        'The rejected answer identified the person too generically.',
        'Rewrite the first sentence so it contains the requested person\'s name and one concrete distinguishing role, title, office, profession, organization, or other identifying fact supported by ANSWER_CONTEXT.',
        'Do not merely call the person public, prominent, Saudi, well-known, notable, شخصية عامة, شخصية معروفة, or شخصية بارزة.',
        'Do not add any fact that is absent from ANSWER_CONTEXT.'
      ].join(' ');
    case 'PERSON_IDENTITY_CONTAMINATED':
      return [
        'The rejected answer contains page chrome, navigation text, markup, metadata, or a raw page dump.',
        'Return a clean direct identity answer only: one or two natural sentences, starting with the requested person\'s name and a concrete supported role or office.',
        'Do not include menus, table-of-contents text, markup, raw JSON, source dumps, or page-interface labels.'
      ].join(' ');
    case 'PERSON_IDENTITY_NOT_ANSWERED':
      return [
        'The rejected answer did not directly identify the requested person.',
        'Rewrite the first sentence so it directly names the requested person and answers who they are using a concrete identifying fact supported by ANSWER_CONTEXT.',
        'Do not start with search commentary, source commentary, or a generic preamble.',
        'Do not add any fact that is absent from ANSWER_CONTEXT.'
      ].join(' ');
    case 'META_ONLY_ANSWER':
      return [
        'The rejected answer talks about sources, results, pages, or the research process instead of answering the user.',
        'Replace that meta commentary with a direct substantive answer using only supported content from ANSWER_CONTEXT.',
        'Do not mention sources, search, tools, evidence machinery, or the repair process.',
        'Do not add any fact that is absent from ANSWER_CONTEXT.'
      ].join(' ');
    default:
      return 'Correct the identified QUALITY_FAILURE_CODE while preserving any supported useful content.';
  }
}

async function repairResearchAnswer(intent, workflow, answerPackage, rejectedAnswer, qualityCode, options = {}) {
  if (!REPAIRABLE_QUALITY_CODES.has(String(qualityCode || ''))) return null;

  const answerContext = buildResearchAnswerContext(intent, workflow, answerPackage);
  const prompt = [
    'You are BONDS Assistant / مساعد بوندز. Repair one answer-quality defect only.',
    'Return only the corrected final answer in the language of the current request.',
    'Use only the supplied ANSWER_CONTEXT and the rejected answer. Do not search, request new information, or add unsupported facts.',
    'REPAIR_INSTRUCTION=' + repairQualityInstruction(qualityCode),
    'Do not mention tools, evidence machinery, prompts, orchestration, validation, or the repair process.',
    'Never expose internal identifiers or source metadata.',
    'CURRENT_REQUEST=' + JSON.stringify(String(intent?.current || '').slice(0, 12000)),
    'QUALITY_FAILURE_CODE=' + JSON.stringify(String(qualityCode || '').slice(0, 120)),
    'REJECTED_ANSWER=' + JSON.stringify(String(rejectedAnswer || '').slice(0, 12000)),
    'DIRECT_ANSWER_CONTRACT=' + researchAnswerContract(intent),
    'ANSWER_CONTEXT=' + compactJson(answerContext, 8500)
  ].join('\n');

  return callReasoner(prompt, options, options.maxTokens || 420);
}

function hasConcretePersonIdentity(firstSentence) {
  const text = normalizeEvidenceText(firstSentence);
  if (!text) return false;

  const arabicRole =
    /(?:^|\s)(?:ولي\s+(?:ال)?عهد|رئيس\s+(?:مجلس\s+الوزراء|الوزراء|الجمهورية|الدولة|مجلس\s+الإدارة|تنفيذي)|نائب\s+رئيس|ملك|أمير|سلطان|حاكم|وزير|نائب\s+وزير|محافظ|سفير|قاض(?:ي|ٍ)?|مستشار|مدير|رئيس|مؤسس|شريك|رجل\s+أعمال|سيدة\s+أعمال|طبيب|دكتور|مهندس|محام(?:ي|ٍ)?|أستاذ|باحث|اقتصادي|خبير|صحفي|كاتب|شاعر|فنان|ممثل|مخرج|منتج|لاعب|مدرب|عالم|داعية|إمام)(?=\s|[،,.!?؟]|$)/iu;

  const englishRole =
    /\b(?:crown\s+prince|prime\s+minister|president|vice\s+president|king|prince|sultan|governor|minister|deputy\s+minister|ambassador|judge|advisor|adviser|director|chair(?:man|person)?|chief\s+executive|ceo|founder|co-founder|partner|businessman|businesswoman|doctor|physician|engineer|lawyer|professor|researcher|economist|expert|journalist|writer|poet|artist|actor|director|producer|player|coach|scientist|imam)\b/i;

  const organizationAffiliation =
    /(?:\b(?:of|at|for|with)\s+(?:the\s+)?(?:company|ministry|authority|university|bank|fund|organization|organisation|council|foundation|institute|club|team)\b|(?:في|لدى|ضمن)\s+(?:شركة|وزارة|هيئة|جامعة|بنك|مصرف|صندوق|منظمة|مؤسسة|مجلس|معهد|نادي|فريق)\b)/iu;

  return arabicRole.test(text) || englishRole.test(text) || organizationAffiliation.test(text);
}

function assessResearchAnswer(reply, intent = {}, verifiedIdentity = null) {
  const text = normalizeEvidenceText(reply);

  if (!text) {
    return { ok:false, code:'EMPTY_ANSWER' };
  }

  if (/\b(?:web-)?source-\d+\b/i.test(text)) {
    return { ok:false, code:'INTERNAL_SOURCE_ID_LEAK' };
  }

  if (containsPlannerMetaLeak(text)) {
    return { ok:false, code:'PLANNER_META_LEAK' };
  }

  const metaOnly =
    /^(?:وجدت|تم العثور|توجد|هناك|تشير النتائج|تشير المصادر).{0,160}(?:مصادر|مقالات|صفحات|نتائج)/i.test(text) ||
    /^(?:i found|there are|the sources|the results).{0,160}(?:sources|articles|pages|results)/i.test(text);

  if (metaOnly) {
    return { ok:false, code:'META_ONLY_ANSWER' };
  }

  const intentType = String(intent?.language_plan?.intent || '');
  const verifiedEntity = verifiedIdentity?.verification_state === 'VERIFIED'
    ? verifiedIdentity.canonical_name
    : null;
  const entity = normalizeEvidenceText(
    verifiedEntity ||
    intent?.language_plan?.entity?.person_entity_frame?.canonical_name ||
    intent?.language_plan?.entity?.text
  );

  if (intentType === 'person_lookup' && entity) {
    const terms = researchQueryTerms(entity);
    const firstSentence = text
      .split(/(?<=[.!?\u061f])\s+|\n+/u)
      .map(value => value.trim())
      .find(Boolean) || text;
    const lowerFirst = firstSentence.toLocaleLowerCase('ar');
    const requiredEntityMatches = terms.length <= 3
      ? terms.length
      : Math.max(3, Math.ceil(terms.length * 0.75));
    const entityMatches = terms.reduce(
      (count, term) => count + (lowerFirst.includes(term) ? 1 : 0),
      0
    );

    if (entityMatches < requiredEntityMatches) {
      return { ok:false, code:'PERSON_IDENTITY_NOT_ANSWERED' };
    }

    if (!hasConcretePersonIdentity(firstSentence)) {
      return { ok:false, code:'PERSON_IDENTITY_TOO_GENERIC' };
    }

    if (!isCleanPersonIdentitySentence(firstSentence, entity)) {
      return { ok:false, code:'PERSON_IDENTITY_CONTAMINATED' };
    }
  }

  return { ok:true, code:'PASS' };
}

function researchFailureReply(messages, workflow) {
  const recent = recentMessages(messages);
  const users = recent.filter(item => item.role === 'user');
  const current = users.length ? users[users.length - 1].content : '';
  const isArabic = /[\u0600-\u06FF]/.test(current);

  console.warn('[assistant-research-blocked]', JSON.stringify({
    status:workflow?.status || 'RESEARCH_FAILED',
    unknowns:Array.isArray(workflow?.unknowns) ? workflow.unknowns.slice(0, 12) : []
  }));

  return isArabic
    ? 'تعذر إكمال البحث أو توليد الإجابة في هذه المحاولة.'
    : 'I could not complete research or answer generation in this attempt.';
}

function researchTaskId(options = {}) {
  const requestId = String(options.requestId || '').trim();
  if (requestId) return requestId.slice(0, 160);
  return 'research-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function safeResearchHost(value) {
  try {
    return new URL(String(value || '')).hostname.slice(0, 120) || null;
  } catch (_) {
    return null;
  }
}

function researchAcquisitionTrace(workflow = {}) {
  const searchAttempts = Array.isArray(workflow.search_attempts) ? workflow.search_attempts : [];
  const seeds = Array.isArray(workflow.seeds) ? workflow.seeds : [];
  const exploration = workflow.exploration?.result || {};
  const pages = Array.isArray(exploration.pages) ? exploration.pages : [];
  const relevantPages = Array.isArray(exploration.relevant_pages) ? exploration.relevant_pages : [];
  const failures = Array.isArray(exploration.failures) ? exploration.failures : [];
  const blocked = Array.isArray(exploration.blocked) ? exploration.blocked : [];
  const recoveryAttempts = Array.isArray(exploration.recovery_attempts) ? exploration.recovery_attempts : [];
  const coverage = exploration.coverage && typeof exploration.coverage === 'object'
    ? exploration.coverage
    : {};
  const verificationSources = Array.isArray(workflow.verification?.result?.sources)
    ? workflow.verification.result.sources
    : [];

  const relevantSearchResults = searchAttempts.reduce(
    (count, item) => count + (Number.isFinite(Number(item?.relevant_result_count)) ? Number(item.relevant_result_count) : 0),
    0
  );

  const failureSamples = failures.slice(0, 8).map(item => ({
    host:safeResearchHost(item?.url),
    status_code:Number.isFinite(Number(item?.evidence?.status_code)) ? Number(item.evidence.status_code) : null,
    failure_class:String(item?.evidence?.failure_class || '').slice(0, 80) || null
  }));

  const blockedSamples = blocked.slice(0, 8).map(item => ({
    host:safeResearchHost(item?.url),
    reason:String(item?.reason || '').slice(0, 80) || null
  }));

  return {
    search_attempt_count:searchAttempts.length,
    search_result_count:Array.isArray(workflow.search?.result?.results)
      ? workflow.search.result.results.length
      : (Number.isFinite(Number(workflow.search?.result?.result_count)) ? Number(workflow.search.result.result_count) : 0),
    relevant_search_result_count:relevantSearchResults,
    seed_count:seeds.length,
    crawl_attempted:Boolean(workflow.exploration),
    discovered_count:Number.isFinite(Number(coverage.discovered_count)) ? Number(coverage.discovered_count) : null,
    visited_count:Number.isFinite(Number(coverage.visited_count)) ? Number(coverage.visited_count) : null,
    fetched_count:Number.isFinite(Number(coverage.successful_count)) ? Number(coverage.successful_count) : pages.length,
    failed_count:Number.isFinite(Number(coverage.failed_count)) ? Number(coverage.failed_count) : failures.length,
    blocked_count:Number.isFinite(Number(coverage.blocked_count)) ? Number(coverage.blocked_count) : blocked.length,
    pending_count:Number.isFinite(Number(coverage.pending_count)) ? Number(coverage.pending_count) : null,
    relevant_page_count:Array.isArray(exploration.relevant_pages) ? relevantPages.length : null,
    recovery_attempt_count:recoveryAttempts.length,
    verification_attempted:Boolean(workflow.verification),
    verified_source_count:verificationSources.length,
    evidence_count:Array.isArray(workflow.evidence) ? workflow.evidence.length : 0,
    crawl_unknowns:Array.isArray(coverage.unknowns)
      ? coverage.unknowns.slice(0, 8).map(value => String(value || '').slice(0, 80))
      : [],
    failure_samples:failureSamples,
    blocked_samples:blockedSamples
  };
}

function researchTrace(workflow) {
  const trace = [];
  if (workflow?.search) {
    trace.push({ step:trace.length + 1, action:'web_search', input:{}, execution:workflow.search });
  }
  if (workflow?.exploration) {
    trace.push({ step:trace.length + 1, action:'web_explore', input:{ seedUrls:workflow.seeds || [] }, execution:workflow.exploration });
  }
  if (workflow?.verification) {
    trace.push({ step:trace.length + 1, action:'evidence_verify', input:{}, execution:workflow.verification });
  }
  if (workflow?.synthesis) {
    trace.push({ step:trace.length + 1, action:'research_synthesize', input:{}, execution:workflow.synthesis });
  }
  return trace;
}

async function runResearchTurn(messages, context, options = {}) {
  const intent = researchIntent(messages);
  if (!intent.required) return null;

  const taskId = researchTaskId(options);
  const startedAt = Date.now();
  const executeCapability = (action, input) => executeGovernedAction({
    action,
    input,
    req: options.req,
    user: options.user,
    supabase: options.supabase,
    requestId: options.requestId || taskId
  });

  console.info('[assistant-research-task]', JSON.stringify({
    task_id:taskId,
    status:'started',
    query:intent.query.slice(0, 240),
    language:intent.language_plan?.language || null,
    intent:intent.language_plan?.intent || null,
    entity:intent.language_plan?.entity || null,
    query_variants:intent.query_variants || []
  }));

  let workflow = await runResearchWorkflow({
    input:intent.query,
    forceResearch:true,
    research:{
      enabled:true,
      query:intent.query,
      queryVariants:intent.query_variants || [intent.query],
      topic:intent.language_plan?.entity?.person_entity_frame?.canonical_name ||
        intent.language_plan?.entity?.text ||
        intent.query,
      intent:intent.language_plan?.intent || 'research',
      entityFrame:intent.language_plan?.entity_frame || intent.language_plan?.semantic_frame?.entity_frame || null,
      personEntityFrame:intent.language_plan?.entity?.person_entity_frame || null,
      searchLimit:5,
      maxPages:5,
      maxDepth:0,
      minIndependentPublishers:2,
      obeyRobots:true
    }
  }, {}, {
    executeCapability,
    userId:options.user?.id || null,
    requestId:options.requestId || taskId
  });

  if (
    !workflow?.decisionEligible &&
    ['search_failed', 'search_low_relevance'].includes(workflow?.status) &&
    intent.language_plan?.entity?.text
  ) {
    const aliases = await suggestUnverifiedQueryAliases(intent, options);
    if (aliases.length) {
      const mergedVariants = [...new Set([...aliases, ...(intent.query_variants || [])])].slice(0, 8);
      console.info('[assistant-language-query]', JSON.stringify({
        task_id:taskId,
        status:'alias_candidates_generated',
        raw_text:intent.language_plan.raw_text,
        normalized_text:intent.language_plan.normalized_text,
        language:intent.language_plan.language,
        intent:intent.language_plan.intent,
        entity:intent.language_plan.entity,
        candidate_aliases:aliases,
        query_variants:mergedVariants
      }));
      workflow = await runResearchWorkflow({
        input:intent.query,
        forceResearch:true,
        research:{
          enabled:true,
          query:intent.query,
          queryVariants:mergedVariants,
          topic:intent.language_plan?.entity?.person_entity_frame?.canonical_name ||
            intent.language_plan?.entity?.text ||
            intent.query,
          intent:intent.language_plan?.intent || 'research',
          entityFrame:intent.language_plan?.entity_frame || intent.language_plan?.semantic_frame?.entity_frame || null,
          personEntityFrame:intent.language_plan?.entity?.person_entity_frame || null,
          searchLimit:5,
          maxPages:5,
          maxDepth:0,
          minIndependentPublishers:2,
          obeyRobots:true
        }
      }, {}, {
        executeCapability,
        userId:options.user?.id || null,
        requestId:options.requestId || taskId
      });
      intent.query_variants = mergedVariants;
      intent.alias_candidates = aliases;
    }
  }

  const trace = researchTrace(workflow);
  const sourceRows = workflow?.verification?.result?.sources || [];
  const answerPackage = buildResearchAnswerPackage(
    workflow,
    sourceRows,
    intent.query
  );
  const verificationPackage = buildResearchVerificationPackage(
    workflow,
    sourceRows,
    intent.query
  );
  const answerPlan = buildAnswerPlan({
    intent:intent.language_plan?.intent || 'information',
    languagePlan:intent.language_plan,
    entityFrame:workflow?.entity_frame || intent.language_plan?.entity_frame || null,
    verifiedIdentity:workflow?.verified_identity || null,
    claimFabric:workflow?.claim_fabric || null
  });

  console.info('[assistant-research-task]', JSON.stringify({
    task_id:taskId,
    status:workflow?.decisionEligible ? 'evidence_ready' : 'blocked',
    workflow_status:workflow?.status || null,
    source_count:sourceRows.length,
    evidence_count:Array.isArray(workflow?.evidence) ? workflow.evidence.length : 0,
    unknowns:workflow?.unknowns || [],
    contradictions:workflow?.contradictions || [],
    selected_query:workflow?.selected_query || null,
    attempted_queries:workflow?.attempted_queries || intent.query_variants || [],
    language:intent.language_plan?.language || null,
    intent:intent.language_plan?.intent || null,
    entity:intent.language_plan?.entity || null,
    elapsed_ms:Date.now() - startedAt
  }));

  if (!workflow?.decisionEligible) {
    return {
      ok:true,
      reply:researchFailureReply(messages, workflow),
      toolUsed:true,
      trace,
      steps:trace.length,
      failed:true,
      research:{
        task_id:taskId,
        status:workflow?.status || 'blocked',
        decision_eligible:false,
        language_plan:intent.language_plan || null,
        selected_query:workflow?.selected_query || null,
        attempted_queries:workflow?.attempted_queries || intent.query_variants || [],
        unknowns:workflow?.unknowns || [],
        contradictions:workflow?.contradictions || [],
        verification_state:workflow?.verification?.result?.verification_state || null,
        source_count:sourceRows.length,
        evidence_count:Array.isArray(workflow?.evidence) ? workflow.evidence.length : 0,
        acquisition_trace:researchAcquisitionTrace(workflow),
        timings:workflow?.timings || null,
        elapsed_ms:Date.now() - startedAt
      }
    };
  }

  const researchAcquisitionMs = Date.now() - startedAt;

  if (answerPlan?.mode === 'direct_verified_claim' && answerPlan.direct_answer) {
    const plannedQuality = assessResearchAnswer(
      answerPlan.direct_answer,
      intent,
      workflow?.verified_identity || null
    );

    if (plannedQuality.ok) {
      console.info('[assistant-research-task]', JSON.stringify({
        task_id:taskId,
        status:'completed',
        answer_mode:'direct_verified_claim',
        claim_fabric_state:workflow?.claim_fabric?.verification_state || null,
        structured_claims:workflow?.claim_fabric?.extracted_claim_count || 0,
        source_count:sourceRows.length,
        research_acquisition_ms:researchAcquisitionMs,
        answer_synthesis_ms:0,
        initial_quality_code:'PASS',
        repair_attempted:false,
        elapsed_ms:Date.now() - startedAt
      }));

      return {
        ok:true,
        reply:answerPlan.direct_answer,
        toolUsed:true,
        trace,
        steps:trace.length,
        research:{
          task_id:taskId,
          status:'completed',
          decision_eligible:true,
          answer_mode:'direct_verified_claim',
          answer_plan:answerPlan,
          claim_fabric_state:workflow?.claim_fabric?.verification_state || null,
          structured_claim_count:workflow?.claim_fabric?.extracted_claim_count || 0,
          verification_state:workflow?.verification?.result?.verification_state || null,
          identity_verification_state:workflow?.verified_identity?.verification_state || null,
          source_count:sourceRows.length,
          evidence_count:Array.isArray(workflow?.evidence) ? workflow.evidence.length : 0,
          language_plan:intent.language_plan || null,
          selected_query:workflow?.selected_query || null,
          attempted_queries:workflow?.attempted_queries || intent.query_variants || [],
          unknowns:workflow.unknowns || [],
          contradictions:workflow.contradictions || [],
          acquisition_trace:researchAcquisitionTrace(workflow),
          timings:workflow?.timings || null,
          research_acquisition_ms:researchAcquisitionMs,
          answer_synthesis_ms:0,
          initial_quality_code:'PASS',
          initial_quality_ms:0,
          repair_attempted:false,
          repair_ms:null,
          repair_quality_code:null,
          repair_quality_ms:null,
          repair_succeeded:false,
          elapsed_ms:Date.now() - startedAt
        }
      };
    }
  }

  if (
    isDirectPersonIdentityQuestion(intent) &&
    workflow?.verified_identity?.verification_state === 'VERIFIED'
  ) {
    const deterministicStartedAt = Date.now();
    const deterministicReply = evidenceGroundedPersonIdentityRepair(
      intent,
      answerPackage,
      sourceRows,
      workflow.verified_identity
    );
    const deterministicIdentityMs = Date.now() - deterministicStartedAt;
    const deterministicQuality = deterministicReply
      ? assessResearchAnswer(
          deterministicReply,
          intent,
          workflow.verified_identity
        )
      : { ok:false, code:'NO_DETERMINISTIC_IDENTITY' };

    if (deterministicQuality.ok) {
      console.info('[assistant-research-task]', JSON.stringify({
        task_id:taskId,
        status:'completed',
        answer_mode:'deterministic_verified_identity',
        source_count:sourceRows.length,
        research_acquisition_ms:researchAcquisitionMs,
        deterministic_identity_ms:deterministicIdentityMs,
        answer_synthesis_ms:0,
        initial_quality_code:'PASS',
        repair_attempted:false,
        elapsed_ms:Date.now() - startedAt
      }));

      return {
        ok:true,
        reply:deterministicReply,
        toolUsed:true,
        trace,
        steps:trace.length,
        research:{
          task_id:taskId,
          status:'completed',
          decision_eligible:true,
          answer_mode:'deterministic_verified_identity',
          verification_state:workflow?.verification?.result?.verification_state || null,
          identity_verification_state:workflow?.verified_identity?.verification_state || null,
          source_count:sourceRows.length,
          evidence_count:Array.isArray(workflow?.evidence) ? workflow.evidence.length : 0,
          language_plan:intent.language_plan || null,
          selected_query:workflow?.selected_query || null,
          attempted_queries:workflow?.attempted_queries || intent.query_variants || [],
          unknowns:workflow.unknowns || [],
          contradictions:workflow.contradictions || [],
          acquisition_trace:researchAcquisitionTrace(workflow),
          timings:workflow?.timings || null,
          research_acquisition_ms:researchAcquisitionMs,
          deterministic_identity_ms:deterministicIdentityMs,
          answer_synthesis_ms:0,
          initial_quality_code:'PASS',
          initial_quality_ms:0,
          repair_attempted:false,
          repair_ms:null,
          repair_quality_code:null,
          repair_quality_ms:null,
          repair_succeeded:false,
          elapsed_ms:Date.now() - startedAt
        }
      };
    }
  }

  const synthesisStartedAt = Date.now();
  const rawReply = await generateResearchAnswer(intent, workflow, answerPackage, options);
  let reply = sanitizeResearchReply(rawReply, sourceRows);
  const synthesisMs = Date.now() - synthesisStartedAt;

  const commonResearch = {
    task_id:taskId,
    decision_eligible:true,
    verification_state:workflow?.verification?.result?.verification_state || null,
    identity_verification_state:workflow?.verified_identity?.verification_state || null,
    source_count:sourceRows.length,
    evidence_count:Array.isArray(workflow?.evidence) ? workflow.evidence.length : 0,
    acquisition_trace:researchAcquisitionTrace(workflow),
    timings:workflow?.timings || null,
    research_acquisition_ms:researchAcquisitionMs,
    answer_synthesis_ms:synthesisMs
  };

  if (!reply) {
    return {
      ok:true,
      reply:researchFailureReply(messages, { status:'AI_SYNTHESIS_FAILED', unknowns:['AI_SYNTHESIS_FAILED'] }),
      toolUsed:true,
      trace,
      steps:trace.length,
      failed:true,
      research:{
        ...commonResearch,
        status:'AI_SYNTHESIS_FAILED',
        repair_attempted:false,
        repair_ms:null,
        repair_quality_code:null,
        repair_quality_ms:null,
        repair_succeeded:false,
        elapsed_ms:Date.now() - startedAt
      }
    };
  }

  const qualityStartedAt = Date.now();
  let quality = assessResearchAnswer(reply, intent, workflow?.verified_identity || null);
  const initialQualityMs = Date.now() - qualityStartedAt;
  const initialQualityCode = quality.code;

  let repairAttempted = false;
  let repairMs = null;
  let repairQualityCode = null;
  let repairQualityMs = null;
  let repairSucceeded = false;

  if (
    !quality.ok &&
    ['PERSON_IDENTITY_TOO_GENERIC', 'PERSON_IDENTITY_NOT_ANSWERED'].includes(quality.code)
  ) {
    repairAttempted = true;
    const repairStartedAt = Date.now();
    const evidenceGroundedReply = evidenceGroundedPersonIdentityRepair(
      intent,
      answerPackage,
      sourceRows,
      workflow?.verified_identity || null
    );
    repairMs = Date.now() - repairStartedAt;

    const repairQualityStartedAt = Date.now();
    const evidenceRepairQuality = evidenceGroundedReply
      ? assessResearchAnswer(evidenceGroundedReply, intent, workflow?.verified_identity || null)
      : { ok:false, code:quality.code };
    repairQualityMs = Date.now() - repairQualityStartedAt;
    repairQualityCode = evidenceRepairQuality.code;
    repairSucceeded = evidenceRepairQuality.ok === true;

    if (repairSucceeded) {
      reply = evidenceGroundedReply;
      quality = evidenceRepairQuality;
    }
  }

  if (!quality.ok && REPAIRABLE_QUALITY_CODES.has(quality.code)) {
    repairAttempted = true;
    const repairStartedAt = Date.now();
    const repairedRawReply = await repairResearchAnswer(
      intent,
      workflow,
      answerPackage,
      reply,
      quality.code,
      options
    );
    const repairedReply = sanitizeResearchReply(repairedRawReply, sourceRows);
    repairMs = Date.now() - repairStartedAt;

    const repairQualityStartedAt = Date.now();
    const repairQuality = repairedReply
      ? assessResearchAnswer(repairedReply, intent, workflow?.verified_identity || null)
      : { ok:false, code:'EMPTY_ANSWER' };
    repairQualityMs = Date.now() - repairQualityStartedAt;
    repairQualityCode = repairQuality.code;
    repairSucceeded = repairQuality.ok === true;

    if (repairSucceeded) {
      reply = repairedReply;
      quality = repairQuality;
    } else {
      quality = repairQuality;
    }
  }

  if (!quality.ok) {
    console.info('[assistant-research-task]', JSON.stringify({
      task_id:taskId,
      status:'quality_blocked',
      initial_quality_code:initialQualityCode,
      quality_code:quality.code,
      repair_attempted:repairAttempted,
      repair_ms:repairMs,
      repair_quality_code:repairQualityCode,
      repair_succeeded:repairSucceeded,
      synthesis_ms:synthesisMs,
      research_acquisition_ms:researchAcquisitionMs,
      elapsed_ms:Date.now() - startedAt
    }));

    return {
      ok:true,
      reply:researchFailureReply(messages, {
        status:'ANSWER_QUALITY_FAILED',
        unknowns:[quality.code]
      }),
      toolUsed:true,
      trace,
      steps:trace.length,
      failed:true,
      research:{
        ...commonResearch,
        status:'ANSWER_QUALITY_FAILED',
        quality_code:quality.code,
        initial_quality_code:initialQualityCode,
        initial_quality_ms:initialQualityMs,
        repair_attempted:repairAttempted,
        repair_ms:repairMs,
        repair_quality_code:repairQualityCode,
        repair_quality_ms:repairQualityMs,
        repair_succeeded:repairSucceeded,
        elapsed_ms:Date.now() - startedAt
      }
    };
  }

  console.info('[assistant-research-task]', JSON.stringify({
    task_id:taskId,
    status:'completed',
    source_count:sourceRows.length,
    search_ms:workflow?.timings?.search_ms || 0,
    explore_ms:workflow?.timings?.explore_ms || 0,
    evidence_verify_ms:workflow?.timings?.verify_ms || 0,
    research_synthesize_ms:workflow?.timings?.synthesize_ms || 0,
    research_acquisition_ms:researchAcquisitionMs,
    answer_synthesis_ms:synthesisMs,
    initial_quality_code:initialQualityCode,
    repair_attempted:repairAttempted,
    repair_ms:repairMs,
    repair_quality_code:repairQualityCode,
    repair_succeeded:repairSucceeded,
    elapsed_ms:Date.now() - startedAt
  }));

  return {
    ok:true,
    reply,
    toolUsed:true,
    trace,
    steps:trace.length,
    research:{
      ...commonResearch,
      status:'completed',
      source_count:sourceRows.length,
      language_plan:intent.language_plan || null,
      selected_query:workflow?.selected_query || null,
      attempted_queries:workflow?.attempted_queries || intent.query_variants || [],
      unknowns:workflow.unknowns || [],
      contradictions:workflow.contradictions || [],
      initial_quality_code:initialQualityCode,
      initial_quality_ms:initialQualityMs,
      repair_attempted:repairAttempted,
      repair_ms:repairMs,
      repair_quality_code:repairQualityCode,
      repair_quality_ms:repairQualityMs,
      repair_succeeded:repairSucceeded,
      elapsed_ms:Date.now() - startedAt
    }
  };
}

function failureReply(messages, action, execution) {
  const recent = recentMessages(messages);
  const users = recent.filter(item => item.role === 'user');
  const current = users.length ? users[users.length - 1].content : '';
  const isArabic = /[\u0600-\u06FF]/.test(current);
  const code = execution?.error?.code || 'TOOL_EXECUTION_FAILED';

  console.warn('[assistant-tool-failure]', JSON.stringify({ action, code }));

  if (action === 'web_search' || action === 'web_explore') {
    return isArabic
      ? 'تعذر إتمام البحث من المصادر العامة الآن. لم أعتمد على معلومات غير موثقة.'
      : 'I could not complete the public-web search. I did not substitute unverified model knowledge.';
  }

  return isArabic
    ? 'تعذر تنفيذ الأداة المطلوبة الآن.'
    : 'The required tool could not be executed.';
}

function searchFollowUp(trace) {
  if (!Array.isArray(trace) || !trace.length) return null;
  const last = trace[trace.length - 1];
  if (last.action !== 'web_search' || last.execution?.ok !== true) return null;

  const rows = Array.isArray(last.execution?.result?.results)
    ? last.execution.result.results
    : [];
  const seedUrls = rows.map(row => row?.url).filter(Boolean).slice(0, 3);
  if (!seedUrls.length) return null;

  return {
    mode: 'tool',
    action: 'web_explore',
    input: {
      seedUrls,
      maxPages: seedUrls.length,
      maxDepth: 0,
      obeyRobots: true,
      allowSubdomains: false
    }
  };
}

async function synthesizeToolReply(messages, context, traceOrDecision, executionOrOptions, maybeOptions) {
  let trace;
  let options;

  if (Array.isArray(traceOrDecision)) {
    trace = traceOrDecision;
    options = executionOrOptions || {};
  } else {
    trace = [{
      step: 1,
      action: traceOrDecision?.action || null,
      input: traceOrDecision?.input || {},
      execution: executionOrOptions || null
    }];
    options = maybeOptions || {};
  }

  const recent = recentMessages(messages);
  const userRows = recent.filter(item => item.role === 'user');
  const currentRequest = userRows.length ? userRows[userRows.length - 1].content : '';

  const prompt = [
    'You are BONDS Assistant / مساعد بوندز. Never identify an underlying model or provider.',
    'Answer the current request directly in the user language and use the full recent conversation to resolve references.',
    'The governed tool trace below is the execution authority for this turn.',
    'For web research, distinguish search snippets from fetched page content. Prefer fetched page content for factual claims and mention material uncertainty.',
    'When URLs are present in the governed trace, include the most relevant source URLs in the answer.',
    'Do not alter deterministic financial or calculator numbers.',
    'If execution reports missing inputs, ask only for those missing inputs.',
    'CURRENT_REQUEST=' + JSON.stringify(currentRequest.slice(0, 12000)),
    'RECENT_MESSAGES=' + compactJson(recent.slice(0, -1), 9000),
    'VERIFIED_BONDS_CONTEXT=' + compactJson({
      cityName: context && context.cityName || null,
      activityName: context && context.activityName || null,
      serviceCode: context && context.serviceCode || null,
      serviceName: context && context.serviceName || null
    }, 3000),
    'GOVERNED_TOOL_TRACE=' + compactJson(compactTrace(trace), 22000)
  ].join('\n');

  return callReasoner(prompt, options, options.maxTokens || 420);
}

async function runOpenChatLoop(messages, context, options = {}) {
  const researchResult = await runResearchTurn(messages, context, options);
  if (researchResult) return researchResult;

  const maxSteps = Math.max(1, Math.min(Number(options.maxToolSteps || MAX_TOOL_STEPS), MAX_TOOL_STEPS));
  const trace = [];
  const seen = new Set();

  for (let index = 0; index < maxSteps; index += 1) {
    let decision = searchFollowUp(trace) || initialSearchDecision(messages, trace);

    if (!decision) {
      decision = await planOpenTurn(messages, context, {
        ...options,
        toolTrace: trace
      });
    }

    if (!decision) break;

    if (decision.mode === 'answer') {
      if (containsPlannerMetaLeak(decision.answer)) {
        console.warn('[assistant-planner-meta-blocked]', JSON.stringify({
          has_tool_trace:trace.length > 0
        }));

        const forcedSearch = initialSearchDecision(messages, trace);
        if (forcedSearch) {
          decision = forcedSearch;
        } else {
          break;
        }
      } else {
        return {
          ok: true,
          reply: decision.answer,
          toolUsed: trace.length > 0,
          trace,
          steps: trace.length
        };
      }
    }

    const signature = decision.action + ':' + compactJson(decision.input || {}, 5000);
    if (seen.has(signature)) break;
    seen.add(signature);

    const execution = await executePlannedTool(decision, options);
    trace.push({
      step: index + 1,
      action: decision.action,
      input: decision.input || {},
      execution
    });

    if (!execution || execution.ok !== true) {
      return {
        ok: true,
        reply: failureReply(messages, decision.action, execution),
        toolUsed: true,
        trace,
        steps: trace.length,
        failed: true
      };
    }
  }

  if (!trace.length) {
    return {
      ok: false,
      reply: null,
      toolUsed: false,
      trace: [],
      steps: 0
    };
  }

  const reply = await synthesizeToolReply(messages, context, trace, options);
  return {
    ok: Boolean(reply),
    reply: reply || null,
    toolUsed: true,
    trace,
    steps: trace.length
  };
}

module.exports = {
  MAX_TOOL_STEPS,
  capabilityCatalog,
  parsePlannerDecision,
  planOpenTurn,
  executePlannedTool,
  synthesizeToolReply,
  searchQueryFromConversation,
  researchIntent,
  parseAliasCandidates,
  suggestUnverifiedQueryAliases,
  parseGroundingDecision,
  containsPlannerMetaLeak,
  relevantEvidenceExcerpt,
  buildResearchAnswerPackage,
  buildResearchVerificationPackage,
  researchAnswerContract,
  repairQualityInstruction,
  evidenceGroundedPersonIdentityRepair,
  isDirectPersonIdentityQuestion,
  canonicalizePersonIdentityEvidenceSentence,
  isCleanPersonIdentitySentence,
  hasConcretePersonIdentity,
  buildResearchAnswerContext,
  generateResearchAnswer,
  repairResearchAnswer,
  assessResearchAnswer,
  containsInternalResearchIdentifier,
  sanitizeResearchReply,
  researchAcquisitionTrace,
  runResearchTurn,
  researchFailureReply,
  failureReply,
  initialSearchDecision,
  searchFollowUp,
  runOpenChatLoop
};
