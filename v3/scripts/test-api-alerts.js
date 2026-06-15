const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
  return env;
}

function request(options) {
  return new Promise((resolve, reject) => {
    const handler = require('../api/index.js');
    const req = {
      method: options.method || 'GET',
      url: options.path + (options.query ? '?' + new URLSearchParams(options.query).toString() : ''),
      headers: Object.assign({ host: 'localhost' }, options.headers || {})
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(data) {
        resolve({ status: this.statusCode, headers: this.headers, body: data });
      }
    };
    handler(req, res).catch(reject);
  });
}

async function main() {
  const env = loadEnvLocal();
  Object.assign(process.env, env);

  const token = process.env.ADMIN_TOKEN;
  const paths = [
    { method: 'GET', path: '/api/admin/alert-rules', headers: { 'x-admin-token': token } },
    { method: 'POST', path: '/api/admin/alerts/evaluate', headers: { 'x-admin-token': token } }
  ];

  for (const p of paths) {
    try {
      const r = await request(p);
      console.log(`${p.method} ${p.path} -> ${r.status}`);
      console.log(r.body.slice(0, 500));
    } catch (err) {
      console.error(`${p.method} ${p.path} error:`, err);
    }
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
