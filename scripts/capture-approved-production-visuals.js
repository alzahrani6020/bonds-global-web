/**
 * Capture approved live BONDS appearance into a repository-root-only evidence directory.
 * Does not change tests/visual/baselines, deploy, or access user credentials.
 * Usage: node scripts/capture-approved-production-visuals.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'tests', 'visual', 'production-reference');
const APPROVED_ORIGIN = 'https://bonds-global.com';
const EXPECTED_SHA = 'dea2b14e792b840542d1f42b95d4b02e1d702fee';
const DEVICES = [
  { id: 'desktop', width: 1280, height: 900 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'mobile', width: 375, height: 667 },
];
const LANGUAGES = [
  { id: 'ar', route: '/' },
  { id: 'en', route: '/en/index.html' },
];
function withinRoot(filename) {
  const resolved = path.resolve(filename);
  if (!resolved.startsWith(ROOT + path.sep)) throw Error('OUTSIDE_BONDS_ROOT');
  return resolved;
}
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

async function main() {
  if (process.env.BONDS_APPROVED_PRODUCTION_ORIGIN &&
      process.env.BONDS_APPROVED_PRODUCTION_ORIGIN !== APPROVED_ORIGIN) {
    throw Error('PRODUCTION_ORIGIN_MISMATCH');
  }
  const browser = await chromium.launch({ headless: true });
  const record = {
    status: 'CAPTURED_NOT_PROMOTED_TO_TEST_BASELINES',
    origin: APPROVED_ORIGIN,
    expectedGitShaFromVercel: EXPECTED_SHA,
    note: 'The live domain response is not proof of a deployed Git SHA. Verify alias and SHA separately in Vercel before baseline promotion.',
    browserVersion: browser.version(),
    createdUtc: new Date().toISOString(),
    captures: [],
  };
  try {
    for (const device of DEVICES) {
      for (const language of LANGUAGES) {
        const context = await browser.newContext({
          viewport: { width: device.width, height: device.height },
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
          locale: language.id === 'ar' ? 'ar-SA' : 'en-US',
        });
        const page = await context.newPage();
        try {
          const target = new URL(language.route, APPROVED_ORIGIN);
          const response = await page.goto(target.toString(), { waitUntil: 'networkidle', timeout: 45000 });
          if (!response || response.status() !== 200 || new URL(page.url()).origin !== APPROVED_ORIGIN) {
            throw Error('APPROVED_PRODUCTION_HTTP_ORIGIN_INVALID: ' + language.id + ' ' + device.id);
          }
          await page.evaluate(async () => {
            await document.fonts.ready;
            const images = [...document.images];
            await Promise.all(images.map(async img => {
              if (!img.complete || !img.naturalWidth) throw Error('PRODUCTION_IMAGE_UNAVAILABLE');
              if (img.decode) await img.decode();
            }));
          });
          await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
          const filename = withinRoot(path.join(DEST, device.id, 'index-' + language.id + '.png'));
          fs.mkdirSync(path.dirname(filename), { recursive: true });
          const data = await page.screenshot({ fullPage: false, animations: 'disabled' });
          fs.writeFileSync(filename, data, { flag: 'wx' });
          record.captures.push({
            device: device.id,
            language: language.id,
            requestedUrl: target.toString(),
            finalUrl: page.url(),
            httpStatus: response.status(),
            dimensions: [device.width, device.height],
            bytes: data.length,
            sha256: sha256(data),
            file: path.relative(ROOT, filename).replace(/\\/g, '/'),
          });
        } finally { await context.close(); }
      }
    }
    const manifest = withinRoot(path.join(DEST, 'manifest.json'));
    fs.writeFileSync(manifest, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: record.status, captures: record.captures.length, manifest: path.relative(ROOT, manifest) }));
  } finally { await browser.close(); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { withinRoot, ROOT, DEST, APPROVED_ORIGIN, EXPECTED_SHA };
