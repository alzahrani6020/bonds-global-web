const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
describe('BONDS verification certificate seal layout', () => {
  for (const rel of ['verify-document.html','en/verify-document.html']) {
    test(rel + ': certificate SVG separates seal text and border', () => {
      const html = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(html).toContain('viewBox="0 0 300 192"');
      expect(html).toContain('class="certificate-seal-svg"');
      expect(html).toContain('rx="146" ry="91"');
      expect(html).toContain('id="seal-ref" x="150" y="133"');
      expect(html).toContain('id="seal-date" x="150" y="150"');
      expect(html).toContain('.certificate-seal-svg{display:block;width:100%;height:auto;');
      expect(html).toContain('.seal{width:min(100%,420px);');
      expect(html).toContain("document.getElementById('seal-ref').textContent=");
      expect(html).toContain("document.getElementById('seal-date').textContent=");
      expect(html).not.toContain('.seal{border:2px solid #0d4da5;border-radius:50%');
    });
  }
});