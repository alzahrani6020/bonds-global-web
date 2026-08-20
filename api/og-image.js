/**
 * Dynamic Open Graph image generator.
 * Usage: /api/og-image?title=...&description=...&lang=ar
 * Returns a PNG image.
 */
const sharp = require('sharp');
const { render, detectDirection } = require('bidi-shaper');

const GOLD = '#d4a853';
const GOLD_BRIGHT = '#f0c96a';
const BG = '#0a0f1a';
const TEXT = '#e8ecf4';
const TEXT_SECONDARY = '#94a3b8';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitLines(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, 3);
}

function visualText(text) {
  try {
    return render(text, { direction: 'auto' });
  } catch (e) {
    return text;
  }
}

function lineAttrs(line) {
  const dir = detectDirection(line) === 'rtl' ? 'rtl' : 'ltr';
  return dir === 'rtl'
    ? { anchor: 'end', x: 1120, dir: 'ltr' }
    : { anchor: 'start', x: 80, dir: 'ltr' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { title = 'بوندز', description = 'استشارات مالية معتمدة', lang = 'ar' } = req.query || {};

  const titleLines = splitLines(title, lang === 'en' ? 34 : 28);
  const descLines = splitLines(description, lang === 'en' ? 54 : 48);

  let titleSvg = '';
  titleLines.forEach((line, idx) => {
    const visual = visualText(line);
    const attrs = lineAttrs(line);
    titleSvg += `<text x="${attrs.x}" y="${240 + idx * 74}" font-size="56" font-weight="700" fill="${TEXT}" font-family="system-ui, Vazirmatn, Inter, sans-serif" text-anchor="${attrs.anchor}" direction="${attrs.dir}">${escapeXml(visual)}</text>`;
  });

  let descSvg = '';
  descLines.forEach((line, idx) => {
    const visual = visualText(line);
    const attrs = lineAttrs(line);
    descSvg += `<text x="${attrs.x}" y="${500 + idx * 44}" font-size="28" fill="${TEXT_SECONDARY}" font-family="system-ui, Vazirmatn, Inter, sans-serif" text-anchor="${attrs.anchor}" direction="${attrs.dir}">${escapeXml(visual)}</text>`;
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#10182d"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GOLD_BRIGHT}"/>
      <stop offset="100%" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="510" rx="24" fill="rgba(255,255,255,0.03)" stroke="rgba(197,160,40,0.2)" stroke-width="2"/>
  <rect x="60" y="60" width="1080" height="6" rx="3" fill="url(#accent)"/>
  <text x="80" y="140" font-size="24" font-weight="700" fill="${GOLD}" font-family="system-ui, Vazirmatn, Inter, sans-serif" text-anchor="start">BONDS GLOBAL</text>
  ${titleSvg}
  ${descSvg}
  <text x="80" y="600" font-size="22" fill="${TEXT_SECONDARY}" font-family="system-ui, Vazirmatn, Inter, sans-serif" text-anchor="start">bonds-global.com</text>
</svg>`;

  try {
    const png = await sharp(Buffer.from(svg, 'utf8'))
      .png({ compressionLevel: 9 })
      .toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(png);
  } catch (err) {
    console.error('[og-image] Error:', err.message);
    return res.status(500).json({ error: 'Image generation failed' });
  }
};
