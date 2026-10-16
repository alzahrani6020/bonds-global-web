'use strict';

const fs = require('fs');

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

const baselineEntries = baseline.entries || [];
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
    policyViolations.push({ type: 'NEW_UNREVIEWED_HIGH', advisory: after });
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
  gitSha: process.env.GITHUB_SHA || null,
  baselineSourceSha: baseline.sourceSha || null,
  current,
  changes,
  policyViolations
};

fs.writeFileSync('advisory-delta.json', JSON.stringify(report, null, 2) + '\n');
console.log('ADVISORY_DELTA ' + JSON.stringify({
  current: current.length,
  changes: changes.map(x => x.type),
  policyViolations: policyViolations.length
}));

if (policyViolations.length > 0) {
  console.error(JSON.stringify(policyViolations, null, 2));
  process.exit(1);
}
