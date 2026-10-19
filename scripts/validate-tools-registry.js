#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'tools-registry.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const errors = [];

function fail(message) { errors.push(message); }
function assert(condition, message) { if (!condition) fail(message); }
function unique(list, label) {
  const seen = new Set();
  for (const value of list) {
    if (seen.has(value)) fail(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}
function routeToFile(route) {
  return path.join(ROOT, String(route).replace(/^\/+/, ''));
}
function requireText(value, label) {
  assert(typeof value === 'string' && value.trim(), `${label} is required`);
}
function parseGroups(relPath) {
  const html = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const start = html.indexOf('const groups = [');
  const generatedEnd = html.indexOf('// INVESTMENT-TOOLS-GENERATED:END', start);
  const fallbackEnd = html.indexOf('\n    const main =', start);
  const end = generatedEnd >= 0 ? generatedEnd : fallbackEnd;
  assert(start >= 0 && end > start, `${relPath}: groups block not found`);
  if (start < 0 || end <= start) return [];
  const source = html.slice(start + 'const groups = '.length, end).trim().replace(/;\s*$/, '');
  try {
    return vm.runInNewContext('(' + source + ')', Object.create(null), { timeout: 1000 });
  } catch (error) {
    fail(`${relPath}: unable to parse groups: ${error.message}`);
    return [];
  }
}

assert(registry.schemaVersion === 1, 'unsupported schemaVersion');
assert(Array.isArray(registry.menuGroups), 'menuGroups must be an array');
assert(Array.isArray(registry.tools), 'tools must be an array');
assert(Array.isArray(registry.sectorGroups), 'sectorGroups must be an array');
assert(Array.isArray(registry.sectors), 'sectors must be an array');

unique(registry.tools.map(x => x.id), 'tool id');
unique(registry.sectors.map(x => x.id), 'sector id');
unique(registry.sectorGroups.map(x => x.id), 'sector group id');
unique(registry.tools.flatMap(x => [x.routes.ar, x.routes.en]), 'tool route');
unique(registry.sectors.flatMap(x => [x.routes.ar, x.routes.en]), 'sector route');

const toolMap = new Map(registry.tools.map(x => [x.id, x]));
const sectorGroupMap = new Map(registry.sectorGroups.map(x => [x.id, x]));
for (const group of registry.menuGroups) {
  requireText(group.id, 'menu group id');
  requireText(group.labels?.ar, `${group.id}.labels.ar`);
  requireText(group.labels?.en, `${group.id}.labels.en`);
  assert(Array.isArray(group.items) && group.items.length > 0, `${group.id}.items must be non-empty`);
  for (const id of group.items || []) assert(toolMap.has(id), `${group.id}: unknown tool ${id}`);
}
const menuRefs = registry.menuGroups.flatMap(g => g.items || []);
unique(menuRefs, 'menu tool reference');
assert(menuRefs.length === registry.tools.filter(x => x.menu?.visible).length, 'menu visible tools and menu group references differ');

for (const tool of registry.tools) {
  requireText(tool.id, 'tool id');
  requireText(tool.labels?.ar, `${tool.id}.labels.ar`);
  requireText(tool.labels?.en, `${tool.id}.labels.en`);
  requireText(tool.routes?.ar, `${tool.id}.routes.ar`);
  requireText(tool.routes?.en, `${tool.id}.routes.en`);
  requireText(tool.sourceBinding?.labelKey, `${tool.id}.sourceBinding.labelKey`);
  requireText(tool.sourceBinding?.hrefExpression, `${tool.id}.sourceBinding.hrefExpression`);
  assert(fs.existsSync(routeToFile(tool.routes.ar)), `${tool.id}: missing AR route target ${tool.routes.ar}`);
  assert(fs.existsSync(routeToFile(tool.routes.en)), `${tool.id}: missing EN route target ${tool.routes.en}`);
}

for (const group of registry.sectorGroups) {
  requireText(group.labels?.ar, `${group.id}.labels.ar`);
  requireText(group.labels?.en, `${group.id}.labels.en`);
}
for (const sector of registry.sectors) {
  requireText(sector.id, 'sector id');
  requireText(sector.labels?.ar, `${sector.id}.labels.ar`);
  requireText(sector.labels?.en, `${sector.id}.labels.en`);
  assert(sectorGroupMap.has(sector.category), `${sector.id}: unknown category ${sector.category}`);
  assert(fs.existsSync(routeToFile(sector.routes.ar)), `${sector.id}: missing AR route target ${sector.routes.ar}`);
  assert(fs.existsSync(routeToFile(sector.routes.en)), `${sector.id}: missing EN route target ${sector.routes.en}`);
}

const layout = fs.readFileSync(path.join(ROOT, 'site-layout.js'), 'utf8');
const calcStart = layout.indexOf('const calcDropdown = [');
const calcEnd = layout.indexOf('\n    const fundingDropdown = [', calcStart);
assert(calcStart >= 0 && calcEnd > calcStart, 'site-layout.js: calcDropdown block not found');
if (calcStart >= 0 && calcEnd > calcStart) {
  const calcBlock = layout.slice(calcStart, calcEnd);
  const actual = [...calcBlock.matchAll(/\{\s*label:\s*labels\.([A-Za-z0-9_]+),\s*href:\s*([^\n}]+?)\s*\}/g)]
    .map(m => ({ labelKey: m[1], hrefExpression: m[2].trim().replace(/,$/, '') }));
  const expected = registry.menuGroups.flatMap(group => group.items.map(id => {
    const binding = toolMap.get(id).sourceBinding;
    return { labelKey: binding.labelKey, hrefExpression: binding.hrefExpression };
  }));
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    'site-layout.js calcDropdown drifted from data/tools-registry.json');
}

const arGroups = parseGroups('calculators/investment-center/index.html');
const enGroups = parseGroups('en/calculators/investment-center/index.html');
assert(arGroups.length === registry.sectorGroups.length, 'AR investment center group count differs from registry');
assert(enGroups.length === registry.sectorGroups.length, 'EN investment center group count differs from registry');

function flatten(groups, lang) {
  const result = [];
  for (const group of groups) {
    const canonicalGroup = sectorGroupMap.get(group.id);
    assert(Boolean(canonicalGroup), `${lang}: unknown group ${group.id}`);
    if (canonicalGroup) {
      assert(group.title === canonicalGroup.labels[lang], `${lang}: group title drift ${group.id}`);
      assert(group.desc === canonicalGroup.descriptions[lang], `${lang}: group description drift ${group.id}`);
    }
    for (let i = 0; i < group.sectors.length; i++) {
      const sector = group.sectors[i];
      result.push({ ...sector, category: group.id, order: i + 1 });
    }
  }
  return result;
}
const arSectors = flatten(arGroups, 'ar');
const enSectors = flatten(enGroups, 'en');
assert(arSectors.length === registry.sectors.length, 'AR sector count differs from registry');
assert(enSectors.length === registry.sectors.length, 'EN sector count differs from registry');

const sectorMap = new Map(registry.sectors.map(x => [x.id, x]));
for (const lang of ['ar','en']) {
  const actual = lang === 'ar' ? arSectors : enSectors;
  const ids = actual.map(x => x.id);
  unique(ids, `${lang} investment center sector id`);
  for (const item of actual) {
    const canonical = sectorMap.get(item.id);
    assert(Boolean(canonical), `${lang}: unknown sector ${item.id}`);
    if (!canonical) continue;
    assert(item.category === canonical.category, `${lang}: category drift ${item.id}`);
    assert(item.order === canonical.order, `${lang}: order drift ${item.id}`);
    assert(item.icon === canonical.icon, `${lang}: icon drift ${item.id}`);
    assert(item.title === canonical.labels[lang], `${lang}: title drift ${item.id}`);
    assert(item.desc === canonical.descriptions[lang], `${lang}: description drift ${item.id}`);
  }
}

if (errors.length) {
  console.error('Tools registry audit FAILED');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}
console.log(`Tools registry audit PASSED: ${registry.tools.length} menu tools, ${registry.sectors.length} sector tools, ${registry.sectorGroups.length} sector groups.`);
