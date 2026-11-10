'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const FALLBACK_PORT = 3099;

let child = null;

function ping(url, ms = 800) {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.setTimeout(ms, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitFor(url, ms = 10000) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    if (await ping(url)) return true;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
}

async function isHealthy(origin) {
  if (!(await ping(origin + '/'))) return false;
  if (!(await ping(origin + '/admin/dashboard.html'))) return false;
  return ping(origin + '/api/env');
}

async function resolveBaseUrl() {
  const requested = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/$/, '') : '';
  const preferred = 'http://127.0.0.1:3010';
  const candidates = [preferred, requested, 'http://127.0.0.1:3005']
    .filter(Boolean)
    .filter((url, index, list) => list.indexOf(url) === index);

  for (const url of candidates) {
    if (await isHealthy(url)) return url;
  }

  child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'dev-server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(FALLBACK_PORT) },
    stdio: 'ignore'
  });
  const url = `http://127.0.0.1:${FALLBACK_PORT}`;
  if (await waitFor(url + '/')) return url;
  stopSpawnedServer();
  throw new Error('Failed to start local UI test server on ' + FALLBACK_PORT);
}

function stopSpawnedServer() {
  if (!child) return;
  child.kill();
  child = null;
}

module.exports = { resolveBaseUrl, stopSpawnedServer };
