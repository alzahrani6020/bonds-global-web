/**
 * @jest-environment node
 */
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
});
