#!/usr/bin/env node
/**
 * Fix V3 pages to use styles/tokens.css and support light/dark themes.
 * - Inserts tokens.css link before the inline <style> block.
 * - Removes hard-coded :root { ... } blocks.
 * - Rewrites var(--card) to var(--bg-card) so light theme works.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'v3/index.html',
  'v3/alerts.html',
  'v3/admin/index.html',
  'v3/city-comparison.html',
  'v3/city-intelligence.html',
  'v3/investment-map.html',
  'v3/opportunity-bank.html',
  'v3/project-readiness.html',
  'v3/scenarios.html'
].map(f => path.resolve(process.cwd(), f));

function relativeTokens(file) {
  const dir = path.dirname(file);
  const rel = path.relative(dir, path.resolve(process.cwd(), 'styles/tokens.css'));
  return rel.replace(/\\/g, '/');
}

function processFile(file) {
  let html = fs.readFileSync(file, 'utf8');

  // Add tokens.css before the first inline <style> if not already linked
  const tokensHref = relativeTokens(file);
  if (!html.includes(tokensHref)) {
    html = html.replace(/\s*<style>/i, `\n  <link rel="stylesheet" href="${tokensHref}">\n  <style>`);
  }

  // Remove the inline :root { ... } block (dark hard-coded variables)
  html = html.replace(/:root\s*\{[\s\S]*?\}\s*/i, '');

  // Rewrite --card to --bg-card so it follows tokens.css theming
  html = html.replace(/var\(--card\)/g, 'var(--bg-card)');

  fs.writeFileSync(file, html, 'utf8');
  console.log('✓', path.relative(process.cwd(), file));
}

for (const file of files) {
  processFile(file);
}
