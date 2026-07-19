const v3Handler = require('../../v3/api/index.js');
const { checkRateLimit } = require('../../lib/api/rate-limit');
const { setAllowedOrigin } = require('../../lib/api/cors');

function getCategory(path) {
  if (path === '/billing/webhook' || path.startsWith('/billing/webhook/')) return 'webhook';
  if (path === '/billing/checkout' || path === '/billing/subscription') return 'auth';
  if (path.startsWith('/auth')) return 'auth';
  if (path.startsWith('/admin') || path.startsWith('/cron')) return 'strict';
  if (path === '/ai/chat') return 'ai';
  if (path === '/calculate' || path.startsWith('/calculate/') || path === '/compare/cities') return 'compute';
  return 'public';
}

function setCors(res, req) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-token');
}

module.exports = async function handler(req, res) {
  setCors(res, req);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace(/^\/api\/v3/, '').replace(/^\/api/, '') || '/';

  if (path === '/analyze-document' || path === '/analyze-document/') {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return require('../../lib/api/analyze-document')(req, res);
  }

  const category = getCategory(path);
  if (await checkRateLimit(category, req, res)) {
    return;
  }

  return v3Handler(req, res);
};
