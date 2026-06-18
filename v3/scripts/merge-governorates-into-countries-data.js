/**
 * Merge governorates from ARAB_COUNTRIES_GEO into calculators/country-platforms-data.js
 * Adds a `governorates` field to each country object in COUNTRIES_DATA.
 */
const fs = require('fs');
const path = require('path');

const { ARAB_COUNTRIES_GEO } = require('../master-data/countries-governorates-cities.js');

const targetPath = path.join(__dirname, '..', '..', 'calculators', 'country-platforms-data.js');
let content = fs.readFileSync(targetPath, 'utf8');

// For each country, inject governorates before the closing `},` of the country object.
for (const code in ARAB_COUNTRIES_GEO) {
  const country = ARAB_COUNTRIES_GEO[code];
  // Build governorates array string
  const govLines = country.governorates.map(gov => {
    const cityLines = gov.cities.map(c =>
      `          { name: '${c.name.replace(/'/g, "\\'")}', nameEn: '${c.nameEn.replace(/'/g, "\\'")}', code: '${c.code}' }`
    ).join(',\n');
    return `        { name: '${gov.name.replace(/'/g, "\\'")}', nameEn: '${gov.nameEn.replace(/'/g, "\\'")}', cities: [\n${cityLines}\n        ] }`;
  }).join(',\n');

  const governoratesBlock = `    governorates: [\n${govLines}\n    ],`;

  // Find the country block and inject before `platforms:` or `note:` or `noteEn:`
  const countryStartRegex = new RegExp(`\\b${code}:\\s*\\{`);
  const startMatch = content.match(countryStartRegex);
  if (!startMatch) {
    console.warn(`Country ${code} not found in country-platforms-data.js`);
    continue;
  }

  const startIdx = startMatch.index + startMatch[0].length;
  // Find the next property after the country object metadata to inject before it
  // We will insert right after the lastUpdated/marketInsights block, before platforms or note.
  // Simple approach: find the position of `platforms:` within this country object.
  let platformsIdx = content.indexOf('    platforms:', startIdx);
  if (platformsIdx === -1) platformsIdx = content.indexOf('    note:', startIdx);
  if (platformsIdx === -1) continue;

  // Check if governorates already injected
  const existingGovIdx = content.indexOf('    governorates:', startIdx);
  if (existingGovIdx !== -1 && existingGovIdx < platformsIdx) {
    // Remove existing governorates block up to platformsIdx/noteIdx
    content = content.slice(0, existingGovIdx) + content.slice(platformsIdx);
    // Recompute platformsIdx after removal
    platformsIdx = content.indexOf('    platforms:', startIdx);
    if (platformsIdx === -1) platformsIdx = content.indexOf('    note:', startIdx);
    if (platformsIdx === -1) continue;
  }

  content = content.slice(0, platformsIdx) + governoratesBlock + '\n' + content.slice(platformsIdx);
  console.log(`Injected governorates for ${code}`);
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Done');
