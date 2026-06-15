const fs = require('fs');
const path = require('path');
const http = require('http');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
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

async function main() {
  Object.assign(process.env, loadEnvLocal());
  const apiHandler = require('../api/index.js');
  const root = path.join(__dirname, '..');

  const server = http.createServer(async (req, res) => {
    const start = Date.now();
    const log = (status, note = '') => {
      console.log(`[${Date.now() - start}ms] ${req.method} ${req.url} -> ${status} ${note}`);
    };

    // API routes
    if (req.url.startsWith('/api/')) {
      try {
        await apiHandler(req, res);
        log(res.statusCode);
      } catch (err) {
        console.error('[dev-server] API error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        log(500, err.message);
      }
      return;
    }

    // Static files + SPA-like HTML rewrites
    let filePath = path.join(root, req.url.split('?')[0]);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!path.extname(filePath)) {
      const htmlCandidate = filePath + '.html';
      if (fs.existsSync(htmlCandidate)) filePath = htmlCandidate;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Try fallback index.html for unknown paths (SPA behavior)
        const indexFile = path.join(root, 'index.html');
        fs.readFile(indexFile, (err2, indexData) => {
          if (err2) {
            res.statusCode = 404;
            res.end('Not found');
            log(404);
          } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(indexData);
            log(200, 'fallback index.html');
          }
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.end(data);
      log(200, path.basename(filePath));
    });
  });

  const port = process.env.PORT || 3005;
  server.listen(port, () => {
    console.log(`Dev server listening on http://localhost:${port}`);
    console.log(`City Comparison: http://localhost:${port}/city-comparison`);
    console.log(`Project Readiness: http://localhost:${port}/project-readiness`);
    console.log(`Opportunity Bank: http://localhost:${port}/opportunity-bank`);
  });
}

main().catch(err => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
