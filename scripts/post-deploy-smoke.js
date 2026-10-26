const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createClient } = require('@supabase/supabase-js');
const canonicalModel = require('../services/bonds_native_inference/canonical-model.json');
const { assertAssistantProduction } = require('./assistant-production-smoke');
const { runSyntheticProductionJourneys } = require('../lib/assistant/synthetic-production-journeys');

const cfg = {
  baseUrl: (process.env.PRODUCTION_URL || 'https://bonds-global.com').replace(/\/$/, ''),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
  totpSecret: process.env.E2E_ADMIN_TOTP_SECRET || '',
  expectedSha: process.env.GITHUB_SHA
};

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { res, body };
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  return { res, text };
}

async function waitForMatchingProduction() {
  requireEnv('GITHUB_SHA', cfg.expectedSha);
  const expectedVersion = cfg.expectedSha.slice(0, 7);

  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      const { res, body } = await fetchJson(`${cfg.baseUrl}/api/health`, {
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (res.ok && body?.status === 'ok' && body?.version === expectedVersion) {
        console.log(`Production deployment READY for commit ${expectedVersion}`);
        return;
      }

      if (attempt === 60) {
        const observed = body?.version || `HTTP ${res.status}`;
        throw new Error(
          `Timed out waiting for Production commit ${expectedVersion}; observed ${observed}`
        );
      }
    } catch (error) {
      if (attempt === 60) throw error;
    }

    await sleep(10000);
  }
}

function normalizeBase32(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
}

function decodeBase32(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = normalizeBase32(input);
  let bits = '';
  for (const ch of clean) {
    const index = alphabet.indexOf(ch);
    if (index < 0) throw new Error('Invalid TOTP secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, now = Date.now()) {
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1000000).padStart(6, '0');
}

function resolveSupabaseUrl() {
  if (cfg.supabaseUrl) {
    try {
      const parsed = new URL(cfg.supabaseUrl);
      if (['http:', 'https:'].includes(parsed.protocol)) return parsed.origin;
    } catch {}
  }

  requireEnv('SUPABASE_ANON_KEY', cfg.supabaseAnonKey);

  const parts = String(cfg.supabaseAnonKey).split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload?.ref && /^[a-z0-9]+$/i.test(payload.ref)) {
        return `https://${payload.ref}.supabase.co`;
      }
    } catch {}
  }

  throw new Error('SUPABASE_URL is invalid and SUPABASE_ANON_KEY does not expose a project ref');
}

async function getAuthenticatedToken() {
  for (const [name, value] of [
    ['SUPABASE_ANON_KEY', cfg.supabaseAnonKey],
    ['E2E_ADMIN_EMAIL', cfg.email],
    ['E2E_ADMIN_PASSWORD', cfg.password]
  ]) requireEnv(name, value);

  const supabaseUrl = resolveSupabaseUrl();
  const supabase = createClient(supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: cfg.email,
    password: cfg.password
  });
  if (signInError) throw new Error(`E2E admin sign-in failed: ${signInError.message}`);

  const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) throw new Error(`Unable to determine MFA assurance level: ${aalError.message}`);

  if (aalData?.currentLevel !== 'aal2' && aalData?.nextLevel === 'aal2') {
    requireEnv('E2E_ADMIN_TOTP_SECRET', cfg.totpSecret);

    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw new Error(`Unable to list MFA factors: ${factorsError.message}`);

    const factor = (factorsData?.totp || []).find(item => item.status === 'verified');
    if (!factor) throw new Error('No verified TOTP factor found for E2E admin account');

    const code = generateTotp(cfg.totpSecret);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code
    });
    if (verifyError) throw new Error(`E2E admin MFA verification failed: ${verifyError.message}`);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error('Authenticated Supabase session does not contain an access token');
  }

  return sessionData.session.access_token;
}

async function assertHealth() {
  const { res, body } = await fetchJson(`${cfg.baseUrl}/api/health`, {
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) throw new Error(`Production health failed: HTTP ${res.status}`);
  if (body?.status !== 'ok') throw new Error('Production health response is not ok');

  const expectedVersion = cfg.expectedSha.slice(0, 7);
  if (body?.version !== expectedVersion) {
    throw new Error(
      `Production domain is serving commit ${body?.version || 'unknown'}, expected ${expectedVersion}`
    );
  }

  console.log(`Health PASS (commit=${body.version})`);
}

async function assertNativeProductionRuntime(token) {
  let readiness = null;
  const readinessDelaysMs = [0, 1000, 2500];

  for (let attempt = 1; attempt <= readinessDelaysMs.length; attempt++) {
    const delayMs = readinessDelaysMs[attempt - 1];
    if (delayMs) await sleep(delayMs);

    readiness = await fetchJson(`${cfg.baseUrl}/api/readiness`, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    const nativeOk =
      readiness.res.ok &&
      readiness.body?.status === 'ready' &&
      readiness.body?.checks?.native === 'ok';

    if (nativeOk) break;
  }

  const readinessSummary = JSON.stringify({
    status: readiness?.body?.status || null,
    checks: readiness?.body?.checks || null,
    inference: readiness?.body?.inference || null
  });

  if (!readiness?.res?.ok) {
    throw new Error(`Production readiness failed after retries: HTTP ${readiness?.res?.status || 'unknown'}, readiness=${readinessSummary}`);
  }
  if (readiness.body?.status !== 'ready') {
    throw new Error(`Production readiness is not ready after retries: ${readiness.body?.status || 'missing'}, readiness=${readinessSummary}`);
  }
  if (readiness.body?.checks?.native !== 'ok') {
    throw new Error(`Remote Bonds Native health is not ok after retries: ${readiness.body?.checks?.native || 'missing'}, code=${readiness.body?.inference?.native_diagnostic?.code || 'missing'}, upstream_status=${readiness.body?.inference?.native_diagnostic?.http_status ?? 'missing'}`);
  }
  if (readiness.body?.inference?.mode !== 'REMOTE_BONDS_NATIVE') {
    throw new Error(`Unexpected inference mode: ${readiness.body?.inference?.mode || 'missing'}`);
  }
  if (readiness.body?.inference?.native_provider !== 'BondsNativeProvider') {
    throw new Error(`Unexpected Native provider: ${readiness.body?.inference?.native_provider || 'missing'}`);
  }

  const expectedModelSha = String(canonicalModel.sha256 || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedModelSha)) {
    throw new Error('Canonical Bonds Native model SHA is invalid');
  }

  const probes = [
    { label: 'Arabic', content: 'أجب بجملة عربية قصيرة تؤكد أن الاتصال يعمل.' },
    { label: 'English', content: 'Reply with one short sentence confirming the connection works.' }
  ];

  for (const probe of probes) {
    const requestId = `e2e-native-${probe.label.toLowerCase()}-${Date.now()}`;
    const startedAt = Date.now();
    const chat = await fetchJson(`${cfg.baseUrl}/api/v3/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Request-ID': requestId,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: probe.content }],
        context: {},
        options: {
          // Smoke validates the Native execution path and canonical model identity.
          // It intentionally does not benchmark a full conversational decode.
          force_native: true,
          max_tokens: 8
        }
      })
    });
    const elapsedMs = Date.now() - startedAt;

    if (!chat.res.ok) {
      throw new Error(
        `${probe.label} Native chat failed: HTTP ${chat.res.status}, elapsed_ms=${elapsedMs}, request_id=${requestId}, body=${JSON.stringify(chat.body)}`
      );
    }
    const legacyNativeEnvelope =
      chat.body?.source === 'bonds-native' &&
      chat.body?.provider === 'BondsNativeProvider';
    const orchestratedNativeEnvelope =
      chat.body?.source === 'bonds-assistant-ai' &&
      chat.body?.provider === 'BONDS' &&
      chat.body?.inference?.action_fabric?.runtime_adapter === 'native_generate';
    if (!legacyNativeEnvelope && !orchestratedNativeEnvelope) {
      throw new Error(
        `${probe.label} chat did not prove Bonds Native execution: source=${chat.body?.source || 'missing'}, provider=${chat.body?.provider || 'missing'}, fallback_reason=${chat.body?.fallback_reason || 'missing'}, elapsed_ms=${elapsedMs}, request_id=${requestId}, inference=${JSON.stringify(chat.body?.inference || null)}`
      );
    }
    if (
      orchestratedNativeEnvelope &&
      chat.body?.model !== null &&
      chat.body?.model !== undefined
    ) {
      throw new Error(`${probe.label} governed assistant exposed underlying model identity`);
    }
    const observedModelSha = String(chat.body?.inference?.model_sha256 || '').toLowerCase();
    if (legacyNativeEnvelope && observedModelSha !== expectedModelSha) {
      throw new Error(
        `${probe.label} Native model SHA mismatch: expected ${expectedModelSha}, got ${observedModelSha || 'missing'}`
      );
    }
    if (!String(chat.body?.reply || '').trim()) {
      throw new Error(`${probe.label} Native chat returned an empty reply`);
    }

    console.log(
      `BONDS Assistant ${probe.label} PASS (runtime_adapter=${chat.body?.inference?.action_fabric?.runtime_adapter || 'legacy-native'}, model_identity_exposed=${chat.body?.model !== null}, elapsed_ms=${elapsedMs}, native_ms=${chat.body?.inference?.request_elapsed_ms ?? 'unknown'})`
    );
  }

  console.log('Remote Bonds Native production caller PASS');
}

function getTokenSubject(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('E2E access token is not a JWT');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  const sub = String(payload?.sub || '');
  if (!/^[0-9a-f-]{36}$/i.test(sub)) throw new Error('E2E access token subject is invalid');
  return sub;
}

async function assertFinancialDataIntake(token) {
  const userId = getTokenSubject(token);
  const supabaseUrl = resolveSupabaseUrl();
  const supabase = createClient(supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const fixturePath = path.join(__dirname, '..', 'tests', 'fixtures', 'debt-to-equity.csv');
  const file = fs.readFileSync(fixturePath);
  const storagePath = `financial-intake/${userId}/e2e-${cfg.expectedSha}-${Date.now()}.csv`;

  const { error: uploadError } = await supabase.storage
    .from('client-documents')
    .upload(storagePath, file, { contentType: 'text/csv', upsert: false });
  if (uploadError) throw new Error(`Financial intake upload failed: ${uploadError.message}`);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Request-ID': `e2e-financial-intake-${Date.now()}`
  };

  const post = (url, body) => fetchJson(`${cfg.baseUrl}${url}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const get = url => fetchJson(`${cfg.baseUrl}${url}`, {
    method: 'GET',
    headers
  });
  const prepareManual = (serviceCode, manualValues, extra = {}) => post('/api/v3/services/intake/prepare', {
    service_code: serviceCode,
    manual_values: manualValues,
    ...extra
  });
  const approveDataset = (datasetId, corrections = {}) => post('/api/v3/services/intake/approve', {
    dataset_id: datasetId,
    corrections
  });
  const executeDataset = (serviceCode, datasetId) => post('/api/v3/services/execute', {
    service_code: serviceCode,
    dataset_id: datasetId,
    language: 'en',
    source: 'production_e2e'
  });

  // Test 1 — real file, debt/equity, deterministic ground truth.
  const prepare = await post('/api/v3/services/intake/prepare', {
    service_code: 'debt_to_equity_analysis',
    storage_path: storagePath,
    file_name: 'debt-to-equity.csv',
    mime_type: 'text/csv',
    size_bytes: file.length
  });
  if (!prepare.res.ok || !prepare.body?.dataset_id) {
    throw new Error(`Financial intake prepare failed: HTTP ${prepare.res.status} ${JSON.stringify(prepare.body)}`);
  }
  if (prepare.body?.source?.file_version?.startsWith('sha256:') !== true) {
    throw new Error('Financial intake did not return a content-addressed file version');
  }
  const extracted = Object.fromEntries((prepare.body.fields || []).map(field => [field.field, field.value]));
  const groundTruth = { total_debt:200000, equity:100000 };
  const truthFields = Object.keys(groundTruth);
  const exactMatches = truthFields.filter(field => extracted[field] === groundTruth[field]).length;
  const extractionMetrics = {
    extraction_accuracy: exactMatches / truthFields.length,
    missing_field_rate: truthFields.filter(field => extracted[field] === null || extracted[field] === undefined).length / truthFields.length,
    wrong_mapping_rate: (prepare.body.fields || []).filter(field => !truthFields.includes(field.field) && field.value !== null).length / Math.max(1, truthFields.length),
    manual_correction_rate: 0
  };
  if (extracted.total_debt !== 200000 || extracted.equity !== 100000) {
    throw new Error(`Financial extraction mismatch: ${JSON.stringify(extracted)}`);
  }
  const approve = await approveDataset(prepare.body.dataset_id);
  if (
    !approve.res.ok ||
    approve.body?.status !== 'validated' ||
    approve.body?.approval_status !== 'approved' ||
    approve.body?.validation?.valid !== true
  ) {
    throw new Error(`Financial intake approval failed: HTTP ${approve.res.status} ${JSON.stringify(approve.body)}`);
  }
  const execution = await executeDataset('debt_to_equity_analysis', prepare.body.dataset_id);
  const calculated = execution.body?.metrics?.debt_to_equity ?? execution.body?.result?.metrics?.debt_to_equity;
  const manual = 200000 / 100000;
  if (!execution.res.ok || execution.body?.executed !== true || calculated !== manual) {
    throw new Error(
      `Debt/equity E2E mismatch: HTTP ${execution.res.status}, calculated=${calculated}, manual=${manual}, body=${JSON.stringify(execution.body)}`
    );
  }
  if (execution.body?.dataset?.dataset_id !== prepare.body.dataset_id) {
    throw new Error('Financial execution result is missing dataset provenance');
  }

  // Test 2 — liquidity service through the same dataset gateway.
  const liquidityPrepare = await prepareManual('liquidity_gap_analysis', {
    opening_balance: 100,
    periods: [
      { period: 'M1', inflows: 50, outflows: 120 },
      { period: 'M2', inflows: 20, outflows: 100 }
    ]
  });
  if (!liquidityPrepare.res.ok || !liquidityPrepare.body?.dataset_id) {
    throw new Error(`Liquidity intake failed: HTTP ${liquidityPrepare.res.status} ${JSON.stringify(liquidityPrepare.body)}`);
  }
  const liquidityApprove = await approveDataset(liquidityPrepare.body.dataset_id);
  if (!liquidityApprove.res.ok) throw new Error(`Liquidity approval failed: ${JSON.stringify(liquidityApprove.body)}`);
  const liquidityExecution = await executeDataset('liquidity_gap_analysis', liquidityPrepare.body.dataset_id);
  const peakGap = liquidityExecution.body?.metrics?.peak_liquidity_gap
    ?? liquidityExecution.body?.result?.metrics?.peak_liquidity_gap;
  if (!liquidityExecution.res.ok || liquidityExecution.body?.executed !== true || peakGap !== 50) {
    throw new Error(`Liquidity E2E mismatch: expected peak gap 50, got ${peakGap}; ${JSON.stringify(liquidityExecution.body)}`);
  }

  // Test 3 — profitability/margin deterministic ground truth.
  const marginPrepare = await prepareManual('gross_margin_analysis', { revenue: 1000, cogs: 600 });
  if (!marginPrepare.res.ok) throw new Error(`Margin intake failed: ${JSON.stringify(marginPrepare.body)}`);
  const marginApprove = await approveDataset(marginPrepare.body.dataset_id);
  if (!marginApprove.res.ok) throw new Error(`Margin approval failed: ${JSON.stringify(marginApprove.body)}`);
  const marginExecution = await executeDataset('gross_margin_analysis', marginPrepare.body.dataset_id);
  const grossMargin = marginExecution.body?.metrics?.gross_margin_pct
    ?? marginExecution.body?.result?.metrics?.gross_margin_pct;
  if (!marginExecution.res.ok || marginExecution.body?.executed !== true || grossMargin !== 40) {
    throw new Error(`Gross margin E2E mismatch: expected 40, got ${grossMargin}; ${JSON.stringify(marginExecution.body)}`);
  }

  // Test 4 — changing an executed dataset marks previous execution evidence stale.
  const changed = await approveDataset(prepare.body.dataset_id, { total_debt: 210000 });
  if (!changed.res.ok) throw new Error(`Dataset correction failed: ${JSON.stringify(changed.body)}`);
  const changedDataset = await get(`/api/v3/services/intake/datasets/${encodeURIComponent(prepare.body.dataset_id)}`);
  if (!changedDataset.res.ok || changedDataset.body?.dataset?.is_stale !== true) {
    throw new Error(`Dataset change did not mark prior result STALE: ${JSON.stringify(changedDataset.body)}`);
  }
  const staleHistory = changedDataset.body?.dataset?.execution_history || [];
  if (!staleHistory.some(entry => entry?.stale === true)) {
    throw new Error('Dataset change did not preserve prior execution as stale history');
  }

  // Test 5 — conflicting file/manual values must never be selected silently.
  const conflictPrepare = await post('/api/v3/services/intake/prepare', {
    service_code: 'debt_to_equity_analysis',
    storage_path: storagePath,
    file_name: 'debt-to-equity.csv',
    mime_type: 'text/csv',
    size_bytes: file.length,
    manual_values: { total_debt: 210000 }
  });
  const conflictDebt = (conflictPrepare.body?.fields || []).find(field => field.field === 'total_debt');
  if (!conflictPrepare.res.ok || conflictPrepare.body?.quality_status !== 'conflicting'
      || conflictDebt?.status !== 'conflict' || conflictDebt?.value !== null) {
    throw new Error(`Conflict detection failed closed incorrectly: ${JSON.stringify(conflictPrepare.body)}`);
  }

  // Test 6 — a critical uncertain/missing value must fail closed.
  const uncertainPrepare = await prepareManual('debt_to_equity_analysis', { total_debt: 200000 });
  if (!uncertainPrepare.res.ok || uncertainPrepare.body?.validation?.quality_gate !== 'FAIL_CLOSED') {
    throw new Error(`Missing critical value was not flagged: ${JSON.stringify(uncertainPrepare.body)}`);
  }
  const uncertainApprove = await approveDataset(uncertainPrepare.body.dataset_id);
  if (uncertainApprove.res.status !== 422 || uncertainApprove.body?.ok !== false) {
    throw new Error(`Missing critical value approval did not fail closed: ${JSON.stringify(uncertainApprove.body)}`);
  }
  const uncertainExecution = await executeDataset('debt_to_equity_analysis', uncertainPrepare.body.dataset_id);
  if (uncertainExecution.res.status !== 409 || uncertainExecution.body?.executed !== false) {
    throw new Error(`Missing critical value reached execution: ${JSON.stringify(uncertainExecution.body)}`);
  }

  // Test 7 — new version preserves parent history instead of overwriting it.
  const versionPrepare = await prepareManual(
    'debt_to_equity_analysis',
    { total_debt: 210000, equity: 100000 },
    { parent_dataset_id: prepare.body.dataset_id }
  );
  if (!versionPrepare.res.ok || versionPrepare.body?.dataset_version !== 2) {
    throw new Error(`Dataset versioning failed: ${JSON.stringify(versionPrepare.body)}`);
  }
  const parentAfterVersion = await get(`/api/v3/services/intake/datasets/${encodeURIComponent(prepare.body.dataset_id)}`);
  if (!parentAfterVersion.res.ok || parentAfterVersion.body?.dataset?.is_stale !== true) {
    throw new Error('Parent dataset history was not retained/staled after new version');
  }

  // Export acceptance — all formats originate from the same approved result.
  const marginExports = await Promise.all(['summary','xlsx','pdf'].map(async format => {
    const response = await fetch(`${cfg.baseUrl}/api/v3/services/intake/datasets/${encodeURIComponent(marginPrepare.body.dataset_id)}/export?format=${format}`, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || bytes.length < 20) throw new Error(`Financial ${format} export failed: HTTP ${response.status}`);
    return { format, bytes: bytes.length, contentType: response.headers.get('content-type') };
  }));

  console.log(
    `Financial Data 62 acceptance PASS (debt_equity=${calculated}, liquidity_peak_gap=${peakGap}, gross_margin=${grossMargin}, stale=true, conflict=true, fail_closed=true, version=2, quality_metrics=${JSON.stringify(extractionMetrics)}, exports=${JSON.stringify(marginExports)})`
  );
}

async function assertAdminRuntime(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Cache-Control': 'no-cache',
    'X-Request-ID': `e2e-${Date.now()}`
  };

  const me = await fetchJson(`${cfg.baseUrl}/api/admin?action=me`, { headers });
  if (!me.res.ok) {
    throw new Error(`Admin /me failed: HTTP ${me.res.status} ${me.body?.error || ''}`.trim());
  }
  if (!['super_admin', 'admin', 'support'].includes(me.body?.role)) {
    throw new Error(`Unexpected E2E admin role: ${me.body?.role || 'missing'}`);
  }
  console.log(`Admin auth PASS (role=${me.body.role})`);

  const reviews = await fetchJson(`${cfg.baseUrl}/api/admin?action=ai-reviews&limit=5`, { headers });
  if (!reviews.res.ok) {
    const error = reviews.body?.error || reviews.body?.message || 'unknown error';
    throw new Error(`AI reviews failed: HTTP ${reviews.res.status} ${error}`);
  }
  if (!Array.isArray(reviews.body?.data)) {
    throw new Error('AI reviews response data is not an array');
  }
  if (typeof reviews.body?.total !== 'number') {
    throw new Error('AI reviews response total is not numeric');
  }
  if (reviews.body.data.length > 0) {
    const missingProfilesField = reviews.body.data.some(row =>
      !Object.prototype.hasOwnProperty.call(row, 'profiles')
    );
    if (missingProfilesField) {
      throw new Error('AI reviews rows do not expose the expected profiles field');
    }
  }

  console.log(`AI reviews PASS (rows=${reviews.body.data.length}, total=${reviews.body.total})`);
}


function getExpectedCacheVersion() {
  const localSwPath = path.join(__dirname, '..', 'sw.js');
  const localSw = fs.readFileSync(localSwPath, 'utf8');
  const match = localSw.match(/const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"];/);
  if (!match) throw new Error('Unable to determine CACHE_VERSION from repository sw.js');
  return match[1];
}

async function assertProductionAssets() {
  const expectedCacheVersion = getExpectedCacheVersion();
  const sw = await fetchText(`${cfg.baseUrl}/sw.js?smoke=${encodeURIComponent(cfg.expectedSha)}`, {
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!sw.res.ok) throw new Error(`Production sw.js failed: HTTP ${sw.res.status}`);
  if (!sw.text.includes(`const CACHE_VERSION = '${expectedCacheVersion}'`)) {
    throw new Error(`Production sw.js is not serving CACHE_VERSION ${expectedCacheVersion}`);
  }
  console.log(`Service worker PASS (cache=${expectedCacheVersion})`);
}

async function assertFundingCasesRuntime(token) {
  const asset = await fetchText(
    `${cfg.baseUrl}/admin/funding-cases/service.js?smoke=${encodeURIComponent(cfg.expectedSha)}`,
    { headers: { 'Cache-Control': 'no-cache' } }
  );
  if (!asset.res.ok) {
    throw new Error(`Funding Cases service asset failed: HTTP ${asset.res.status}`);
  }

  const session = { data: { session: { access_token: token } } };
  let observedAuthorization = '';
  const bondsAuth = { getSession: async () => session };
  const sandbox = {
    window: { BondsAuth: bondsAuth, __ADMIN_TOKEN: '' },
    BondsAuth: bondsAuth,
    BondsAdminModuleCache: undefined,
    URLSearchParams,
    fetch: async (_url, options = {}) => {
      observedAuthorization = options?.headers?.Authorization || '';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          cases: [],
          pagination: { page: 1, limit: 5, total: 0, pages: 0 }
        })
      };
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(asset.text, sandbox, { filename: 'production-funding-cases-service.js' });

  if (!sandbox.window.FundingCasesService?.list) {
    throw new Error('Production Funding Cases service did not expose list()');
  }
  await sandbox.window.FundingCasesService.list({});
  if (observedAuthorization !== `Bearer ${token}`) {
    throw new Error('Funding Cases service did not use the authenticated nested session token');
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Cache-Control': 'no-cache',
    'X-Request-ID': `e2e-funding-${Date.now()}`
  };
  const list = await fetchJson(`${cfg.baseUrl}/api/admin?action=funding-cases-list&limit=5`, { headers });
  if (!list.res.ok) {
    const error = list.body?.error || list.body?.message || 'unknown error';
    throw new Error(`Funding Cases API failed: HTTP ${list.res.status} ${error}`);
  }
  if (!Array.isArray(list.body?.cases) || typeof list.body?.pagination?.total !== 'number') {
    throw new Error('Funding Cases API response does not match the expected list contract');
  }

  console.log(`Funding Cases PASS (cases=${list.body.cases.length}, total=${list.body.pagination.total})`);
}

async function assertDistressedRecoveryEmbed() {
  const page = await fetchText(
    `${cfg.baseUrl}/admin/distressed-recovery/?embed=1&smoke=${encodeURIComponent(cfg.expectedSha)}`,
    { headers: { 'Cache-Control': 'no-cache' } }
  );
  if (!page.res.ok) {
    throw new Error(`Distressed Recovery page failed: HTTP ${page.res.status}`);
  }

  const scripts = Array.from(page.text.matchAll(/<script>([\s\S]*?)<\/script>/gi), match => match[1]);
  const authGateScript = scripts.find(source =>
    source.includes("authGate.src = '/calculators/auth-gate.js?v=3'")
  );
  if (!authGateScript) {
    throw new Error('Distressed Recovery production page is missing the conditional auth-gate script');
  }

  function execute({ embedded }) {
    const appended = [];
    const selfRef = {};
    const topRef = embedded ? {} : selfRef;
    const sandbox = {
      URLSearchParams,
      location: { search: '?embed=1' },
      window: { self: selfRef, top: topRef },
      document: {
        createElement: () => ({}),
        head: { appendChild: node => appended.push(node) }
      }
    };
    vm.createContext(sandbox);
    vm.runInContext(authGateScript, sandbox, { filename: 'production-distressed-recovery-auth-gate.js' });
    return appended;
  }

  const embeddedAppends = execute({ embedded: true });
  if (embeddedAppends.length !== 0) {
    throw new Error('Embedded Distressed Recovery unexpectedly injects calculator auth-gate');
  }

  const standaloneAppends = execute({ embedded: false });
  if (
    standaloneAppends.length !== 1 ||
    standaloneAppends[0]?.src !== '/calculators/auth-gate.js?v=3'
  ) {
    throw new Error('Standalone Distressed Recovery does not inject the calculator auth-gate correctly');
  }

  console.log('Distressed Recovery embed PASS (duplicate auth-gate suppressed)');
}

async function main() {
  console.log('Starting authenticated Production smoke verification');
  await waitForMatchingProduction();
  await assertHealth();
  const token = await getAuthenticatedToken();
  await assertFinancialDataIntake(token);
  await assertNativeProductionRuntime(token);
  // Run the bounded synthetic journeys before the broader Assistant smoke so they
  // are not starved by the shared Assistant compute rate-limit window.
  await runSyntheticProductionJourneys({
    baseUrl: cfg.baseUrl,
    token,
    expectedSha: cfg.expectedSha
  });
  await assertAssistantProduction({ baseUrl: cfg.baseUrl, token, expectedSha: cfg.expectedSha });
  await assertProductionAssets();
  await assertAdminRuntime(token);
  await assertFundingCasesRuntime(token);
  await assertDistressedRecoveryEmbed();
  console.log('Production authenticated smoke test: PASS');
}

main().catch(error => {
  console.error(`Production authenticated smoke test: FAIL - ${error.message}`);
  process.exit(1);
});
