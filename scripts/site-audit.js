#!/usr/bin/env node
// ============================================
// Bonds Global — Site Audit Script
// Usage: node scripts/site-audit.js
// ============================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE_DIRS = ['node_modules', '.git', '.vercel', 'supabase', '.github', 'tools', 'scripts', 'tests', 'bonds-v2', 'v3'];
const IGNORE_FILES = ['modon_eservices.html', 'modon_home.html', 'supabase-email-templates.html'];
const SENSITIVE_PATTERNS = [
  /sk_live_[a-zA-Z0-9]{24,}/g,
  /sk_test_[a-zA-Z0-9]{24,}/g,
  /pk_live_[a-zA-Z0-9]{24,}/g,
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g,
];

let issues = [];
let checked = 0;

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (IGNORE_DIRS.includes(entry)) continue;
      walk(full, callback);
    } else if (stat.isFile()) {
      callback(full);
    }
  }
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function addIssue(sev, file, line, msg) {
  issues.push({ sev, file: rel(file), line, msg });
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// ============ HTML Audit ============
function auditHTML(file, content) {
  // Skip admin fragments (partial HTML without DOCTYPE)
  if (rel(file).includes('/admin/') && !content.trim().startsWith('<!DOCTYPE')) return;
  const selfClosing = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const voidBlocks = new Set(['script','style','template','textarea']);
  const ids = new Map();
  const tagStack = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*?>/g;
  const srcHrefRegex = /(?:src|href)\s*=\s*["']([^"']+)["']/g;

  // Strip script/style/template/textarea blocks to avoid false positives from JS code
  let strippedContent = content.replace(/<(script|style|template|textarea)[^>]*>[\s\S]*?<\/\1>/gi, '');
  let m;

  while ((m = tagRegex.exec(strippedContent)) !== null) {
    const fullTag = m[0];
    const tagName = m[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || selfClosing.has(tagName);
    // Map index in stripped content back to original content for accurate line numbers
    const lineNum = content.slice(0, m.index).split('\n').length;

    // Duplicate IDs
    const idMatch = fullTag.match(/\sid\s*=\s*["']([^"']+)["']/);
    if (idMatch) {
      const idVal = idMatch[1];
      if (ids.has(idVal)) {
        addIssue('MEDIUM', file, lineNum, `Duplicate ID "${idVal}" (first at line ${ids.get(idVal)})`);
      } else {
        ids.set(idVal, lineNum);
      }
    }

    // Simple unclosed tag stack
    if (voidBlocks.has(tagName)) continue;
    if (isClosing) {
      let found = false;
      for (let i = tagStack.length - 1; i >= 0; i--) {
        if (tagStack[i].name === tagName) {
          tagStack.splice(i, 1);
          found = true;
          break;
        }
      }
      if (!found) {
        addIssue('MEDIUM', file, lineNum, `Closing tag </${tagName}> without matching opening tag`);
      }
    } else if (!isSelfClosing) {
      tagStack.push({ name: tagName, line: lineNum });
    }
  }

  for (const t of tagStack) {
    addIssue('HIGH', file, t.line, `Unclosed tag <${t.name}>`);
  }

  // Check referenced assets
  while ((m = srcHrefRegex.exec(content)) !== null) {
    const rawUrl = m[1];
    const lineNum = content.slice(0, m.index).split('\n').length;

    // Skip external URLs, data URIs, javascript:, mailto:, tel:
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(rawUrl)) continue;

    // Skip template literals (dynamic URLs)
    if (rawUrl.includes('${')) continue;

    // Skip API endpoints, Vercel scripts, auth redirects, and root JS assets
    if (rawUrl.startsWith('/api/') || rawUrl.startsWith('/_vercel/') || rawUrl.startsWith('/calculators/auth/?') || rawUrl.startsWith('/supabase-client.js') || rawUrl.startsWith('/auth-guard.js')) continue;

    // For paths starting with /, check relative to root (but skip absolute API paths)
    if (rawUrl.startsWith('/')) {
      const cleanUrl = rawUrl.split('?')[0].split('#')[0];
      const rootTarget = path.join(ROOT, cleanUrl);
      if (fileExists(rootTarget)) continue;
      // Also check as directory
      if (fileExists(path.join(rootTarget, 'index.html'))) continue;
      addIssue('CRITICAL', file, lineNum, `Missing absolute path: ${rawUrl}`);
      continue;
    }

    // Strip hash fragment for file existence check
    const url = rawUrl.split('#')[0];
    if (!url) continue;

    const htmlDir = path.dirname(file);
    const target = path.resolve(htmlDir, url);

    if (fileExists(target)) continue;
    if (fileExists(path.join(target, 'index.html'))) continue;

    // Skip if the path has query params (e.g. ?v=5) — just check base file
    const baseUrl = url.split('?')[0];
    if (baseUrl !== url) {
      const baseTarget = path.resolve(htmlDir, baseUrl);
      if (fileExists(baseTarget)) continue;
      if (fileExists(path.join(baseTarget, 'index.html'))) continue;
    }

    addIssue('CRITICAL', file, lineNum, `Missing file: ${rawUrl}`);
  }

  // Check for unescaped </script> inside script blocks
  const scriptBlocks = content.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
  for (const block of scriptBlocks) {
    const blockStart = content.indexOf(block);
    const blockLines = block.split('\n');
    for (let i = 0; i < blockLines.length; i++) {
      const line = blockLines[i];
      // Match </script> inside string literals (heuristic)
      const matches = line.match(/["'][^"']*<\/script>[^"']*["']/gi);
      if (matches) {
        for (const match of matches) {
          if (!match.includes("scr${''}ipt")) {
            const globalLine = content.slice(0, blockStart).split('\n').length + i;
            addIssue('CRITICAL', file, globalLine, `Unescaped </script> inside JS string`);
          }
        }
      }
    }
  }
}

// ============ JS Audit ============
function auditJS(file, content) {
  const lines = content.split('\n');
  const relPath = rel(file);
  const isBackend = relPath.startsWith('api/') || relPath.startsWith('scripts/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // console.log in frontend (skip lib/ backend utilities)
    if (!isBackend && !relPath.startsWith('lib/') && /console\.log\(/.test(line)) {
      addIssue('LOW', file, i + 1, `console.log leftover`);
    }

    // Secrets
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(line)) {
        addIssue('CRITICAL', file, i + 1, `Potential secret/token exposed`);
      }
    }
  }

  // Syntax check
  if (!isBackend && !file.endsWith('.test.js')) {
    try {
      new Function(content);
    } catch (e) {
      const match = e.message.match(/line (\d+)/i);
      const line = match ? parseInt(match[1]) : 0;
      addIssue('HIGH', file, line, `JS syntax error: ${e.message}`);
    }
  }
}

// ============ Main ============
console.log('🔍 Bonds Global Site Audit\n');

walk(ROOT, (file) => {
  const basename = path.basename(file);
  if (basename.startsWith('.') || basename.endsWith('.min.js')) return;
  if (IGNORE_FILES.includes(basename)) return;

  let content;
  try { content = fs.readFileSync(file, 'utf-8'); } catch { return; }
  checked++;

  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') auditHTML(file, content);
  else if (ext === '.js') auditJS(file, content);
});

// Deduplicate
const seen = new Set();
issues = issues.filter(i => {
  const key = `${i.file}:${i.line}:${i.msg}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
for (const i of issues) counts[i.sev]++;

console.log(`Checked ${checked} files. Found ${issues.length} issues:\n`);
console.log(`  🔴 CRITICAL: ${counts.CRITICAL}`);
console.log(`  🟠 HIGH:     ${counts.HIGH}`);
console.log(`  🟡 MEDIUM:   ${counts.MEDIUM}`);
console.log(`  🟢 LOW:      ${counts.LOW}`);

if (issues.length > 0) {
  const grouped = {};
  for (const i of issues) {
    if (!grouped[i.sev]) grouped[i.sev] = [];
    grouped[i.sev].push(i);
  }
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const list = grouped[sev];
    if (!list) continue;
    console.log(`\n${'='.repeat(50)}`);
    console.log(` ${sev} (${list.length})`);
    console.log(`${'='.repeat(50)}`);
    for (const i of list) {
      console.log(`  ${i.file}:${i.line} — ${i.msg}`);
    }
  }
}

console.log('\n');
if (counts.CRITICAL > 0 || counts.HIGH > 0) {
  console.log('❌ Audit FAILED — fix CRITICAL and HIGH issues before deploying.');
  process.exit(1);
} else {
  console.log('✅ Audit PASSED');
  process.exit(0);
}
