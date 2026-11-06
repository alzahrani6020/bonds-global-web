'use strict';

const ARABIC_TO_LATIN = Object.freeze({
  'ا':'','أ':'','إ':'','آ':'','ء':'','ؤ':'','ئ':'','ى':'',
  'ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh',
  'ص':'s','ض':'d','ط':'t','ظ':'z','ع':'','غ':'gh',
  'ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n',
  'ه':'h','ة':'h','و':'','ي':''
});

function normalizeLatinSkeleton(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ph/g, 'f')
    .replace(/kh|ch/g, 'x')
    .replace(/gh/g, 'g')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/q/g, 'k')
    .replace(/[aeiouy]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function arabicTokenSkeleton(value) {
  let out = '';
  for (const char of String(value || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '')) {
    if (Object.prototype.hasOwnProperty.call(ARABIC_TO_LATIN, char)) out += ARABIC_TO_LATIN[char];
    else if (/[a-z0-9]/i.test(char)) out += char.toLowerCase();
  }
  return normalizeLatinSkeleton(out);
}

function tokenSkeleton(value) {
  return /[\u0600-\u06ff]/u.test(String(value || ''))
    ? arabicTokenSkeleton(value)
    : normalizeLatinSkeleton(value);
}

function nameTokens(value) {
  return String(value || '')
    .replace(/[“”"'؟?!.,،:;؛()\[\]{}]/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function editDistance(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const prev = Array.from({ length:right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const current = prev[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + cost);
      last = current;
    }
  }
  return prev[right.length];
}

function skeletonCompatible(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const longest = Math.max(a.length, b.length);
  if (longest < 4) return false;
  return editDistance(a, b) <= (longest >= 7 ? 2 : 1);
}

function crossScriptNameScore(canonicalName, evidenceText) {
  const sourceTokens = nameTokens(evidenceText).slice(0, 120);
  const name = nameTokens(canonicalName);
  if (name.length < 2 || name.length > 6 || !sourceTokens.length) return 0;

  const expected = name.map(tokenSkeleton).filter(Boolean);
  if (expected.length !== name.length) return 0;

  let matched = 0;
  let cursor = 0;
  for (const target of expected) {
    let found = false;
    for (let i = cursor; i < sourceTokens.length; i++) {
      if (skeletonCompatible(target, tokenSkeleton(sourceTokens[i]))) {
        matched += 1;
        cursor = i + 1;
        found = true;
        break;
      }
    }
    if (!found) break;
  }

  if (matched !== expected.length) return 0;
  return expected.length >= 3 ? 0.92 : 0.88;
}

module.exports = {
  arabicTokenSkeleton,
  normalizeLatinSkeleton,
  tokenSkeleton,
  crossScriptNameScore
};
