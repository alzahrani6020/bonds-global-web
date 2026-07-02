const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || 'distressed-recovery-study.html';
const inputPath = path.resolve(__dirname, '..', inputFile);

if (!fs.existsSync(inputPath)) {
  console.error('File not found:', inputPath);
  process.exit(1);
}

let html = fs.readFileSync(inputPath, 'utf8');

// Compact footer HTML to insert before each h2
const footerHtml = `
<!-- Page footer -->
<div class="page-inline-footer" style="
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 8px;
  border-top: 0.5pt solid rgba(197,160,48,0.3);
  font-size: 8pt;
  color: #777;
  direction: rtl;
">
  <div style="text-align: right; line-height: 1.5;">
    <span style="color: #c5a030; font-weight: 700; font-size: 8.5pt;">www.bonds-global.com</span><br>
    <span style="font-size: 7.5pt;">© 2026 Bonds Global — جميع الحقوق محفوظة</span>
  </div>
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://bonds-global.com"
       style="width: 28px; height: 28px; border-radius: 3px; border: 0.5pt solid #ddd; padding: 1px; background: white;">
</div>
`;

// Find all <h2> tags and insert footer before each one (except the first which follows cover)
const h2Regex = /<h2/g;
let match;
let indices = [];
while ((match = h2Regex.exec(html)) !== null) {
  indices.push(match.index);
}

console.log('Found', indices.length, 'h2 elements');

// Skip the first h2 (it's right after the cover, we don't want footer between cover and first section)
// Actually, we DO want a footer before the first h2 because it starts a new page
// But the cover already has branding, so let's skip it
for (let i = indices.length - 1; i >= 1; i--) {
  const idx = indices[i];
  html = html.slice(0, idx) + footerHtml + '\n\n' + html.slice(idx);
}

// Also hide the old print-footer and sticky footer since we're using inline ones
html = html.replace(
  /<style>/,
  `<style>
  /* Hide old sticky footer */
  .print-footer { display: none !important; }
  /* Hide inline footers on screen */
  .page-inline-footer { display: none; }
  @media print {
    .page-inline-footer { display: flex !important; }
  }`
);

fs.writeFileSync(inputPath, html, 'utf8');
console.log('✅ Added inline footers before', indices.length - 1, 'sections');
