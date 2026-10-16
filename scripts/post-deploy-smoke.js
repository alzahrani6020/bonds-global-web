const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const cfg = {
  baseUrl: (process.env.PRODUCTION_URL || 'https://bonds-global.com').replace(/\/$/, ''),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
  totpSecret: process.env.E2E_ADMIN_TOTP_SECRET || '',
  vercelToken: process.env.VERCEL_TOKEN,
  vercelProjectId: process.env.VERCEL_PROJECT_ID,
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

async function waitForMatchingProduction() {
  requireEnv('VERCEL_TOKEN', cfg.vercelToken);
  requireEnv('VERCEL_PROJECT_ID', cfg.vercelProjectId);
  requireEnv('GITHUB_SHA', cfg.expectedSha);

  const endpoint = new URL('https://api.vercel.com/v6/deployments');
  endpoint.searchParams.set('projectId', cfg.vercelProjectId);
  endpoint.searchParams.set('target', 'production');
  endpoint.searchParams.set('limit', '20');

  for (let attempt = 1; attempt <= 60; attempt++) {
    const { res, body } = await fetchJson(endpoint, {
      headers: { Authorization: `Bearer ${cfg.vercelToken}` }
    });
    if (!res.ok) throw new Error(`Vercel deployment lookup failed: HTTP ${res.status}`);

    const deployments = body?.deployments || [];
    const match = deployments.find(d => d?.meta?.githubCommitSha === cfg.expectedSha);
    if (match) {
      const state = match.readyState || match.state;
      if (state === 'READY') {
        console.log(`Vercel deployment READY for commit ${cfg.expectedSha.slice(0, 12)}`);
        return match;
      }
      if (['ERROR', 'CANCELED'].includes(state)) {
        throw new Error(`Vercel deployment entered terminal state: ${state}`);
      }
    }

    if (attempt < 60) await sleep(10000);
  }

  throw new Error(`Timed out waiting for Vercel Production deployment for commit ${cfg.expectedSha}`);
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

async function getAuthenticatedToken() {
  for (const [name, value] of [
    ['SUPABASE_URL', cfg.supabaseUrl],
    ['SUPABASE_ANON_KEY', cfg.supabaseAnonKey],
    ['E2E_ADMIN_EMAIL', cfg.email],
    ['E2E_ADMIN_PASSWORD', cfg.password]
  ]) requireEnv(name, value);

  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
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

async function main() {
  console.log('Starting authenticated Production smoke verification');
  await waitForMatchingProduction();
  await assertHealth();
  const token = await getAuthenticatedToken();
  await assertAdminRuntime(token);
  console.log('Production authenticated smoke test: PASS');
}

main().catch(error => {
  console.error(`Production authenticated smoke test: FAIL - ${error.message}`);
  process.exit(1);
});
