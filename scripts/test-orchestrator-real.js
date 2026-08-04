/**
 * Real end-to-end test of lib/ai/orchestrator.js against the live OpenAI API.
 *
 * Supabase is stubbed in-memory so the test can run without a database, while
 * the prompt building, model routing, OpenAI call, JSON parsing, financial
 * guardrails, and cost calculation use the real orchestrator code.
 */

const fs = require('fs');
const path = require('path');

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
    process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, '..', '.env.local'));

// Force the real OpenAI endpoint even if the shell has Ollama defaults.
if (!process.env.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL.includes('127.0.0.1:11434')) {
  process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
}

function createMockSupabase() {
  const cache = new Map();
  const requests = [];

  function from(table) {
    return {
      select: (cols) => ({
        eq: (col, val) => ({
          single: async () => {
            if (table === 'ai_cache') {
              const cached = cache.get(val);
              if (cached && new Date(cached.expires_at) > new Date()) {
                return { data: cached, error: null };
              }
            }
            return { data: null, error: { message: 'not found' } };
          },
        }),
      }),
      upsert: async (row) => {
        if (table === 'ai_cache') {
          cache.set(row.input_hash, row);
        }
        return { error: null };
      },
      insert: (row) => ({
        select: (cols) => ({
          single: async () => {
            if (table === 'ai_requests') {
              const record = { id: `req-${requests.length + 1}`, ...row };
              requests.push(record);
              return { data: record, error: null };
            }
            return { data: null, error: null };
          },
        }),
        // ai_results.insert does not chain
      }),
      update: (data) => ({ eq: async (col, val) => ({ error: null }) }),
    };
  }

  return { from };
}

const mockClient = createMockSupabase();

const supabasePath = require.resolve(path.join(__dirname, '..', 'lib', 'api', 'supabase'));
require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: () => mockClient,
};

const { analyze, applyFinancialGuardrails } = require('../lib/ai/orchestrator');

async function main() {
  const payload = {
    sector: 'التجارة',
    city: 'الرياض',
    investment: 2_000_000,
    monthly_revenue: 80_000,
    monthly_costs: 95_000,
    npv: -250_000,
    irr: 4.5,
    dscr: 0.85,
    country: 'SA',
  };

  console.log('[orchestrator real test] Running feasibility_study with guardrail-triggering numbers...');

  const result = await analyze({
    userId: '00000000-0000-0000-0000-000000000000',
    projectId: 'test-project-1',
    type: 'feasibility_study',
    payload,
  });

  console.log('[orchestrator real test] Cached:', result.cached);
  console.log('[orchestrator real test] Request ID:', result.requestId);
  console.log('[orchestrator real test] Model used:', result.result?.guardrails ? 'see result' : 'n/a');
  console.log('[orchestrator real test] Tokens (input/output):', result.tokensInput, '/', result.tokensOutput);
  console.log('[orchestrator real test] Cost USD:', result.costUsd);

  if (!result.result || typeof result.result !== 'object') {
    throw new Error('Orchestrator did not return a structured result');
  }

  const requiredKeys = ['executive_summary', 'analysis', 'risk_score', 'risk_level', 'recommendations', 'financial_summary', 'confidence', 'guardrails'];
  const missing = requiredKeys.filter(k => !(k in result.result));
  if (missing.length > 0) {
    throw new Error(`Result missing keys: ${missing.join(', ')}`);
  }

  const recText = Array.isArray(result.result.recommendations)
    ? result.result.recommendations.join(' ')
    : String(result.result.recommendations);

  console.log('[orchestrator real test] Computed verdict:', result.result.guardrails.computed_verdict);
  console.log('[orchestrator real test] AI overridden:', result.result.guardrails.ai_overridden);
  console.log('[orchestrator real test] Recommendation snippet:', recText.slice(0, 120) + '...');

  if (!result.result.guardrails.ai_overridden) {
    throw new Error('Financial guardrails should have overridden the AI recommendation for negative NPV/DSCR');
  }

  // Run guardrails directly to confirm numeric verdict
  const guarded = applyFinancialGuardrails(
    { recommendations: ['استثمر الآن'] },
    'feasibility_study',
    payload
  );
  if (guarded.guardrails.computed_verdict !== 'avoid') {
    throw new Error(`Expected computed_verdict=avoid, got ${guarded.guardrails.computed_verdict}`);
  }

  console.log(" Orchestrator real end-to-end test passed");
}

main().catch((err) => {
  console.error(" Orchestrator real end-to-end test failed:", err.message);
  process.exit(1);
});
