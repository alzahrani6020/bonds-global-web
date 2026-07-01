/**
 * Bonds AI Orchestrator
 *
 * - Checks Supabase cache before calling AI
 * - Builds prompt using lib/ai/prompts
 * - Calls OpenAI API (one call only)
 * - Saves request, result, usage, and cost
 * - Returns structured JSON report
 */

const crypto = require('crypto');
const getSupabase = require('../api/supabase');
const { buildPrompt } = require('./prompts');

// Pricing in USD per 1M tokens (input / output)
const MODEL_PRICING = {
  'gpt-5.5': { input: 5.00, output: 30.00 },
  'gpt-5.4': { input: 2.50, output: 15.00 },
  'gpt-5.4-mini': { input: 0.75, output: 4.50 },
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-opus-4.8': { input: 5.00, output: 25.00 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
};

// Model selected by analysis task type unless a specific model is requested.
const MODEL_TIERS = {
  feasibility_study: 'gpt-5.5',
  credit_assessment: 'gpt-5.5',
  distressed_project: 'gpt-5.5',
  city_analysis: 'gpt-5.4',
  asset_valuation: 'gpt-5.5',
  investment_story: 'gpt-5.4',
  investment_review: 'gpt-5.4',
  chat: 'gpt-5.4-mini',
};

// Fallback chain used when a model is unavailable for the account.
const FALLBACK_CHAIN = {
  'gpt-5.5': ['gpt-5.5', 'gpt-5.4', 'gpt-4o', 'gpt-4o-mini'],
  'gpt-5.4': ['gpt-5.4', 'gpt-4o', 'gpt-4o-mini'],
  'gpt-5.4-mini': ['gpt-5.4-mini', 'gpt-4o-mini'],
  'gpt-4o': ['gpt-4o', 'gpt-4o-mini'],
  'gpt-4o-mini': ['gpt-4o-mini'],
};

const DEFAULT_MODEL = 'gpt-5.4';
const DEFAULT_CACHE_TTL_DAYS = 30;

const VALID_TYPES = ['credit_assessment', 'feasibility_study', 'distressed_project', 'city_analysis', 'asset_valuation', 'investment_story', 'investment_review'];

const REQUIRED_FIELDS = {
  feasibility_study: ['sector', 'city', 'investment', 'monthly_revenue', 'monthly_costs'],
  credit_assessment: ['entity_name', 'annual_revenue', 'existing_debt'],
  distressed_project: ['project_name', 'current_status', 'distress_reasons'],
  city_analysis: ['city', 'sector'],
  asset_valuation: [],
  investment_story: ['project_name', 'sector', 'city'],
  investment_review: []
};

const NUMERIC_FIELDS = {
  feasibility_study: ['investment', 'monthly_revenue', 'monthly_costs', 'npv', 'irr', 'dscr'],
  credit_assessment: ['annual_revenue', 'existing_debt', 'net_profit', 'total_assets'],
  distressed_project: ['total_debt', 'monthly_burn', 'remaining_cash', 'employees_count'],
  city_analysis: ['population', 'market_size', 'competitors_count'],
  asset_valuation: [],
  investment_story: ['revenue', 'investment', 'valuation', 'confidence'],
  investment_review: []
};

function sanitizeString(value, maxLength = 500) {
  if (typeof value !== 'string') return String(value);
  // Remove HTML tags and trim
  return value.replace(/<[^>]+>/g, '').trim().slice(0, maxLength);
}

function sanitizePayload(type, payload) {
  const numericFields = NUMERIC_FIELDS[type] || [];
  const sanitized = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;

    if (numericFields.includes(key)) {
      const num = Number(value);
      sanitized[key] = Number.isFinite(num) ? num : null;
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v => (typeof v === 'string' ? sanitizeString(v) : v));
    } else if (typeof value === 'object') {
      // Flat objects only; drop nested objects to keep prompts compact
      sanitized[key] = JSON.parse(JSON.stringify(value));
    }
  }

  return sanitized;
}

function validatePayload(type, payload) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid analysis type. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload must be a non-empty object');
  }

  const required = REQUIRED_FIELDS[type];
  const missing = required.filter(field => {
    const value = payload[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  const numericFields = NUMERIC_FIELDS[type] || [];
  for (const field of numericFields) {
    const value = payload[field];
    if (value === undefined || value === null) continue;
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`Field ${field} must be a valid number`);
    }
    if (num < 0 && !['irr', 'npv'].includes(field)) {
      throw new Error(`Field ${field} must be a non-negative number`);
    }
  }
}

function hashInput(payload) {
  // Canonical JSON to ensure same payload = same hash
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function calculateCost(model, tokensInput, tokensOutput) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (tokensInput / 1_000_000) * pricing.input;
  const outputCost = (tokensOutput / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}

function selectModel(type, requestedModel) {
  if (requestedModel) return requestedModel;
  const tier = MODEL_TIERS[type] || DEFAULT_MODEL;
  return process.env.OPENAI_MODEL || tier;
}

function isModelNotFoundError(err) {
  if (!err || !err.message) return false;
  return /model|not found|does not exist|unsupported|invalid model/i.test(err.message);
}

function stripTashkeel(text) {
  return text.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
}

function normalizeRecommendation(rec) {
  if (!rec) return '';
  const text = typeof rec === 'string' ? rec : rec.join(' ');
  return stripTashkeel(text).toLowerCase();
}

function looksInvest(rec) {
  return /موصى|استثمر|مناسب|جذاب|إيجابي|قبول|موافق/i.test(rec);
}

function looksAvoid(rec) {
  return /تجنب|رفض|غير موصى|غير مناسب|سلبي|متعثر|عالي المخاطر/i.test(rec);
}

function looksConsider(rec) {
  return /فكر|شروط|مراجعة|متوسط|تحفظ|مزيد/i.test(rec);
}

function computeFeasibilityVerdict(payload) {
  const npv = Number(payload.npv);
  const irr = Number(payload.irr);
  const dscr = Number(payload.dscr);
  const investment = Number(payload.investment);
  const monthlyRevenue = Number(payload.monthly_revenue);
  const monthlyCosts = Number(payload.monthly_costs);

  if (!Number.isFinite(investment) || investment <= 0) return null;

  if (Number.isFinite(npv) && npv <= 0) return 'avoid';
  if (Number.isFinite(irr) && irr < 8) return 'avoid';
  if (Number.isFinite(dscr) && dscr < 1.0) return 'avoid';

  if (Number.isFinite(monthlyRevenue) && Number.isFinite(monthlyCosts) && monthlyRevenue <= monthlyCosts) {
    return 'avoid';
  }

  if (Number.isFinite(irr) && irr < 15) return 'consider';
  if (Number.isFinite(dscr) && dscr < 1.25) return 'consider';

  return 'invest';
}

function computeCreditVerdict(payload) {
  const dscr = Number(payload.dscr);
  const annualRevenue = Number(payload.annual_revenue);
  const existingDebt = Number(payload.existing_debt);
  const netProfit = Number(payload.net_profit);

  if (Number.isFinite(dscr) && dscr < 1.0) return 'avoid';
  if (Number.isFinite(existingDebt) && Number.isFinite(annualRevenue) && annualRevenue > 0) {
    if (existingDebt / annualRevenue > 0.8) return 'avoid';
    if (existingDebt / annualRevenue > 0.5) return 'consider';
  }
  if (Number.isFinite(netProfit) && netProfit < 0) return 'consider';

  return 'invest';
}

function verdictLabel(v) {
  return {
    invest: 'استثمر',
    consider: 'فكر فيه',
    avoid: 'تجنب',
  }[v] || v;
}

function applyFinancialGuardrails(result, type, payload) {
  if (!result || typeof result !== 'object') return result;

  const recText = normalizeRecommendation(result.recommendations);
  const aiLooksInvest = looksInvest(recText);
  const aiLooksAvoid = looksAvoid(recText);
  const aiLooksConsider = looksConsider(recText);

  let computedVerdict = null;
  if (type === 'feasibility_study') computedVerdict = computeFeasibilityVerdict(payload);
  if (type === 'credit_assessment') computedVerdict = computeCreditVerdict(payload);

  if (!computedVerdict) return result;

  const guardrails = {
    computed_verdict: computedVerdict,
    computed_verdict_label: verdictLabel(computedVerdict),
    ai_overridden: false,
    override_reason: null,
  };

  // If AI suggests invest but computed says avoid/consider, override to the computed verdict.
  if (computedVerdict === 'avoid' && aiLooksInvest) {
    guardrails.ai_overridden = true;
    guardrails.override_reason = 'المؤشرات المالية لا تدعم التوصية الإيجابية (NPV/IRR/DSCR).';
    result.recommendations = [`${guardrails.override_reason} التوصية المحسوبة: ${guardrails.computed_verdict_label}.`];
  } else if (computedVerdict === 'consider' && aiLooksInvest) {
    guardrails.ai_overridden = true;
    guardrails.override_reason = 'المؤشرات المالية متوسطة وتحتاج مراجعة قبل اتخاذ القرار النهائي.';
    result.recommendations = [`${guardrails.override_reason} التوصية المحسوبة: ${guardrails.computed_verdict_label}.`];
  } else if (computedVerdict === 'invest' && aiLooksAvoid) {
    // AI is more pessimistic than numbers; keep AI cautious but note the mismatch.
    guardrails.override_reason = 'المؤشرات المالية إيجابية لكن التحليل النوعي يشير إلى تحفظ.';
  }

  result.guardrails = guardrails;
  return result;
}

async function getCachedResult(inputHash) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ai_cache')
    .select('result, expires_at')
    .eq('input_hash', inputHash)
    .single();

  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data.result;
}

async function saveCache(inputHash, result, ttlDays = DEFAULT_CACHE_TTL_DAYS) {
  const supabase = getSupabase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);

  const { error } = await supabase
    .from('ai_cache')
    .upsert({
      input_hash: inputHash,
      result,
      expires_at: expiresAt.toISOString(),
    }, { onConflict: 'input_hash' });

  if (error) {
    console.error('[AI Orchestrator] Cache save error:', error.message);
  }
}

async function saveRequest({
  userId,
  projectId,
  type,
  inputHash,
  payload,
  model,
  tokensInput,
  tokensOutput,
  costUsd,
  status,
}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ai_requests')
    .insert({
      user_id: userId,
      project_id: projectId || null,
      type,
      input_hash: inputHash,
      payload,
      model,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      cost_usd: costUsd,
      status,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[AI Orchestrator] Request save error:', error.message);
    return null;
  }
  return data.id;
}

async function saveResult({ requestId, result, riskScore, reviewedBy, approvedAt }) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('ai_results')
    .insert({
      request_id: requestId,
      result,
      risk_score: riskScore,
      reviewed_by: reviewedBy || null,
      approved_at: approvedAt || null,
    });

  if (error) {
    console.error('[AI Orchestrator] Result save error:', error.message);
  }
}

function parseAiJson(content) {
  // Strip markdown code fences if present
  let text = content.trim();
  if (text.startsWith('```json')) {
    text = text.slice(7).trim();
  } else if (text.startsWith('```')) {
    text = text.slice(3).trim();
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3).trim();
  }
  return JSON.parse(text);
}

async function callOpenAISingleModel(messages, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2, // lower for accuracy
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`OpenAI API error ${response.status}: ${errorText}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };

  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  return {
    result: parseAiJson(content),
    tokensInput: usage.prompt_tokens,
    tokensOutput: usage.completion_tokens,
  };
}

async function callOpenAI(messages, preferredModel = DEFAULT_MODEL) {
  const chain = FALLBACK_CHAIN[preferredModel] || [preferredModel, DEFAULT_MODEL];
  let lastErr = null;

  for (const model of chain) {
    try {
      const res = await callOpenAISingleModel(messages, model);
      return { ...res, modelUsed: model };
    } catch (err) {
      lastErr = err;
      if (isModelNotFoundError(err)) {
        console.warn(`[AI Orchestrator] Model ${model} unavailable, trying fallback...`);
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('OpenAI call failed after fallback chain');
}

async function analyze({
  userId,
  projectId,
  type,
  payload,
  model: requestedModel,
}) {
  const model = selectModel(type, requestedModel);
  // 1. Validate and sanitize payload
  validatePayload(type, payload);
  payload = sanitizePayload(type, payload);

  // 2. Build input hash
  const inputHash = hashInput({ type, payload });

  // 3. Check cache
  const cached = await getCachedResult(inputHash);
  if (cached) {
    // Log lightweight request record for analytics, mark as cached
    await saveRequest({
      userId,
      projectId,
      type,
      inputHash,
      payload,
      model,
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
      status: 'completed',
    });
    return { cached: true, result: cached };
  }

  // 4. Build prompt
  const messages = buildPrompt(type, payload);

  // 5. Save pending request first
  const requestId = await saveRequest({
    userId,
    projectId,
    type,
    inputHash,
    payload,
    model,
    tokensInput: 0,
    tokensOutput: 0,
    costUsd: 0,
    status: 'pending',
  });

  if (!requestId) {
    throw new Error('Failed to create AI request record');
  }

  try {
    // 6. Call AI with model fallback
    const { result: rawResult, tokensInput, tokensOutput, modelUsed } = await callOpenAI(messages, model);

    // 7. Apply financial guardrails (numbers first, AI second)
    const result = applyFinancialGuardrails(rawResult, type, payload);

    // 8. Calculate cost based on the model that actually responded
    const costUsd = calculateCost(modelUsed, tokensInput, tokensOutput);
    const riskScore = result.risk_score ?? null;

    // 9. Update request with usage, cost, and actual model used
    const supabase = getSupabase();
    await supabase
      .from('ai_requests')
      .update({
        status: 'completed',
        model: modelUsed,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_usd: costUsd,
      })
      .eq('id', requestId);

    // 9. Save result (pending review by default)
    await saveResult({
      requestId,
      result,
      riskScore,
    });

    // 10. Save to cache
    await saveCache(inputHash, result, DEFAULT_CACHE_TTL_DAYS);

    return {
      cached: false,
      requestId,
      result,
      tokensInput,
      tokensOutput,
      costUsd,
    };
  } catch (err) {
    // Mark request as error
    const supabase = getSupabase();
    await supabase
      .from('ai_requests')
      .update({ status: 'error' })
      .eq('id', requestId);

    throw err;
  }
}

module.exports = {
  analyze,
  hashInput,
  calculateCost,
  getCachedResult,
  saveCache,
  selectModel,
  applyFinancialGuardrails,
  MODEL_PRICING,
  MODEL_TIERS,
  DEFAULT_MODEL,
};
