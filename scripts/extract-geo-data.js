// Extract per-country geographic chunks from v3/master-data/*.js
// and write to calculators/geo-data/ for lazy loading.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputDir = path.join(root, 'calculators', 'geo-data');

function loadGlobal(name, file) {
  const fullPath = path.join(root, file);
  const input = fs.readFileSync(fullPath, 'utf8');
  const code = `(function(){ ${input}; return ${name}; })()`;
  return eval(code);
}

const arabGeo = loadGlobal('ARAB_COUNTRIES_GEO', 'v3/master-data/countries-governorates-cities.js');
const globalGeo = loadGlobal('GLOBAL_COUNTRIES_GEO', 'v3/master-data/global-countries.js');
const extendedGeo = loadGlobal('ARAB_EXTENDED_COUNTRIES_GEO', 'v3/master-data/arab-extended-countries.js');

const allGeo = Object.assign({}, arabGeo, globalGeo, extendedGeo);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const meta = {};
for (const [code, data] of Object.entries(allGeo)) {
  meta[code] = {
    code,
    name: data.name,
    nameEn: data.nameEn,
    flag: data.flag
  };

  const countryOutput = `/**
 * Bonds Global — Geographic data for ${code}
 * Generated from v3/master-data/*.js
 */
(function () {
  'use strict';
  window.BondsGeoCountryData = window.BondsGeoCountryData || {};
  window.BondsGeoCountryData['${code}'] = ${JSON.stringify(data, null, 2)};
})();
`;
  fs.writeFileSync(path.join(outputDir, code.toLowerCase() + '.js'), countryOutput, 'utf8');
}

const metaOutput = `/**
 * Bonds Global — Geo Country Metadata
 * Generated from v3/master-data/*.js
 */
(function () {
  'use strict';
  window.BondsGeoMeta = ${JSON.stringify(meta, null, 2)};
})();
`;
fs.writeFileSync(path.join(outputDir, 'meta.js'), metaOutput, 'utf8');

console.log(`Wrote ${Object.keys(allGeo).length} country geo chunks to ${outputDir}`);
