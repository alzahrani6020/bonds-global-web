#!/usr/bin/env node
/**
 * Generate admin/calculator-status.json from the filesystem.
 *
 * Scans calculators/*.html and en/calculators/*.html to verify Arabic/English
 * existence, then merges with the feature-flags map below. Add explicit entries
 * when a calculator does not follow the default rollout flags.
 *
 * Usage:
 *   node scripts/generate-calculator-status.js
 *   npm run regenerate:calculator-status
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'admin', 'calculator-status.json');

/**
 * Explicit feature flags. Calculators not listed here use defaults:
 *   anonymous=true, guestSave=true, v3=true, sticky=true
 * Use this map to mark legacy/limited calculators.
 */
const FEATURE_FLAGS = {
  dashboard: { anonymous: false, guestSave: false, v3: false, sticky: false }
};

function listCalculatorNames() {
  const dir = path.join(ROOT, 'calculators');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace(/\.html$/, ''))
    .sort();
}

function buildStatus() {
  const names = listCalculatorNames();
  const calculators = names.map(name => {
    const arPath = path.join(ROOT, 'calculators', `${name}.html`);
    const enPath = path.join(ROOT, 'en', 'calculators', `${name}.html`);
    const flags = FEATURE_FLAGS[name] || {};
    const isDashboard = name === 'dashboard';

    return {
      name,
      ar: fs.existsSync(arPath),
      en: fs.existsSync(enPath),
      anonymous: flags.anonymous !== undefined ? flags.anonymous : !isDashboard,
      guestSave: flags.guestSave !== undefined ? flags.guestSave : !isDashboard,
      v3: flags.v3 !== undefined ? flags.v3 : !isDashboard,
      sticky: flags.sticky !== undefined ? flags.sticky : !isDashboard
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    total: calculators.length,
    calculators
  };
}

function main() {
  const status = buildStatus();
  fs.writeFileSync(OUT_FILE, JSON.stringify(status, null, 2) + '\n', 'utf8');
  console.log(`Generated ${OUT_FILE} with ${status.total} calculators`);
}

main();
