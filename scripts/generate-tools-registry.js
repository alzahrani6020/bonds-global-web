#!/usr/bin/env node
'use strict';

(function generatorMain() {
  const fs = require('fs');
  const path = require('path');

  const ROOT = path.resolve(__dirname, '..');
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tools-registry.json'), 'utf8'));
  const q = value => JSON.stringify(value);

  function menuBlock() {
    const toolMap = new Map(registry.tools.map(x => [x.id, x]));
    const lines = ['    // TOOLS-GENERATED:START', '    const calcDropdown = ['];
    for (const group of [...registry.menuGroups].sort((a, b) => a.order - b.order)) {
      lines.push('      {');
      lines.push(`        heading: { ar: ${q(group.labels.ar)}, en: ${q(group.labels.en)} },`);
      lines.push('        items: [');
      for (const id of group.items) {
        const tool = toolMap.get(id);
        if (!tool) throw new Error(`Unknown menu tool: ${id}`);
        lines.push(`          { label: labels.${tool.sourceBinding.labelKey}, href: ${tool.sourceBinding.hrefExpression} },`);
      }
      lines.push('        ],', '      },');
    }
    lines.push('    ];', '    // TOOLS-GENERATED:END');
    return lines.join('\n');
  }

  function groupsBlock(lang) {
    const groups = [...registry.sectorGroups].sort((a, b) => a.order - b.order);
    const byCategory = new Map(groups.map(g => [g.id, []]));
    for (const sector of registry.sectors) {
      if (!byCategory.has(sector.category)) throw new Error(`Unknown sector category: ${sector.category}`);
      byCategory.get(sector.category).push(sector);
    }
    const lines = ['    // INVESTMENT-TOOLS-GENERATED:START', '    const groups = ['];
    groups.forEach((group, index) => {
      lines.push('      {');
      lines.push(`        id: ${q(group.id)},`);
      lines.push(`        title: ${q(group.labels[lang])},`);
      lines.push(`        desc: ${q(group.descriptions[lang])},`);
      lines.push('        sectors: [');
      for (const sector of byCategory.get(group.id).sort((a, b) => a.order - b.order)) {
        lines.push(`          { id: ${q(sector.id)}, icon: ${q(sector.icon)}, title: ${q(sector.labels[lang])}, desc: ${q(sector.descriptions[lang])} },`);
      }
      lines.push('        ]');
      lines.push(index === groups.length - 1 ? '      }' : '      },');
    });
    lines.push('    ];', '    // INVESTMENT-TOOLS-GENERATED:END');
    return lines.join('\n');
  }

  function replaceMarked(content, startMarker, endMarker, replacement, relPath) {
    const start = content.indexOf(startMarker);
    const end = content.indexOf(endMarker, start + startMarker.length);
    if (start < 0 || end < 0) throw new Error(`${relPath}: generated markers missing`);
    if (content.indexOf(startMarker, start + startMarker.length) >= 0) throw new Error(`${relPath}: duplicate start marker`);
    if (content.indexOf(endMarker, end + endMarker.length) >= 0) throw new Error(`${relPath}: duplicate end marker`);
    return content.slice(0, start) + replacement + content.slice(end + endMarker.length);
  }

  function syncToolLabels(content) {
    for (const tool of registry.tools) {
      const key = tool.sourceBinding.labelKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^(\\s*)${key}:\\s*isEn\\s*\\?\\s*(["']).*?\\2\\s*:\\s*(["']).*?\\3,\\s*$`, 'm');
      const match = content.match(re);
      if (!match) throw new Error(`site-layout.js: label binding missing for ${tool.sourceBinding.labelKey}`);
      content = content.replace(
        re,
        `${match[1]}${tool.sourceBinding.labelKey}: isEn ? ${q(tool.labels.en)} : ${q(tool.labels.ar)},`
      );
    }
    return content;
  }

  function updateFile(relPath, transform) {
    const full = path.join(ROOT, relPath);
    const before = fs.readFileSync(full, 'utf8');
    const after = transform(before);
    if (after !== before) fs.writeFileSync(full, after, 'utf8');
  }

  updateFile('site-layout.js', content => {
    content = syncToolLabels(content);
    return replaceMarked(
      content,
      '    // TOOLS-GENERATED:START',
      '    // TOOLS-GENERATED:END',
      menuBlock(),
      'site-layout.js'
    );
  });

  for (const [relPath, lang] of [
    ['calculators/investment-center/index.html', 'ar'],
    ['en/calculators/investment-center/index.html', 'en']
  ]) {
    updateFile(relPath, content => replaceMarked(
      content,
      '    // INVESTMENT-TOOLS-GENERATED:START',
      '    // INVESTMENT-TOOLS-GENERATED:END',
      groupsBlock(lang),
      relPath
    ));
  }

  console.log(`Generated tools sources from registry: ${registry.tools.length} menu tools, ${registry.sectors.length} sector tools.`);
})();
