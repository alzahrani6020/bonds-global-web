'use strict';

const { executeGovernedAction } = require('../services/service-execution-router');
const { listCapabilities, getCapability } = require('../capabilities/bonds-capability-registry');
const { runResearchWorkflow } = require('../intelligence/research-workflow');
const { resolveLanguageQuery } = require('./language-query-resolver');

const MAX_TOOL_STEPS = 4;
const ALLOWED_EFFECTS = new Set(['none', 'network_read', 'database_read', 'compute']);

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
  return (Array.isArray(messages) ? messages : []).slice(-12).map(item => ({
    role: String((item && item.role) || 'user').slice(0, 20),
    content: String((item && item.content) || '').slice(0, 1400)
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
  if (!response || response.ok !== true) return null;
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
    'RECENT_MESSAGES=' + compactJson(recent.slice(0, -1), 9000),
    'CURRENT_REQUEST=' + JSON.stringify(currentRequest.slice(0, 2200)),
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

async function verifyResearchAnswer(reply, intent, sourcePackage, workflow, options = {}) {
  const prompt = [
    'You are the BONDS research grounding verifier. Return JSON only.',
    'Check whether every factual claim in ANSWER is supported by VERIFIED_RESEARCH_SOURCES.',
    'Do not use outside knowledge or model memory.',
    'URLs cited in ANSWER must exist in VERIFIED_RESEARCH_SOURCES.',
    'If any factual claim is unsupported, set grounded=false.',
    'Schema: {"grounded":true|false,"unsupported_claims":[],"missing_citations":[]}.',
    'REQUEST=' + JSON.stringify(intent.query.slice(0, 500)),
    'ANSWER=' + JSON.stringify(String(reply || '').slice(0, 9000)),
    'VERIFICATION_STATE=' + JSON.stringify(workflow?.verification?.result?.verification_state || null),
    'VERIFIED_RESEARCH_SOURCES=' + compactJson(sourcePackage, 22000)
  ].join('\n');

  const raw = await callReasoner(prompt, options, 220);
  const verdict = parseGroundingDecision(raw);
  return {
    ok:verdict?.grounded === true,
    verdict:verdict || {
      grounded:false,
      unsupported_claims:['GROUNDING_VERIFIER_INVALID_RESPONSE'],
      missing_citations:[]
    }
  };
}

function researchFailureReply(messages, workflow) {
  const recent = recentMessages(messages);
  const users = recent.filter(item => item.role === 'user');
  const current = users.length ? users[users.length - 1].content : '';
  const isArabic = /[\u0600-\u06FF]/.test(current);
  const code = workflow?.unknowns?.[0] || workflow?.status || 'RESEARCH_FAILED';

  return isArabic
    ? 'تعذر إكمال البحث والتحقق من الأدلة الآن. لم أعتمد على ذاكرة النموذج أو معلومات غير موثقة. رمز الحالة: ' + code
    : 'I could not complete evidence-backed research. I did not substitute model memory or unverified information. Status: ' + code;
}

function researchTaskId(options = {}) {
  const requestId = String(options.requestId || '').trim();
  if (requestId) return requestId.slice(0, 160);
  return 'research-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
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
      topic:intent.language_plan?.entity?.text || intent.query,
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

  if (!workflow?.decisionEligible && workflow?.status === 'search_failed' && intent.language_plan?.entity?.text) {
    const aliases = await suggestUnverifiedQueryAliases(intent, options);
    if (aliases.length) {
      const mergedVariants = [...new Set([...(intent.query_variants || []), ...aliases])].slice(0, 8);
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
          topic:intent.language_plan?.entity?.text || intent.query,
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
  const sourcePackage = sourceRows.slice(0, 5).map(source => ({
    title: source.title || null,
    publisher: source.publisher || null,
    url: source.url || null,
    observed_at: source.observed_at || null,
    retrieved_at: source.retrieved_at || null,
    text: String(source.text || '').slice(0, 5000)
  }));

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
        contradictions:workflow?.contradictions || []
      }
    };
  }

  const recent = recentMessages(messages);
  const prompt = [
    'You are BONDS Assistant / مساعد بوندز. Never identify an underlying model or provider.',
    'This turn is an evidence-backed public research task. Use ONLY the verified research package below for factual claims.',
    'Do not use model memory to add facts that are absent from the package.',
    'If sources disagree, say so. If evidence is incomplete, state the uncertainty.',
    'Include the most relevant source URLs in the answer.',
    'Answer directly in the language of the current request.',
    'CURRENT_REQUEST=' + JSON.stringify(intent.current.slice(0, 2200)),
    'RESOLVED_RESEARCH_QUERY=' + JSON.stringify((workflow?.selected_query || intent.query).slice(0, 500)),
    'LANGUAGE_SEMANTIC_FRAME=' + compactJson(intent.language_plan?.semantic_frame || {}, 3000),
    'RECENT_MESSAGES=' + compactJson(recent.slice(0, -1), 7000),
    'RESEARCH_VERIFICATION=' + compactJson({
      status:workflow.status,
      unknowns:workflow.unknowns || [],
      contradictions:workflow.contradictions || [],
      verification_state:workflow.verification?.result?.verification_state || null,
      independent_publisher_count:workflow.verification?.result?.independent_publisher_count || 0
    }, 5000),
    'VERIFIED_RESEARCH_SOURCES=' + compactJson(sourcePackage, 22000)
  ].join('\n');

  const reply = await callReasoner(prompt, options, options.maxTokens || 420);
  if (!reply) {
    return {
      ok:true,
      reply:researchFailureReply(messages, { status:'AI_SYNTHESIS_FAILED', unknowns:['AI_SYNTHESIS_FAILED'] }),
      toolUsed:true,
      trace,
      steps:trace.length,
      failed:true,
      research:{ task_id:taskId, status:'AI_SYNTHESIS_FAILED', decision_eligible:true }
    };
  }

  const grounding = await verifyResearchAnswer(reply, intent, sourcePackage, workflow, options);
  if (!grounding.ok) {
    console.info('[assistant-research-task]', JSON.stringify({
      task_id:taskId,
      status:'grounding_blocked',
      unsupported_claims:grounding.verdict.unsupported_claims,
      missing_citations:grounding.verdict.missing_citations,
      elapsed_ms:Date.now() - startedAt
    }));
    return {
      ok:true,
      reply:researchFailureReply(messages, {
        status:'ANSWER_GROUNDING_FAILED',
        unknowns:['ANSWER_GROUNDING_FAILED']
      }),
      toolUsed:true,
      trace,
      steps:trace.length,
      failed:true,
      research:{
        task_id:taskId,
        status:'ANSWER_GROUNDING_FAILED',
        decision_eligible:true,
        grounding:grounding.verdict
      }
    };
  }

  console.info('[assistant-research-task]', JSON.stringify({
    task_id:taskId,
    status:'completed',
    source_count:sourceRows.length,
    grounded:true,
    elapsed_ms:Date.now() - startedAt
  }));

  return {
    ok:true,
    reply,
    toolUsed:true,
    trace,
    steps:trace.length,
    research:{
      task_id:taskId,
      status:'completed',
      decision_eligible:true,
      source_count:sourceRows.length,
      language_plan:intent.language_plan || null,
      selected_query:workflow?.selected_query || null,
      attempted_queries:workflow?.attempted_queries || intent.query_variants || [],
      unknowns:workflow.unknowns || [],
      contradictions:workflow.contradictions || []
    }
  };
}

function failureReply(messages, action, execution) {
  const recent = recentMessages(messages);
  const users = recent.filter(item => item.role === 'user');
  const current = users.length ? users[users.length - 1].content : '';
  const isArabic = /[\u0600-\u06FF]/.test(current);
  const code = execution?.error?.code || 'TOOL_EXECUTION_FAILED';

  if (action === 'web_search' || action === 'web_explore') {
    return isArabic
      ? 'تعذر إتمام البحث من المصادر العامة الآن. لم أعتمد على معلومات غير موثقة. رمز الخطأ: ' + code
      : 'I could not complete the public-web search. I did not substitute unverified model knowledge. Error code: ' + code;
  }

  return isArabic
    ? 'تعذر تنفيذ الأداة المطلوبة الآن. رمز الخطأ: ' + code
    : 'The required tool could not be executed. Error code: ' + code;
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
    'CURRENT_REQUEST=' + JSON.stringify(currentRequest.slice(0, 2200)),
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
      return {
        ok: true,
        reply: decision.answer,
        toolUsed: trace.length > 0,
        trace,
        steps: trace.length
      };
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
  verifyResearchAnswer,
  runResearchTurn,
  researchFailureReply,
  failureReply,
  initialSearchDecision,
  searchFollowUp,
  runOpenChatLoop
};
