const {
  normalizeArabicSearch,
  stripSearchCommand,
  extractEntity,
  classifyGeneralIntent,
  resolveLanguageQuery
} = require('../../lib/assistant/language-query-resolver');

describe('BONDS language and query resolver', () => {
  test('normalizes Arabic orthography without altering the displayed raw entity', () => {
    expect(normalizeArabicSearch('  أَحمدُ آلزهراني؟ ')).toBe('احمد الزهراني');
  });

  test('extracts person lookup entity and builds concise search variants', () => {
    const result = resolveLanguageQuery('من هو عمر موسى؟');
    expect(result.language.language).toBe('ar');
    expect(result.intent).toBe('person_lookup');
    expect(result.requires_research).toBe(true);
    expect(result.entity).toEqual(expect.objectContaining({
      type:'person',
      text:'عمر موسى'
    }));
    expect(result.selected_query).toBe('عمر موسى');
    expect(result.query_variants).toEqual(expect.arrayContaining([
      'عمر موسى',
      'عمر موسى سيرة',
      'عمر موسى biography'
    ]));
  });

  test('strips a trailing UI ordinal from a person entity', () => {
    const result = resolveLanguageQuery('من هو عمر موسى 4.');
    expect(result.intent).toBe('person_lookup');
    expect(result.entity).toEqual(expect.objectContaining({
      type:'person',
      text:'عمر موسى'
    }));
    expect(result.selected_query).toBe('عمر موسى');
    expect(result.query_variants).not.toContain('عمر موسى 4');
  });

  test('keeps mixed Arabic and English language metadata explicit', () => {
    const result = resolveLanguageQuery('حلل EBITDA وابحث latest news');
    expect(result.language.language).toBe('mixed');
    expect(result.semantic_frame.language).toBeDefined();
  });

  test('recognizes colloquial Arabic search commands', () => {
    expect(stripSearchCommand('دور لي في النت عن بوندز')).toBe('بوندز');
    expect(classifyGeneralIntent('شوف لي أخبار بوندز')).toEqual(expect.objectContaining({
      intent:'web_research',
      requires_research:true
    }));
  });

  test('does not silently correct a possibly misspelled entity', () => {
    const result = resolveLanguageQuery('من هو عمر موسى؟');
    expect(result.entity.text).toBe('عمر موسى');
    expect(result.query_variants).not.toContain('عمرو موسى');
    expect(result.query_variants).not.toContain('Amr Moussa');
  });
});
