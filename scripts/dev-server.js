/**
 * Bonds Global — Local dev server that mimics root vercel.json rewrites.
 *
 * Usage from project root:
 *   node scripts/dev-server.js
 *
 * Supports:
 *   - Static files (with .html fallback and cleanUrls behavior)
 *   - /api/*     -> api/*.js handlers
 *   - /api/v3/*  -> api/v3/index.js wrapper
 *   - /v3/*      -> v3/ static files
 *   - /pro       -> pro/index.html
 *   - /blog/*    -> blog/* rewrites
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim().replace(/\r$/, '');
  });
  return env;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const ROOT = path.join(__dirname, '..');

// Pre-compile API handler cache
const apiHandlers = {};
function getApiHandler(fileName) {
  if (!apiHandlers[fileName]) {
    const fullPath = path.join(ROOT, 'api', fileName);
    if (!fs.existsSync(fullPath)) return null;
    // Clear require cache so edits are picked up without restart
    delete require.cache[require.resolve(fullPath)];
    apiHandlers[fileName] = require(fullPath);
  }
  return apiHandlers[fileName];
}

function resolveApiRoute(reqUrl) {
  const pathname = reqUrl.split('?')[0];

  // V3 API wrapper — must come before generic /api/:name
  if (pathname === '/api/v3' || pathname.startsWith('/api/v3/')) {
    return 'v3/index.js';
  }

  // Specific rewrites defined before /api/:name in vercel.json
  const specific = {
    '/api/pro': 'pro.js',
    '/api/force-reset': 'admin.js',
    '/api/reset-password': 'admin.js',
    '/api/track': 'site.js',
    '/api/moyasar-checkout': 'moyasar.js',
    '/api/moyasar-verify': 'moyasar.js',
    '/api/moyasar-webhook': 'moyasar.js',
    '/api/nps-check': 'nps.js',
    '/api/nps-submit': 'nps.js',
    '/api/send-nps': 'nps.js',
    '/api/advisors': 'advisors.js',
    '/api/advisor-dashboard': 'advisors.js',
    '/api/advisor-update-review': 'advisors.js',
    '/api/funding-readiness': 'funding.js',
    '/api/funding-readiness/': 'funding.js',
    '/api/bank-partner-request': 'funding.js',
    '/api/bank-partner-request/': 'funding.js',
    '/api/create-checkout': 'checkout.js',
    '/api/create-checkout/': 'checkout.js',
    '/api/create-oneoff-checkout': 'checkout.js',
    '/api/create-oneoff-checkout/': 'checkout.js',
    '/api/webhook': 'billing.js',
    '/api/webhook/': 'billing.js',
    '/api/bank-transfer': 'funding.js',
    '/api/bank-transfer/': 'funding.js',
    '/api/funding-sources': 'funding.js',
    '/api/funding-sources/': 'funding.js',
    '/api/contact': 'site.js',
    '/api/contact/': 'site.js',
    '/api/usage': 'site.js',
    '/api/usage/': 'site.js',
    '/api/analyze-feasibility-v2': 'analyze-feasibility.js'
  };
  if (specific[pathname]) return specific[pathname];

  // Generic /api/:name -> /api/:name.js
  const match = pathname.match(/^\/api\/([^/]+)$/);
  if (match) {
    const candidate = `${match[1]}.js`;
    if (getApiHandler(candidate)) return candidate;
  }

  return null;
}

function applyStaticRewrite(pathname) {
  const blogRedirects = {
    '/break-even-explained.html': '/blog/break-even-explained.html',
    '/cash-flow-mistakes.html': '/blog/cash-flow-mistakes.html',
    '/financial-kpis.html': '/blog/financial-kpis.html',
    '/pricing-strategy.html': '/blog/pricing-strategy.html',
    '/tax-zakat-sme.html': '/blog/tax-zakat-sme.html'
  };
  if (blogRedirects[pathname]) return blogRedirects[pathname];

  if (pathname === '/pro' || pathname === '/pro/') return '/pro/index.html';
  if (pathname === '/v3/admin' || pathname.startsWith('/v3/admin/')) return '/v3/admin/index.html';

  return pathname;
}

function safeFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath).replace(/\0/g, '');
  const normalized = path.normalize(decoded);
  if (normalized.startsWith('..') || normalized.includes('/../') || normalized.includes('\\..')) {
    return null;
  }
  return normalized;
}

function resolveStaticFile(reqUrl) {
  let pathname = reqUrl.split('?')[0];
  pathname = applyStaticRewrite(pathname);
  const rel = safeFilePath(pathname);
  if (!rel) return null;

  let filePath = path.join(ROOT, rel);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!path.extname(filePath)) {
    const htmlCandidate = filePath + '.html';
    if (fs.existsSync(htmlCandidate)) filePath = htmlCandidate;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }
  return null;
}

function sendStatic(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, log) {
  const apiFile = resolveApiRoute(req.url);
  if (!apiFile) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'API route not found' }));
    log(404, 'no handler');
    return;
  }

  const handler = getApiHandler(apiFile);
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'API handler not found' }));
    log(404, apiFile);
    return;
  }

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-admin-token');
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    log(200, 'CORS preflight');
    return;
  }

  try {
    await handler(req, res);
    log(res.statusCode || 200, apiFile);
  } catch (err) {
    console.error('[dev-server] API error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
    log(500, err.message);
  }
}

async function main() {
  Object.assign(process.env, loadEnvLocal());

  const server = http.createServer(async (req, res) => {
    const start = Date.now();
    const log = (status, note = '') => {
      console.log(`[${Date.now() - start}ms] ${req.method} ${req.url} -> ${status} ${note}`);
    };

    // Polyfill Vercel/Express response helpers used by root API handlers
    if (!res.status) {
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
    }
    if (!res.json) {
      res.json = (obj) => {
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'application/json');
        }
        res.end(JSON.stringify(obj));
        return res;
      };
    }
    if (!res.send) {
      res.send = (data) => {
        res.end(data);
        return res;
      };
    }

    if (req.url.startsWith('/api/')) {
      return handleApi(req, res, log);
    }

    const filePath = resolveStaticFile(req.url);
    if (filePath) {
      res.statusCode = 200;
      sendStatic(filePath, res);
      log(200, path.relative(ROOT, filePath));
      return;
    }

    // SPA fallback for unknown non-API paths
    const fallback = path.join(ROOT, 'index.html');
    if (fs.existsSync(fallback)) {
      res.statusCode = 200;
      sendStatic(fallback, res);
      log(200, 'fallback index.html');
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not found');
    log(404);
  });

  const port = process.env.PORT || 3005;
  server.listen(port, () => {
    console.log(`Bonds Global dev server: http://localhost:${port}`);
    console.log(`V3 examples:`);
    console.log(`  http://localhost:${port}/v3/city-intelligence`);
    console.log(`  http://localhost:${port}/api/v3/health`);
  });
}

main().catch(err => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
