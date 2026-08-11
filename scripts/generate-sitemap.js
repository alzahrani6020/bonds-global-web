#!/usr/bin/env node
/**
 * Generate a clean, SEO-friendly sitemap.xml for bonds-global.com.
 *
 * Usage:
 *   node scripts/generate-sitemap.js
 *
 * The script scans the repository for public HTML files, filters out
 * private/internal pages, and writes a sitemap with appropriate
 * priorities and change frequencies.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://bonds-global.com';
const OUTPUT = path.join(process.cwd(), 'sitemap.xml');

// Directories that should never appear in the public sitemap.
// Directory names that are excluded at any depth in the tree.
const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.vercel',
  '.github',
  '.githooks',
  '.vscode',
  'admin',
  'api',
  'components',
  'tests',
  'tools',
  'scripts',
  'supabase',
  'templates',
  'client',
  'my-bonds',
  'auth',
  'geo-data',
  'platform-data',
]);

// Specific files that are internal, auth, debug, or duplicate landing pages.
const EXCLUDED_FILES = new Set([
  'test.html',
  'v.html',
  'proof.html',
  'letterhead.html',
  'verify.html',
  'auth.html',
  'auth-v2.html',
  '404.html',
  '500.html',
  'maintenance.html',
]);

function isExcludedDir(relDir) {
  const parts = relDir.split(/[/\\]/).filter(Boolean);
  return parts.some((part) => EXCLUDED_DIR_NAMES.has(part));
}

function walk(dir, files = [], relPrefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (isExcludedDir(relPath)) continue;
      walk(fullPath, files, relPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      if (isExcludedDir(relPath)) continue;
      if (EXCLUDED_FILES.has(entry.name)) continue;
      files.push(relPath);
    }
  }
  return files;
}

function toUrlPath(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized === 'index.html') return '';
  if (normalized.endsWith('/index.html')) {
    return normalized.slice(0, -'index.html'.length);
  }
  return normalized;
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPriority(relPath) {
  const urlPath = toUrlPath(relPath);
  const segments = urlPath.split('/').filter(Boolean);

  // Root homepage is the most important page.
  if (urlPath === '' || urlPath === 'index.html') return '1.0';

  // English homepage and top-level marketing pages.
  if (segments.length === 1) {
    return '0.8';
  }

  // Calculators are high-value landing pages.
  if (segments[0] === 'calculators' || (segments[0] === 'en' && segments[1] === 'calculators')) {
    return '0.7';
  }

  // V3 public pages and valuation tool.
  if (segments[0] === 'v3' || segments[0] === 'valuation' || segments[0] === 'advisor') {
    return urlPath === 'v3/' || urlPath === 'valuation/' || urlPath === 'advisor/' ? '0.8' : '0.7';
  }

  // Reports and blog content.
  if (segments[0] === 'reports' || segments[0] === 'blog') {
    return '0.6';
  }

  // Sector landing pages.
  if (segments[0] === 'sectors' || (segments[0] === 'en' && segments[1] === 'sectors')) {
    return '0.5';
  }

  return '0.5';
}

function getChangeFreq(relPath) {
  const urlPath = toUrlPath(relPath);
  const segments = urlPath.split('/').filter(Boolean);
  if (segments[0] === 'blog' || segments[0] === 'reports') return 'monthly';
  return 'weekly';
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function main() {
  const files = walk(process.cwd());
  const urls = files
    .map((relPath) => {
      const urlPath = toUrlPath(relPath);
      const fullUrl = `${BASE_URL}/${urlPath}`;
      const stats = fs.statSync(relPath);
      return {
        loc: fullUrl.replace(/\/$/, '') || `${BASE_URL}/`,
        lastmod: formatDate(stats.mtime),
        changefreq: getChangeFreq(relPath),
        priority: getPriority(relPath),
      };
    })
    .sort((a, b) => a.loc.localeCompare(b.loc));

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const url of urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(url.loc)}</loc>`);
    lines.push(`    <lastmod>${url.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${url.changefreq}</changefreq>`);
    lines.push(`    <priority>${url.priority}</priority>`);
    lines.push('  </url>');
  }

  lines.push('</urlset>');

  fs.writeFileSync(OUTPUT, lines.join('\n') + '\n', 'utf8');
  console.log(`Generated sitemap.xml with ${urls.length} URLs at ${OUTPUT}`);
}

main();
