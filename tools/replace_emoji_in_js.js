const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const emojiSrc = fs.readFileSync(path.join(__dirname, '../components/emoji-icons.js'), 'utf8');
let EMOJI_SVGS = {};
eval(emojiSrc.replace('const EMOJI_SVGS', 'EMOJI_SVGS').replace('const EmojiIcons', ';const EmojiIcons'));

const SYMBOL_SVGS = {
  '✓': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  '✔': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  '✔️': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  '✕': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  '✖': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  '✖️': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  '✗': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  '✘': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  '○': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>',
  '●': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>',
  '▶': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  '▶️': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  '▼': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>',
  '▾': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>',
  '☀': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  '☀️': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  '☁': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  '☁️': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  '☰': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  '★': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  '☆': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  '⚠': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  '⚠️': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
};

function getSvg(emoji) {
  return EMOJI_SVGS[emoji] || SYMBOL_SVGS[emoji] || null;
}

const EMOJI_REGEX_TEST = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/u;
const EMOJI_REGEX_REPLACE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]+/gu;
const DECORATIVE_REGEX = /^[\s\u2500-\u257F]*$/u;

function containsEmoji(str) { return EMOJI_REGEX_TEST.test(str); }
function stripEmoji(str) { return str.replace(EMOJI_REGEX_REPLACE, ''); }
function replaceEmoji(str) {
  return str.replace(EMOJI_REGEX_REPLACE, match => getSvg(match) || match);
}

function isConsoleCall(nodePath) {
  let p = nodePath;
  while (p) {
    if (t.isCallExpression(p.node)) {
      const c = p.node.callee;
      if (t.isMemberExpression(c) && t.isIdentifier(c.object, { name: 'console' })) return true;
    }
    p = p.parentPath;
  }
  return false;
}

function findTextContentAssignment(nodePath) {
  let p = nodePath;
  while (p) {
    if (t.isAssignmentExpression(p.node)) {
      const left = p.node.left;
      if (t.isMemberExpression(left) && t.isIdentifier(left.property, { name: 'textContent' })) {
        return p;
      }
    }
    p = p.parentPath;
  }
  return null;
}

function transformFile(file) {
  if (/components[\\/]emoji-(icons|renderer)\.js$/.test(file)) return false;
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'unambiguous',
      allowImportExportEverywhere: true,
      plugins: [
        'jsx',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'numericSeparator',
        'bigInt',
        'throwExpressions',
        'decorators-legacy',
        'objectRestSpread',
        'asyncGenerators',
        'functionBind',
        'functionSent',
        'importMeta',
        'logicalAssignment',
        'moduleStringNames',
        'partialApplication',
        'privateIn',
        'topLevelAwait',
        'v8intrinsic'
      ]
    });
  } catch (err) {
    console.error('Parse error in', file, err.message);
    return false;
  }

  const replacements = [];
  const changedAssignments = new Set();

  function addReplacement(start, end, text) {
    replacements.push({ start, end, text });
  }

  function processValue(value, nodePath) {
    if (!containsEmoji(value)) return value;
    if (isConsoleCall(nodePath)) {
      return stripEmoji(value);
    }
    if (DECORATIVE_REGEX.test(value)) {
      return stripEmoji(value).trim();
    }
    const assignPath = findTextContentAssignment(nodePath);
    if (assignPath) {
      const assignNode = assignPath.node;
      const key = `${assignNode.start}:${assignNode.end}`;
      if (!changedAssignments.has(key)) {
        const prop = assignNode.left.property;
        addReplacement(prop.start, prop.end, 'innerHTML');
        changedAssignments.add(key);
      }
    }
    return replaceEmoji(value);
  }

  traverse(ast, {
    StringLiteral(nodePath) {
      const node = nodePath.node;
      const v = node.value;
      if (!containsEmoji(v)) return;
      const newV = processValue(v, nodePath);
      if (newV !== v) {
        addReplacement(node.start, node.end, JSON.stringify(newV));
      }
    },
    TemplateElement(nodePath) {
      const node = nodePath.node;
      const raw = node.value.raw;
      const cooked = node.value.cooked;
      let newRaw = raw;
      let newCooked = cooked;
      if (containsEmoji(raw)) {
        newRaw = processValue(raw, nodePath);
      }
      if (cooked && containsEmoji(cooked)) {
        newCooked = processValue(cooked, nodePath);
      }
      if (newRaw !== raw || newCooked !== cooked) {
        // Escape backticks and ${ in raw text so the template stays valid.
        const safeRaw = (newRaw || '').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
        addReplacement(node.start, node.end, safeRaw);
      }
    }
  });

  if (replacements.length === 0) return false;

  // Sort descending by start position and apply.
  replacements.sort((a, b) => b.start - a.start);
  let out = src;
  for (const r of replacements) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  fs.writeFileSync(file, out, 'utf8');
  return true;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node replace_emoji_in_js.js <file1.js> [file2.js] ...');
  process.exit(1);
}

let changed = 0;
for (const f of files) {
  const ok = transformFile(f);
  if (ok) {
    changed++;
    console.log('✓', f);
  }
}
console.log(`\nModified ${changed}/${files.length} files`);
