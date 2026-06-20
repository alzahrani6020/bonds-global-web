/**
 * Real OpenAI smoke test for the Bonds AI Orchestrator.
 *
 * Loads .env.local, builds a credit_assessment prompt, calls OpenAI with the
 * same fallback chain used by lib/ai/orchestrator.js, and validates the JSON
 * schema of the response.
 */

const fs = require('fs');
const path = require('path');
const { buildPrompt } = require('../lib/ai/prompts');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.join(__dirname, '..', '.env.local'));

const MODEL_PRICING = {
  'gpt-5.5': { input: 5.0, output: 30.0 },
  'gpt-5.4': { input: 2.5, output: 15.0 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

const DEFAULT_MODEL = 'gpt-5.4';
const FALLBACK_CHAIN = {
  'gpt-5.5': ['gpt-5.5', 'gpt-5.4', 'gpt-4o', 'gpt-4o-mini'],
  'gpt-5.4': ['gpt-5.4', 'gpt-4o', 'gpt-4o-mini'],
  'gpt-5.4-mini': ['gpt-5.4-mini', 'gpt-4o-mini'],
  'gpt-4o': ['gpt-4o', 'gpt-4o-mini'],
  'gpt-4o-mini': ['gpt-4o-mini'],
};

function calculateCost(model, tokensInput, tokensOutput) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (tokensInput / 1_000_000) * pricing.input;
  const outputCost = (tokensOutput / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}

function isModelNotFoundError(err) {
  if (!err || !err.message) return false;
  return /model|not found|does not exist|unsupported|invalid model/i.test(err.message);
}

function parseAiJson(content) {
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

  const url = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
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
        console.warn(`[smoke test] Model ${model} unavailable, trying fallback...`);
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('OpenAI call failed after fallback chain');
}

async function main() {
  const type = 'credit_assessment';
  const payload = {
    entity_name: 'مؤسسة اختبار بوندز',
    annual_revenue: 5_000_000,
    existing_debt: 1_200_000,
    net_profit: 800_000,
    total_assets: 3_000_000,
    dscr: 1.6,
    sector: 'التجارة',
    country: 'SA',
  };

  const messages = buildPrompt(type, payload);
  const preferredModel = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  console.log(`[smoke test] Preferred model: ${preferredModel}`);
  console.log('[smoke test] Sending credit_assessment prompt to OpenAI...');

  const { result, tokensInput, tokensOutput, modelUsed } = await callOpenAI(messages, preferredModel);
  const costUsd = calculateCost(modelUsed, tokensInput, tokensOutput);

  const requiredKeys = ['executive_summary', 'analysis', 'risk_score', 'risk_level', 'recommendations', 'financial_summary', 'confidence'];
  const missingKeys = requiredKeys.filter(k => !(k in result));
  if (missingKeys.length > 0) {
    throw new Error(`Response missing required keys: ${missingKeys.join(', ')}`);
  }

  console.log('[smoke test] Model used:', modelUsed);
  console.log('[smoke test] Tokens (input/output):', tokensInput, '/', tokensOutput);
  console.log('[smoke test] Cost USD:', costUsd);
  console.log('[smoke test] Risk level:', result.risk_level);
  console.log('[smoke test] Executive summary:', result.executive_summary?.slice(0, 120) + '...');
  console.log('[smoke test] Recommendations:', JSON.stringify(result.recommendations).slice(0, 160) + '...');
  console.log('✅ OpenAI real smoke test passed');
}

main().catch((err) => {
  console.error('❌ OpenAI real smoke test failed:', err.message);
  process.exit(1);
});
