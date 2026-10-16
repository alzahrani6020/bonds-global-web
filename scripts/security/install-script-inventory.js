'use strict';

const fs = require('fs');
const { execSync } = require('child_process');

const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const baseline = JSON.parse(fs.readFileSync('.github/security/install-script-baseline.json', 'utf8'));
const reviewed = new Map((baseline.packages || []).map(item => [item.path, item]));

const current = Object.entries(lock.packages || {})
  .filter(([, pkg]) => pkg && pkg.hasInstallScript)
  .map(([path, pkg]) => {
    const expected = reviewed.get(path);
    const exactMatch = expected && expected.version === pkg.version;
    return {
      name: pkg.name || path.replace(/^node_modules\//, ''),
      version: pkg.version || null,
      path,
      dev: Boolean(pkg.dev),
      optional: Boolean(pkg.optional),
      resolved: pkg.resolved || null,
      classification: exactMatch ? expected.classification : 'unknown',
      rationale: exactMatch ? expected.rationale : 'Not present in reviewed install-script baseline'
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const unknown = current.filter(item => item.classification === 'unknown');
const missingReviewed = (baseline.packages || []).filter(
  expected => !current.some(item => item.path === expected.path && item.version === expected.version)
);

const report = {
  generatedAt: new Date().toISOString(),
  gitSha: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
  policy: {
    securityWorkflowInstall: 'npm ci --ignore-scripts --no-audit',
    ciBuildInstall: 'npm ci',
    note: 'Security evidence intentionally suppresses lifecycle scripts; normal CI/build may execute reviewed lifecycle scripts.'
  },
  current,
  unknown,
  missingReviewed
};

fs.writeFileSync('install-script-inventory.json', JSON.stringify(report, null, 2) + '\n');
console.log('INSTALL_SCRIPT_INVENTORY ' + JSON.stringify({
  total: current.length,
  unknown: unknown.length,
  missingReviewed: missingReviewed.length
}));

if (unknown.length > 0) {
  console.error('Unreviewed install scripts detected: ' + unknown.map(x => x.name + '@' + x.version).join(', '));
  process.exit(1);
}
