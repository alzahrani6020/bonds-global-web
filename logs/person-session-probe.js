'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const QUESTION = 'من هو الدكتور طلال حسن الزهراني؟';
const ROOT = path.join(__dirname, '..');

function loadEnv(file) {
  const env = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key) env[key] = value;
  }
  return env;
}

function normalizeIdentity(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[“”"'؟?!.,،:;؛()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function judge(label, httpStatus, body, elapsedMs) {
  const reply = String(body?.reply || '').trim();
  const planner = body?.inference?.planner || null;
  const toolUsed = body?.inference?.tool_used === true;
  const fallback = body?.fallback_reason || null;
  const expectedPerson = normalizeIdentity('طلال حسن الزهراني');
  const insufficient = reply === 'لم أجد مصادر مستقلة كافية لتقديم تعريف موثق.' ||
    reply === 'I could not find enough independent sources to provide a verified profile.';
  const forbiddenIdentityHosts = [
    'linkedin.com', 'youtube.com', 'youtu.be', 'facebook.com', 'instagram.com',
    'x.com', 'twitter.com', 'tiktok.com', 'threads.net', 'snapchat.com'
  ];
  const urlPattern = /https?:\/\/[^\s)\]}>]+/g;
  const replyUrls = [...reply.matchAll(urlPattern)].map(match => match[0].replace(/[.,،؛;:]+$/, ''));
  const forbidden = [];
  const publishers = new Set();
  for (const url of replyUrls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      if (forbiddenIdentityHosts.some(domain => host === domain || host.endsWith('.' + domain))) {
        forbidden.push(host);
      }
      if (host) publishers.add(host);
    } catch (_) {}
  }
  const sourceMarker = reply.indexOf('المصادر:');
  const identityLead = sourceMarker >= 0 ? reply.slice(0, sourceMarker).trim() : '';
  const firstLeadChar = identityLead.charAt(0);
  const numberedLead = '0123456789٠١٢٣٤٥٦٧٨٩'.includes(firstLeadChar);
  const failures = [];
  if (httpStatus !== 200) failures.push(`HTTP ${httpStatus}`);
  if (planner !== 'universal-v2-deterministic-research') failures.push(`planner=${planner || 'missing'}`);
  if (fallback) failures.push(`fallback_reason=${fallback}`);
  if (!reply) failures.push('empty reply');
  if (forbidden.length) failures.push(`forbidden=${forbidden.join(',')}`);
  if (!insufficient) {
    if (sourceMarker < 0) failures.push('missing المصادر');
    if (identityLead && !normalizeIdentity(identityLead).includes(expectedPerson)) {
      failures.push('identity not bound');
    }
    if (!identityLead || numberedLead || identityLead.startsWith('http')) {
      failures.push('no identity-lead sentence');
    }
    if (publishers.size < 2) failures.push(`publishers=${publishers.size}`);
  }
  return {
    label,
    verdict: failures.length ? 'FAIL' : (insufficient ? 'PASS_FAIL_CLOSED' : 'PASS'),
    httpStatus,
    elapsedMs,
    planner,
    toolUsed,
    fallback,
    insufficient,
    publishers: [...publishers],
    forbidden,
    failures,
    reply
  };
}

async function chat(url, headers = {}) {
  const started = Date.now();
  const res = await fetch(`${url.replace(/\/$/, '')}/api/v3/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...headers
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: QUESTION }],
      context: { pagePath: '/' },
      options: { max_tokens: 256 }
    })
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 500) }; }
  return { res, body, elapsedMs: Date.now() - started };
}

function vercelEnv(name) {
  const { execFileSync } = require('child_process');
  try {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const out = execFileSync(
      npx,
      ['vercel', 'env', 'get', name, 'production', '--scope', 'dr-talal', '--yes'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
    );
    const lines = String(out || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return lines.filter(line => !/retrieving|encrypted|vercel cli/i.test(line)).pop() || '';
  } catch (_) {
    return '';
  }
}

async function mintOnlineToken() {
  let fileEnv = {};
  try { fileEnv = loadEnv(path.join(ROOT, '.env.production')); } catch (_) { fileEnv = {}; }
  const pick = (...keys) => {
    for (const key of keys) {
      const value = String(process.env[key] || fileEnv[key] || '').trim();
      if (value && value.length >= 5 && value !== 'Encrypted') return value;
    }
    return '';
  };
  const url = pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const service = pick('SUPABASE_SERVICE_ROLE_KEY');
  const anon = pick('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const email = pick('ADMIN_EMAIL', 'MANAGER_EMAIL');
  if (!url || !service || !anon || !email || service.length < 80 || anon.length < 80) {
    throw new Error('ONLINE_SESSION_INPUTS_MISSING');
  }
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const otp = data?.properties?.email_otp;
  if (!otp) throw new Error('generateLink did not return email_otp');
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    email,
    token: otp,
    type: 'magiclink'
  });
  if (verifyError) throw new Error(`verifyOtp: ${verifyError.message}`);
  const token = verified?.session?.access_token;
  if (!token) throw new Error('session missing access_token');
  return { token, aal: verified?.session?.aal || null };
}

async function waitLocal(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:8787/health', { signal: AbortSignal.timeout(1500) });
      if (res.ok || res.status === 503) return true;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  const results = [];

  if (process.env.SKIP_LOCAL === '1') {
    results.push({ label: 'local', verdict: 'SKIPPED' });
  } else {
    const localUp = await waitLocal();
    if (!localUp) {
      results.push({ label: 'local', verdict: 'BLOCKED', failures: ['local assistant not reachable on 127.0.0.1:8787'] });
    } else {
      const local = await chat('http://127.0.0.1:8787');
      results.push(judge('local', local.res.status, local.body, local.elapsedMs));
    }
  }

  try {
    const session = await mintOnlineToken();
    const online = await chat('https://bonds-global.com', {
      Authorization: `Bearer ${session.token}`,
      'X-Request-ID': `local-probe-person-${Date.now()}`
    });
    const judged = judge('online', online.res.status, online.body, online.elapsedMs);
    judged.aal = session.aal;
    results.push(judged);
  } catch (error) {
    results.push({
      label: 'online',
      verdict: 'BLOCKED',
      failures: [String(error.message || error)]
    });
  }

  const safe = results.map(row => ({
    ...row,
    reply: row.reply ? String(row.reply).slice(0, 1200) : null
  }));
  process.stdout.write(JSON.stringify(safe, null, 2) + '\n');
}

main().catch(error => {
  console.error(JSON.stringify({ verdict: 'ERROR', error: String(error.message || error) }));
  process.exit(1);
});
