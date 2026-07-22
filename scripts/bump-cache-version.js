#!/usr/bin/env node
/**
 * Bonds Global — Auto-bump sw.js CACHE_VERSION
 *
 * Runs in GitHub Actions after a push to main/master. It compares the
 * files changed in the push against the CORE_ASSETS list defined in sw.js.
 * If any core asset changed, it increments the patch segment of
 * CACHE_VERSION and commits the result.
 *
 * This script is intentionally lightweight and has zero runtime impact.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SW_PATH = path.join(ROOT, 'sw.js');

function main() {
  if (!fs.existsSync(SW_PATH)) {
    console.error('sw.js not found at', SW_PATH);
    process.exit(1);
  }

  const content = fs.readFileSync(SW_PATH, 'utf8');

  // Extract the CORE_ASSETS array contents.
  const arrayMatch = content.match(/const\s+CORE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  if (!arrayMatch) {
    console.error('Could not locate CORE_ASSETS array in sw.js');
    process.exit(1);
  }

  const watchedPaths = extractPaths(arrayMatch[1]);
  if (watchedPaths.length === 0) {
    console.error('CORE_ASSETS array appears to be empty');
    process.exit(1);
  }

  const changedFiles = getChangedFiles();
  if (changedFiles.length === 0) {
    console.log('No files changed in this push.');
    return;
  }

  const shouldBump = changedFiles.some((file) => isWatchedPath(file, watchedPaths));

  if (!shouldBump) {
    console.log('No core assets changed. CACHE_VERSION not bumped.');
    return;
  }

  const newContent = bumpCacheVersion(content);
  fs.writeFileSync(SW_PATH, newContent, 'utf8');
  console.log('CACHE_VERSION bumped successfully.');
}

function extractPaths(arrayText) {
  const paths = [];
  const regex = /['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(arrayText)) !== null) {
    const clean = match[1].split('?')[0].replace(/^\/+/, '');
    if (clean) paths.push(clean);
  }
  return paths;
}

function getChangedFiles() {
  const before = process.env.GITHUB_EVENT_BEFORE || '';
  const after = process.env.GITHUB_EVENT_AFTER || 'HEAD';

  try {
    // For push events GitHub provides before/after SHAs.
    // For new branches or local runs, fall back to the last commit diff.
    let diff;
    if (before && !/^0+$/.test(before)) {
      diff = execSync(`git diff --name-only ${before} ${after}`, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } else {
      diff = execSync('git diff --name-only HEAD~1 HEAD', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    }
    return diff.split('\n').map((f) => f.trim()).filter(Boolean);
  } catch (err) {
    console.error('Failed to determine changed files:', err.message);
    process.exit(1);
  }
}

function isWatchedPath(file, watchedPaths) {
  const normalized = file.replace(/^\/+/, '');
  return watchedPaths.some((wp) => {
    if (normalized === wp) return true;
    // Watch directories recursively (e.g. "admin/financial-advisory/").
    if (!path.extname(wp) && normalized.startsWith(wp + '/')) return true;
    return false;
  });
}

function bumpCacheVersion(content) {
  return content.replace(
    /const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"];/,
    (match, current) => {
      const next = incrementVersion(current);
      console.log(`Bumping CACHE_VERSION: ${current} → ${next}`);
      return `const CACHE_VERSION = '${next}';`;
    }
  );
}

function incrementVersion(version) {
  const match = version.match(/^(v?)(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    // Unknown format: append a patch segment so we still invalidate cache.
    return version.endsWith('.1') ? version : version + '.1';
  }
  const [, prefix, major, minor, patch, suffix] = match;
  return `${prefix}${major}.${minor}.${parseInt(patch, 10) + 1}${suffix}`;
}

main();
