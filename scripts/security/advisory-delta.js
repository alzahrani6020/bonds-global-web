'use strict';

const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const baseline = JSON.parse(fs.readFileSync('.github/security/advisory-baseline.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const prodAudit = JSON.parse(fs.readFileSync('audit-prod.json', 'utf8'));
const fullAudit = JSON.parse(fs.readFileSync('audit-all.json', 'utf8'));

function advisoryId(via) {
  if (via && typeof via.url === 'string') {
    const match = via.url.match(/\/(GHSA-[A-Za-z0-9-]+|CVE-[0-9-]+)$/i);
    if (match) return match[1].toUpperCase();
  }
  if (via && via.source) return 'NPM-' + via.source;
  return null;
}

function directAdvisories(audit) {
  const out = [];
  for (const [vulnName, vuln] of Object.entries(audit.vulnerabilities || {})) {
    for (const via of vuln.via || []) {
      if (!via || typeof via === 'string') continue;
      const id = advisoryId(via);
      if (!id) continue;
      const pkg = via.dependency || via.name || vulnName;
      for (const dependencyPath of vuln.nodes || ['node_modules/' + pkg]) {
        const resolvedVersion = lock.packages?.[dependencyPath]?.version || null;
        out.push({
          id,
          package: pkg,
          resolvedVersion,
          dependencyPath,
          severity: String(via.severity || vuln.severity || 'unknown').toLowerCase()
        });
      }
    }
  }
  return out;
}

const prodKeys = new Set(directAdvisories(prodAudit).map(
  x => [x.id, x.package, x.dependencyPath].join('|')
));

const current = directAdvisories(fullAudit)
  .map(x => ({
    ...x,
    scope: prodKeys.has([x.id, x.package, x.dependencyPath].join('|')) ? 'prod' : 'dev'
  }))
  .sort((a, b) => [a.id, a.package, a.dependencyPath].join('|').localeCompare([b.id, b.package, b.dependencyPath].join('|')));

const baselineEntries = (baseline.entries || []).map(item => ({ ...item, id: String(item.id || '').toUpperCase() }));
const matchedBaseline = new Set();
const changes = [];

for (const item of current) {
  const exactIndex = baselineEntries.findIndex(
    b => b.id === item.id && b.package === item.package && b.dependencyPath === item.dependencyPath
  );
  if (exactIndex >= 0) {
    matchedBaseline.add(exactIndex);
    const old = baselineEntries[exactIndex];
    if (old.severity !== item.severity) changes.push({ type: 'SEVERITY_CHANGED', before: old, after: item });
    if (old.resolvedVersion !== item.resolvedVersion) changes.push({ type: 'VERSION_CHANGED', before: old, after: item });
    if (old.scope !== item.scope) changes.push({ type: 'SCOPE_CHANGED', before: old, after: item });
    continue;
  }

  const sameAdvisoryIndex = baselineEntries.findIndex(
    b => b.id === item.id && b.package === item.package
  );
  if (sameAdvisoryIndex >= 0) {
    matchedBaseline.add(sameAdvisoryIndex);
    changes.push({ type: 'PATH_CHANGED', before: baselineEntries[sameAdvisoryIndex], after: item });
  } else {
    changes.push({ type: 'NEW', after: item });
  }
}

baselineEntries.forEach((item, index) => {
  if (!matchedBaseline.has(index) && !current.some(c => c.id === item.id && c.package === item.package)) {
    changes.push({ type: 'RESOLVED', before: item });
  }
});

function cmpVersion(a, b) {
  const pa = String(a || '').split('.').map(x => Number(x) || 0);
  const pb = String(b || '').split('.').map(x => Number(x) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// An advisory remains visible in current/changes even with a verified local patch.
// Only these exact dev-only copies can qualify, and only after re-running the
// fail-closed source + behavior regression check on the installed node_modules.
const localMitigationTargets = new Set([
  'node_modules/picomatch',
  'node_modules/micromatch/node_modules/picomatch',
  'node_modules/anymatch/node_modules/picomatch'
]);
const localPatchChanges = changes.filter(change =>
  change.type === 'NEW' && change.after?.id === 'GHSA-FC5Q-39XC-VJPF' &&
  change.after?.package === 'picomatch' && change.after?.scope === 'dev' &&
  localMitigationTargets.has(change.after?.dependencyPath)
);
let localPatchVerified = false;
if (localPatchChanges.length === localMitigationTargets.size &&
    new Set(localPatchChanges.map(change => change.after.dependencyPath)).size === localMitigationTargets.size) {
  const proof = spawnSync(process.execPath,
    ['scripts/security/patch-picomatch.js', '--verify'],
    { encoding: 'utf8', timeout: 15000 });
  localPatchVerified = proof.status === 0 &&
    proof.stdout.includes('PICOMATCH_CVE_2026_112366_PATCH_VERIFIED');
  if (!localPatchVerified) {
    console.error('PICOMATCH_PATCH_PROOF_FAILED ' + (proof.stderr || proof.error?.message || 'unknown'));
  }
}
const verifiedLocalMitigations = [];

const policyViolations = [];
for (const [name, minimum] of Object.entries(baseline.minimumVersions || {})) {
  const actual = lock.packages?.['node_modules/' + name]?.version || null;
  if (!actual || cmpVersion(actual, minimum) < 0) {
    policyViolations.push({ type: 'BLOCKED_VERSION', package: name, actual, minimum });
  }
}

for (const change of changes) {
  const after = change.after;
  if (!after) continue;
  const highOrCritical = ['high', 'critical'].includes(after.severity);
  if (change.type === 'NEW' && highOrCritical) {
    if (localPatchVerified && after.id === 'GHSA-FC5Q-39XC-VJPF' &&
        after.package === 'picomatch' && after.scope === 'dev' &&
        localMitigationTargets.has(after.dependencyPath)) {
      // Not an unreviewed finding: patched installed code and exploit/compatibility
      // checks have just been reverified. npm audit's upstream advisory is retained.
      verifiedLocalMitigations.push(after);
    } else {
      policyViolations.push({ type: 'NEW_UNREVIEWED_HIGH', advisory: after });
    }
  }
  if (change.type === 'NEW' && after.scope === 'prod' && highOrCritical) {
    policyViolations.push({ type: 'NEW_PRODUCTION_HIGH_OR_CRITICAL', advisory: after });
  }
  if (change.type === 'SEVERITY_CHANGED' && highOrCritical) {
    policyViolations.push({ type: 'SEVERITY_ESCALATED_TO_HIGH', advisory: after });
  }
  if (change.type === 'SCOPE_CHANGED' && after.scope === 'prod' && highOrCritical) {
    policyViolations.push({ type: 'HIGH_MOVED_TO_PRODUCTION', advisory: after });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  gitSha: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
  baselineSourceSha: baseline.sourceSha || null,
  current,
  changes,
  verifiedLocalMitigations,
  localPatchVerified,
  policyViolations
};

fs.writeFileSync('advisory-delta.json', JSON.stringify(report, null, 2) + '\n');
console.log('ADVISORY_DELTA ' + JSON.stringify({
  current: current.length,
  changes: changes.map(x => x.type),
  policyViolations: policyViolations.length,
  locallyPatched: verifiedLocalMitigations.length
}));

if (policyViolations.length > 0) {
  console.error(JSON.stringify(policyViolations, null, 2));
  process.exit(1);
}
