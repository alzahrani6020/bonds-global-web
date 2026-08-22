/**
 * Generate contact-sheet PNGs from visual regression baselines.
 * Usage: node scripts/generate-visual-contact-sheets.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BASE_DIR = path.join(__dirname, '..', 'tests', 'visual', 'baselines');
const OUT_DIR = path.join(__dirname, '..', 'tests', 'visual');
const VIEWPORTS = ['desktop', 'tablet', 'mobile'];
const COLS = 3;
const THUMB_WIDTH = 360;
const LABEL_HEIGHT = 28;

async function generate(viewport) {
  const dir = path.join(BASE_DIR, viewport);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
  if (files.length === 0) return;

  const rows = [];
  let currentRow = [];
  const composites = [];
  let y = 0;

  for (const file of files) {
    const imgPath = path.join(dir, file);
    const img = sharp(imgPath);
    const meta = await img.metadata();
    const aspect = meta.height / meta.width;
    const height = Math.round(THUMB_WIDTH * aspect);

    const resized = await img.resize(THUMB_WIDTH, height, { fit: 'inside' }).toBuffer();
    composites.push({ input: resized, left: currentRow.length * THUMB_WIDTH, top: y });

    // label background + text via sharp? easier: create small PNG with text? Sharp doesn't draw text natively.
    // We'll add filename text by creating a tiny SVG and compositing.
    const labelSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${LABEL_HEIGHT}"><rect width="100%" height="100%" fill="#0a0f1a"/><text x="8" y="19" fill="#e8ecf4" font-family="sans-serif" font-size="13">${file.replace('.png','')}</text></svg>`);
    composites.push({ input: labelSvg, left: currentRow.length * THUMB_WIDTH, top: y + height });

    currentRow.push({ width: THUMB_WIDTH, height: height + LABEL_HEIGHT });
    if (currentRow.length === COLS) {
      rows.push(currentRow);
      y += Math.max(...currentRow.map(c => c.height));
      currentRow = [];
    }
  }

  if (currentRow.length) {
    rows.push(currentRow);
    y += Math.max(...currentRow.map(c => c.height));
  }

  const canvasWidth = COLS * THUMB_WIDTH;
  const canvasHeight = y;

  await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 3, background: { r: 10, g: 15, b: 26 } } })
    .composite(composites)
    .png()
    .toFile(path.join(OUT_DIR, `contact-sheet-${viewport}.png`));

  console.log(`Generated contact-sheet-${viewport}.png (${files.length} images)`);
}

(async () => {
  for (const vp of VIEWPORTS) await generate(vp);
})();
