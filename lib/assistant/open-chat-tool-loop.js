'use strict';

const { executeGovernedAction } = require('../services/service-execution-router');
const { listCapabilities, getCapability } = require('../capabilities/bonds-capability-registry');

function compactJson(value, maxLength) {
  const text = JSON.stringify(value || {});
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function capabilityCatalog() {
  const allowedEffects = new Set(['none', 'network_read', 'database_read', 'compute']);
  return listCapabilities()
    .filter(spec => spec.active !== false &&
      !['ai_reason', 'native_generate', 'native_health'].includes(spec.action) &&
      allowedEffects.has(spec.sideEffect || 'none'))
    .map(spec => ({
      action: spec.action,
      purpose: spec.purpose,
      action_type: spec.actionType || null,
      side_effect: spec.sideEffect || 'none',
      required: Array.isArray(spec.required) ? spec.required : [],
      required_any: Array.isArray(spec.requiredAny) ? spec.requiredAny : []
    }))
    .slice(0, 60);
}

function parsePlannerDecision(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
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
      if (!capability || capability.active === false) return null;
      return {
        mode: 'tool',
        action,
        input: parsed.input && typeof parsed.input === 'object' && !Array.isArray(parsed.input) ? parsed.input : {}
      };
    }
  } catch (_) {}
  return null;
}

function recentMessages(messages) {
  return (Array.isArray(messages) ? messages : []).slice(-10).map(item => ({
    role: String((item && item.role) || 'user').slice(0, 20),
    content: String((item && item.content) || '').slice(0, 1200)
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

async function planOpenTurn(messages, context, options) {
  const recent = recentMessages(messages);
  const userRows = recent.filter(item => item.role === 'user');
  const currentRequest = userRows.length ? userRows[userRows.length - 1].content : '';
  const prompt = [
    'You are the BONDS open-chat planner. The user may ask about ANY topic.',
    'Return JSON only. Choose exactly one mode: answer or tool.',
    'For answer mode return {"mode":"answer","answer":"..."} and answer naturally in the user language.',
    'For tool mode return {"mode":"tool","action":"<registered action>","input":{...}}.',
    'Use a tool only when fresh external information, a registered calculation, BONDS data access, or another registered capability is materially required.',
    'Never invent tool names. Never request credentials or service tokens. Never claim execution before a tool result exists.',
    'For current web information prefer web_fetch, web_crawl or web_explore.',
    'For financial calculations prefer deterministic registered financial or calculator actions.',
    'CAPABILITY_CATALOG=' + compactJson(capabilityCatalog(), 12000),
    'VERIFIED_BONDS_CONTEXT=' + compactJson({
      cityName: context && context.cityName || null,
      activityName: context && context.activityName || null,
      serviceCode: context && context.serviceCode || null,
      marketData: context && context.marketData || null,
      indicators: context && context.indicators || null
    }, 5000),
    'RECENT_MESSAGES=' + compactJson(recent.slice(0, -1), 7000),
    'CURRENT_REQUEST=' + JSON.stringify(currentRequest.slice(0, 1800))
  ].join('\n');
  const text = await callReasoner(prompt, options, 320);
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

async function synthesizeToolReply(messages, context, decision, execution, options) {
  const recent = recentMessages(messages);
  const userRows = recent.filter(item => item.role === 'user');
  const currentRequest = userRows.length ? userRows[userRows.length - 1].content : '';
  const prompt = [
    'You are BONDS Assistant / مساعد بوندز. Never identify an underlying model or provider.',
    'The governed tool result below is the execution authority for this turn.',
    'Answer naturally in the user language. Do not alter deterministic numeric results.',
    'If execution reports missing inputs, ask only for those missing inputs.',
    'CURRENT_REQUEST=' + JSON.stringify(currentRequest.slice(0, 1800)),
    'RECENT_MESSAGES=' + compactJson(recent.slice(0, -1), 7000),
    'VERIFIED_BONDS_CONTEXT=' + compactJson({
      cityName: context && context.cityName || null,
      activityName: context && context.activityName || null,
      serviceCode: context && context.serviceCode || null
    }, 2000),
    'GOVERNED_TOOL_RESULT=' + compactJson({ action: decision.action, input: decision.input, execution }, 14000)
  ].join('\n');
  return callReasoner(prompt, options, options.maxTokens || 320);
}

module.exports = {
  capabilityCatalog,
  parsePlannerDecision,
  planOpenTurn,
  executePlannedTool,
  synthesizeToolReply
};
