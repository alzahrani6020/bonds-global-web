const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED = ['node_modules', '.vercel', '.git', 'bonds-v2', 'v3'];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED.includes(entry.name)) continue;
      files = files.concat(walk(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const files = walk(ROOT);
let changed = 0;
let siteLayoutRefs = 0;
let headerFooterRefs = 0;
let investmentCenterCssRefs = 0;
let decisionIntelligenceRefs = 0;
let investmentEngineRefs = 0;
let investmentValidatorRefs = 0;
let scriptRefs = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = content.replace(
    /site-layout\.js\?v=[\d.]+/g,
    () => {
      siteLayoutRefs++;
      return 'site-layout.js?v=2.59.0';
    }
  );

  content = content.replace(
    /header-footer\.css\?v=[\d.]+/g,
    () => {
      headerFooterRefs++;
      return 'header-footer.css?v=2.54.0';
    }
  );

  content = content.replace(
    /investment-center\.css(?!\?v=2)(\?v=[^"']*)?/g,
    () => {
      investmentCenterCssRefs++;
      return 'investment-center.css?v=2';
    }
  );

  content = content.replace(
    /decision-intelligence\.js(?!\?v=2)(\?v=[^"']*)?/g,
    () => {
      decisionIntelligenceRefs++;
      return 'decision-intelligence.js?v=2';
    }
  );

  content = content.replace(
    /investment-engine\.js(?!\?v=2)(\?v=[^"']*)?/g,
    () => {
      investmentEngineRefs++;
      return 'investment-engine.js?v=2';
    }
  );

  content = content.replace(
    /investment-validator\.js(?!\?v=2)(\?v=[^"']*)?/g,
    () => {
      investmentValidatorRefs++;
      return 'investment-validator.js?v=2';
    }
  );

  // Bump script.js (but not _vercel/insights/script.js or other unrelated scripts)
  content = content.replace(
    /src="([^"]*\/)?script\.js(?!\?v=2)(\?v=[^"']*)?"/g,
    (match, dir) => {
      if (match.includes('_vercel') || match.includes('insights')) return match;
      scriptRefs++;
      return `src="${dir || ''}script.js?v=5"`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
  }
}

console.log(`Files changed: ${changed}`);
console.log(`site-layout.js?v=2.59.0 refs bumped: ${siteLayoutRefs}`);
console.log(`header-footer.css?v=2.54.0 refs bumped: ${headerFooterRefs}`);
console.log(`investment-center.css refs bumped: ${investmentCenterCssRefs}`);
console.log(`decision-intelligence.js refs bumped: ${decisionIntelligenceRefs}`);
console.log(`investment-engine.js refs bumped: ${investmentEngineRefs}`);
console.log(`investment-validator.js refs bumped: ${investmentValidatorRefs}`);
console.log(`script.js refs bumped: ${scriptRefs}`);
console.log(`Total HTML files scanned: ${files.length}`);
