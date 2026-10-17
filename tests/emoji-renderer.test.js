/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const EmojiRenderer = require('../components/emoji-renderer');

describe('emoji renderer Unicode sequence matching', () => {
  test('keeps variation selectors with pictographic emoji', () => {
    expect(EmojiRenderer.findEmojiSequences('تحذير ⚠️ ومنظر 🏞️')).toEqual(['⚠️', '🏞️']);
  });

  test('matches regional-indicator flags as one sequence', () => {
    expect(EmojiRenderer.findEmojiSequences('السعودية 🇸🇦')).toEqual(['🇸🇦']);
  });

  test('matches ZWJ and keycap sequences', () => {
    expect(EmojiRenderer.findEmojiSequences('👩‍💻 5️⃣')).toEqual(['👩‍💻', '5️⃣']);
  });

  test('constrains injected SVG dimensions to the inline emoji box', () => {
    const style = EmojiRenderer.getInlineSvgStyle();
    expect(style).toContain('width:1em');
    expect(style).toContain('height:1em');
    expect(style).toContain('max-width:1em');
    expect(style).toContain('max-height:1em');
    expect(style).toContain('transform:none');
    expect(style).toContain('position:static');
  });
});


describe('emoji renderer cache policy', () => {
  test('forces revalidation for the shared renderer asset', () => {
    const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'vercel.json'), 'utf8'));
    const rule = vercel.headers.find((entry) => entry.source === '/components/emoji-renderer.js');
    expect(rule).toBeDefined();
    expect(rule.headers).toContainEqual({
      key: 'Cache-Control',
      value: 'no-cache, no-store, must-revalidate'
    });
  });
});
