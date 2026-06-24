#!/usr/bin/env node
/**
 * i18n audit — Bonds Global
 * Checks that Arabic HTML files have English counterparts and that lang/dir attributes are correct.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Directories/files that do not require an en/ mirror (per AGENTS.md and project conventions)
const EXCLUDED_DIRS = new Set([
  'en', 'v3', 'admin', 'blog', 'sectors', 'reports', 'tools', 'tests', 'scripts',
  'components', 'bonds-v2', 'docs', 'lib', 'assets', 'supabase', '.vercel', '.git',
  '.github', '.githooks', '.vscode', '.kimi', 'node_modules', '__pycache__', 'pro',
  'templates'
]);

// Specific root HTML files that are intentionally not translated (tools, redirects, tests, special landings)
const EXCLUDED_FILES = new Set([
  'test.html', 'v.html', 'proof.html', 'modon_eservices.html', 'modon_home.html',
  'دراسة-جدوى-إحياء-الأصول-الملقحة.html'
]);

function isExcluded(filePath) {
  const rel = path.relative(ROOT, filePath);
  const parts = rel.split(path.sep);
  if (parts.some(p => EXCLUDED_DIRS.has(p))) return true;
  if (parts.length === 1 && EXCLUDED_FILES.has(parts[0])) return true;
  return false;
}

function listHtmlFiles(dir) {
  const results = [];
  function walk(current) {
    if (isExcluded(current)) return;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        walk(path.join(current, entry));
      }
    } else if (stat.isFile() && current.endsWith('.html')) {
      results.push(current);
    }
  }
  walk(dir);
  return results;
}

function enCounterpart(arPath) {
  const rel = path.relative(ROOT, arPath);
  return path.join(ROOT, 'en', rel);
}

function readFirstLine(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);
    return buffer.toString('utf-8', 0, bytesRead);
  } catch (e) {
    return '';
  }
}

function checkLangDir(filePath, expectedLang, expectedDir) {
  const sample = readFirstLine(filePath);
  const htmlMatch = sample.match(/<html\b([^>]*)>/i);
  if (!htmlMatch) return ['missing <html> tag'];
  const attrs = htmlMatch[1];
  const issues = [];
  const langMatch = attrs.match(/lang=["']([^"']+)["']/i);
  const dirMatch = attrs.match(/dir=["']([^"']+)["']/i);
  if (!langMatch) issues.push('missing lang attribute');
  else if (langMatch[1] !== expectedLang) issues.push(`lang="${langMatch[1]}" (expected ${expectedLang})`);
  if (!dirMatch) issues.push('missing dir attribute');
  else if (dirMatch[1] !== expectedDir) issues.push(`dir="${dirMatch[1]}" (expected ${expectedDir})`);
  return issues;
}

function main() {
  const arFiles = listHtmlFiles(ROOT).filter(p => !p.startsWith(path.join(ROOT, 'en') + path.sep));
  const missing = [];
  const langIssues = [];

  for (const arPath of arFiles) {
    const rel = path.relative(ROOT, arPath);
    const enPath = enCounterpart(arPath);
    if (!fs.existsSync(enPath)) {
      missing.push(rel);
    } else {
      const arLangIssues = checkLangDir(arPath, 'ar', 'rtl');
      if (arLangIssues.length) langIssues.push(`${rel}: ${arLangIssues.join(', ')}`);
      const enLangIssues = checkLangDir(enPath, 'en', 'ltr');
      if (enLangIssues.length) langIssues.push(`en/${rel}: ${enLangIssues.join(', ')}`);
    }
  }

  // Also check that en/ files have an ar counterpart (catches orphaned English pages)
  const enFiles = listHtmlFiles(path.join(ROOT, 'en'));
  for (const enPath of enFiles) {
    const rel = path.relative(path.join(ROOT, 'en'), enPath);
    const arPath = path.join(ROOT, rel);
    if (!fs.existsSync(arPath)) {
      missing.push(`en/${rel} (no Arabic counterpart)`);
    }
  }

  console.log('🔍 Bonds Global i18n Audit\n');
  if (missing.length === 0 && langIssues.length === 0) {
    console.log('✅ All required HTML files have language counterparts and correct lang/dir attributes.');
    process.exit(0);
  }

  if (missing.length) {
    console.log('❌ Missing language counterpart:');
    missing.forEach(m => console.log(`  - ${m}`));
    console.log();
  }
  if (langIssues.length) {
    console.log('❌ Incorrect lang/dir attributes:');
    langIssues.forEach(i => console.log(`  - ${i}`));
    console.log();
  }
  process.exit(1);
}

main();
