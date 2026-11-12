const v3Handler = require('../../v3/api/index.js');
const { checkRateLimit } = require('../../lib/api/rate-limit');
const { setAllowedOrigin } = require('../../lib/api/cors');

function setCors(res, req) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-token');
}

module.exports = async function handler(req, res) {
  setCors(res, req);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rewrittenPath = String(req.query?.__path || url.searchParams.get('__path') || '').trim();
  const path = rewrittenPath
    ? '/' + rewrittenPath.replace(/^\/+/, '')
    : (url.pathname.replace(/^\/api\/v3/, '').replace(/^\/api/, '') || '/');

  const route = req.query?.__route;
  if (route && String(route).startsWith('social-')) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    return require('../../lib/social/api-handlers')(req, res, route);
  }

  if (path === '/analyze-document' || path === '/analyze-document/') {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (await checkRateLimit('document_analysis', req, res, undefined, true)) {
      return;
    }
    return require('../../lib/api/analyze-document')(req, res);
  }

  return v3Handler(req, res);
};
