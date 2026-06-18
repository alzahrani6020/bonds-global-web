// Extract platform data and country metadata from calculators/country-platforms-data.js
// and write to calculators/shared-platforms.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const inputPath = path.join(root, 'calculators', 'country-platforms-data.js');
const outputPath = path.join(root, 'calculators', 'shared-platforms.js');

// Read and evaluate the input file to get COUNTRIES_DATA
const input = fs.readFileSync(inputPath, 'utf8');
// Wrap in a function to avoid global leaks
const code = `(function(){ ${input}; return COUNTRIES_DATA; })()`;
const COUNTRIES_DATA = eval(code);

const COUNTRY_META = {};
const PLATFORMS_DATA = {};

for (const [code, data] of Object.entries(COUNTRIES_DATA)) {
  COUNTRY_META[code] = {
    code,
    name: data.name,
    nameEn: data.nameEn,
    flag: data.flag,
    currency: data.currency,
    currencySymbol: data.currencySymbol,
    currencySymbolEn: data.currencySymbolEn,
    vatRate: data.vatRate,
    marketInsights: data.marketInsights || null
  };

  PLATFORMS_DATA[code] = {
    code,
    name: data.name,
    nameEn: data.nameEn,
    flag: data.flag,
    currency: data.currency,
    currencySymbol: data.currencySymbol,
    currencySymbolEn: data.currencySymbolEn,
    vatRate: data.vatRate,
    platforms: data.platforms || [],
    marketInsights: data.marketInsights || null
  };
}

const output = `/**
 * Bonds Global — Shared Platform & Country Metadata
 * Extracted from country-platforms-data.js for use with BondsGeo.
 * Provides delivery-platform fees and country-level business metadata
 * (currency, VAT, marketInsights) without duplicating governorate/city data.
 */

(function () {
  'use strict';

  const COUNTRY_META = ${JSON.stringify(COUNTRY_META, null, 2)};

  const PLATFORMS_DATA = ${JSON.stringify(PLATFORMS_DATA, null, 2)};

  function getCountryMeta(code) {
    return COUNTRY_META[code] || null;
  }

  function getAllCountryMeta() {
    return COUNTRY_META;
  }

  function getPlatforms(code) {
    const data = PLATFORMS_DATA[code];
    return data ? (data.platforms || []) : [];
  }

  function getPlatform(code, platformId) {
    const platforms = getPlatforms(code);
    return platforms.find(function (p) { return p.id === platformId; }) || null;
  }

  function getPlatformByIndex(code, index) {
    const platforms = getPlatforms(code);
    return platforms[index] || null;
  }

  function getCurrencySymbol(code, lang) {
    const meta = COUNTRY_META[code];
    if (!meta) return lang === 'en' ? 'SAR' : 'ريال';
    return lang === 'en' ? (meta.currencySymbolEn || meta.currencySymbol || meta.currency) : (meta.currencySymbol || meta.currency);
  }

  function getVatRate(code) {
    const meta = COUNTRY_META[code];
    return meta ? (meta.vatRate || 0) : 0;
  }

  window.BondsPlatforms = {
    COUNTRY_META,
    PLATFORMS_DATA,
    getCountryMeta,
    getAllCountryMeta,
    getPlatforms,
    getPlatform,
    getPlatformByIndex,
    getCurrencySymbol,
    getVatRate
  };
})();
`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`Countries: ${Object.keys(COUNTRY_META).length}`);
