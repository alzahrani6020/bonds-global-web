const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
  return env;
}

async function main() {
  Object.assign(process.env, loadEnvLocal());
  const { dataEngineRouter } = require('../api/data-engine.js');

  const token = process.env.ADMIN_TOKEN;
  const body = JSON.stringify({ cityCode: 'ABH', activityCode: 'dental_clinics', year: 2025 });

  const req = {
    method: 'POST',
    url: '/api/data/auto-fill',
    headers: {
      host: 'localhost',
      'x-admin-token': token,
      'content-type': 'application/json'
    },
    on(event, cb) {
      if (event === 'data') setImmediate(() => cb(Buffer.from(body)));
      if (event === 'end') setImmediate(() => cb());
    }
  };

  let status = null;
  let response = '';
  const res = {
    statusCode: 200,
    setHeader() {},
    end(data) {
      status = this.statusCode;
      response = data;
    }
  };

  await dataEngineRouter(req, res, '/data/auto-fill');
  console.log('Status:', status);
  console.log(response.slice(0, 2000));
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
