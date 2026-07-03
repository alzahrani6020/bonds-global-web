#!/usr/bin/env node
/**
 * API Auth & Routing Audit
 *
 * Scans frontend HTML/JS files for fetch('/api/...') calls and checks:
 * 1. The endpoint exists (handler file or vercel.json rewrite)
 * 2. If the endpoint requires auth, the frontend sends Authorization header
 *
 * Exit code: 0 if no issues, 1 otherwise
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API_DIR = path.join(ROOT, 'api');
const VERCEL_JSON = path.join(ROOT, 'vercel.json');

const AUTH_PATTERNS = [
  /verifyBearer\b/,
  /verifyBearerAndUser\b/,
  /verifyAdmin\b/,
  /verifyAdminStrict\b/,
  /req\.headers\.authorization/,
  /req\.headers\?.authorization/
];

const PUBLIC_ENDPOINT_OVERRIDES = [
  '/api/env',
  '/api/advisors',
  '/api/contact',
  '/api/nps-submit',
  '/api/nps-check',
  '/api/send-nps',
  '/api/track',
  '/api/usage',
  '/api/log-usage',
  '/api/pro',
  '/api/funding-sources',
  '/api/funding-readiness',
  '/api/bank-partner-request',
  '/api/bank-transfer',
  '/api/analyze-feasibility',
  '/api/analyze-feasibility-v2',
  '/api/send-letter',
  // Admin password reset uses admin-email check, not Bearer
  '/api/reset-password',
  '/api/force-reset'
];

const AUTH_HELPER_PATTERNS = [
  /authHeaders\s*\(\)/,
  /getAdminToken\s*\(\)/,
  /window\.__ADMIN_TOKEN/,
  /session\.access_token/
];

// Endpoints where GET/HEAD/OPTIONS still require auth (empty by default)
const AUTH_REQUIRED_READ_ENDPOINTS = [];

const IGNORED_PATHS = [
  'node_modules',
  '.vercel',
  '.git',
  '__pycache__',
  'bonds-v2',
  'scripts'
];

function loadVercelRewrites() {
  try {
    const json = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8'));
    return json.rewrites || [];
  } catch (e) {
    console.error('Failed to read vercel.json:', e.message);
    return [];
  }
}

function resolveEndpoint(rawPath, rewrites, visited = new Set()) {
  // Normalize path: remove query string and trailing slash
  const cleanPath = rawPath.replace(/\?.*$/, '').replace(/\/$/, '');

  if (visited.has(cleanPath)) return { exists: false };
  visited.add(cleanPath);

  // Direct API file or directory index
  const directName = cleanPath.replace(/^\/api\//, '');
  const directFile = path.join(API_DIR, `${directName}.js`);
  if (fs.existsSync(directFile)) {
    return { exists: true, type: 'direct', file: directFile };
  }
  const indexFile = path.join(API_DIR, directName, 'index.js');
  if (fs.existsSync(indexFile)) {
    return { exists: true, type: 'direct', file: indexFile };
  }

  // Check rewrites (skip generic fallback that maps to itself)
  for (const rule of rewrites) {
    const source = rule.source;
    const dest = rule.destination;

    // Skip the generic catch-all fallback that doesn't point to a real handler
    if (dest === cleanPath || dest === rawPath) continue;

    // Convert vercel source pattern to regex
    let pattern = source
      .replace(/\//g, '\\/')
      .replace(/\(\?\:([^)]+)\)/g, '($1)')
      .replace(/\(\.\*\)/g, '(.+)')
      .replace(/\(\[\^\/\]\+\)/g, '([^/]+)')
      .replace(/\$$/, '');

    const regex = new RegExp(`^${pattern}$`);
    const match = cleanPath.match(regex);
    if (match) {
      // Resolve destination
      let resolvedDest = dest;
      match.slice(1).forEach((group, index) => {
        resolvedDest = resolvedDest.replace(`$${index + 1}`, group);
      });

      // If destination is an API path, resolve it recursively
      if (resolvedDest.startsWith('/api/')) {
        const nested = resolveEndpoint(resolvedDest, rewrites, visited);
        if (nested.exists) return nested;
      } else {
        return { exists: true, type: 'rewrite', source, destination: resolvedDest };
      }
    }
  }

  return { exists: false };
}

function endpointRequiresAuth(endpoint, resolved, rewrites, method = 'GET') {
  const baseEndpoint = endpoint.replace(/\?.*$/, '');
  if (PUBLIC_ENDPOINT_OVERRIDES.includes(baseEndpoint)) return false;

  const readMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  if (readMethod && !AUTH_REQUIRED_READ_ENDPOINTS.includes(baseEndpoint)) {
    return false;
  }

  let handlerPath = null;

  if (resolved.type === 'direct') {
    handlerPath = resolved.file;
  } else if (resolved.type === 'rewrite') {
    // Resolve destination further if it's also an API path
    const dest = resolved.destination;
    if (dest.startsWith('/api/')) {
      const nested = resolveEndpoint(dest, rewrites);
      if (nested.exists && nested.type === 'direct') {
        handlerPath = nested.file;
      }
    }
  }

  if (!handlerPath || !fs.existsSync(handlerPath)) return false;

  const code = fs.readFileSync(handlerPath, 'utf8');
  return AUTH_PATTERNS.some(p => p.test(code));
}

function findFetchCalls(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const calls = [];

  // Match fetch('/api/...' or fetch("/api/...")
  const regex = /fetch\(\s*['"](\/api\/[^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const endpoint = match[1];
    const startPos = match.index;

    // Find the enclosing fetch() call and check for Authorization header and HTTP method
    let parenCount = 1;
    let i = startPos + match[0].length;
    const callEnd = content.length;

    while (i < callEnd && parenCount > 0) {
      const char = content[i];
      if (char === '(') parenCount++;
      else if (char === ')') parenCount--;
      i++;
    }

    const callSlice = content.slice(startPos, i);
    const hasAuth = /['"]Authorization['"]\s*:/.test(callSlice) ||
              /Authorization\s*:/.test(callSlice) ||
              AUTH_HELPER_PATTERNS.some(p => p.test(callSlice));

    // Detect explicit HTTP method; default to GET when absent
    let method = 'GET';
    const methodMatch = callSlice.match(/method\s*:\s*['"]([A-Z]+)['"]/i);
    if (methodMatch) {
      method = methodMatch[1].toUpperCase();
    }

    calls.push({ endpoint, hasAuth, method, line: content.slice(0, startPos).split('\n').length });
  }

  return calls;
}

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(ROOT, fullPath);
    if (entry.isDirectory()) {
      if (IGNORED_PATHS.some(p => relative === p || relative.startsWith(p + path.sep))) continue;
      walk(fullPath, callback);
    } else if (/\.(html|js)$/.test(entry.name)) {
      callback(fullPath);
    }
  }
}

function main() {
  const rewrites = loadVercelRewrites();
  const issues = [];
  const checkedFiles = [];

  walk(ROOT, (filePath) => {
    const calls = findFetchCalls(filePath);
    if (calls.length === 0) return;

    checkedFiles.push({ file: path.relative(ROOT, filePath), calls });

    for (const call of calls) {
      const resolved = resolveEndpoint(call.endpoint, rewrites);

      if (!resolved.exists) {
        issues.push({
          type: 'missing_endpoint',
          severity: 'high',
          file: path.relative(ROOT, filePath),
          line: call.line,
          endpoint: call.endpoint,
          message: `Endpoint has no handler or rewrite`
        });
        continue;
      }

      const requiresAuth = endpointRequiresAuth(call.endpoint, resolved, rewrites, call.method);
      if (requiresAuth && !call.hasAuth) {
        issues.push({
          type: 'missing_auth',
          severity: 'critical',
          file: path.relative(ROOT, filePath),
          line: call.line,
          endpoint: call.endpoint,
          message: `Endpoint requires Authorization header but frontend does not send it`
        });
      }
    }
  });

  console.log('🔍 API Auth & Routing Audit\n');
  console.log(`Checked ${checkedFiles.reduce((sum, f) => sum + f.calls.length, 0)} fetch calls in ${checkedFiles.length} files.\n`);

  if (issues.length === 0) {
    console.log('✅ No API auth or routing issues found.');
    process.exit(0);
  }

  const critical = issues.filter(i => i.severity === 'critical');
  const high = issues.filter(i => i.severity === 'high');

  console.log(`Found ${issues.length} issue(s):`);
  console.log(`  🔴 CRITICAL (missing auth): ${critical.length}`);
  console.log(`  🟠 HIGH (missing endpoint): ${high.length}\n`);

  for (const issue of issues) {
    const icon = issue.severity === 'critical' ? '🔴' : '🟠';
    console.log(`${icon} ${issue.file}:${issue.line}`);
    console.log(`   Endpoint: ${issue.endpoint}`);
    console.log(`   ${issue.message}\n`);
  }

  process.exit(1);
}

main();
