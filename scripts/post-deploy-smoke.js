const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createClient } = require('@supabase/supabase-js');
const canonicalModel = require('../services/bonds_native_inference/canonical-model.json');

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

async function assertNativeProductionRuntime() {
  const readiness = await fetchJson(`${cfg.baseUrl}/api/readiness`, {
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!readiness.res.ok) {
    throw new Error(`Production readiness failed: HTTP ${readiness.res.status}`);
  }
  if (readiness.body?.status !== 'ready') {
    throw new Error(`Production readiness is not ready: ${readiness.body?.status || 'missing'}`);
  }
  if (readiness.body?.checks?.native !== 'ok') {
    throw new Error(`Remote Bonds Native health is not ok: ${readiness.body?.checks?.native || 'missing'}`);
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
    const chat = await fetchJson(`${cfg.baseUrl}/api/v3/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Request-ID': `e2e-native-${probe.label.toLowerCase()}-${Date.now()}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: probe.content }],
        context: {}
      })
    });

    if (!chat.res.ok) {
      throw new Error(`${probe.label} Native chat failed: HTTP ${chat.res.status}`);
    }
    if (chat.body?.source !== 'bonds-native' || chat.body?.provider !== 'BondsNativeProvider') {
      throw new Error(
        `${probe.label} chat did not use Bonds Native: source=${chat.body?.source || 'missing'}, provider=${chat.body?.provider || 'missing'}`
      );
    }
    if (chat.body?.model !== 'bonds-native') {
      throw new Error(`${probe.label} chat returned unexpected model: ${chat.body?.model || 'missing'}`);
    }
    const observedModelSha = String(chat.body?.inference?.model_sha256 || '').toLowerCase();
    if (observedModelSha !== expectedModelSha) {
      throw new Error(
        `${probe.label} Native model SHA mismatch: expected ${expectedModelSha}, got ${observedModelSha || 'missing'}`
      );
    }
    if (!String(chat.body?.reply || '').trim()) {
      throw new Error(`${probe.label} Native chat returned an empty reply`);
    }

    console.log(
      `Bonds Native ${probe.label} PASS (model_sha256=${observedModelSha.slice(0, 12)}..., backend=${chat.body?.inference?.backend || 'unknown'})`
    );
  }

  console.log('Remote Bonds Native production caller PASS');
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
  await assertNativeProductionRuntime();
  await assertProductionAssets();
  const token = await getAuthenticatedToken();
  await assertAdminRuntime(token);
  await assertFundingCasesRuntime(token);
  await assertDistressedRecoveryEmbed();
  console.log('Production authenticated smoke test: PASS');
}

main().catch(error => {
  console.error(`Production authenticated smoke test: FAIL - ${error.message}`);
  process.exit(1);
});
