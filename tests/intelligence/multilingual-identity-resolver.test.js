'use strict';

/**
 * Multilingual Identity Resolver — architect-mandated cases:
 * - Arabic<->English transliteration variants (محمد بن سلمان / Mohammed bin
 *   Salman / Mohammad bin Salman / MBS / محمد سلمان)
 * - two different people sharing a name must never merge
 * - title/honorific stripping (both languages)
 * - short/abbreviated names
 * - name without qualifiers -> never VERIFIED
 * - conflicting country/role -> CONTRADICTED / AMBIGUOUS
 * - near-name negative case (Mohammad Salim != Mohammed bin Salman)
 */

const resolver = require('../../lib/intelligence/multilingual-identity-resolver');

const {
  VERIFICATION_STATES,
  normalizeArabicName,
  normalizeLatinName,
  stripHonorifics,
  foldNameTokens,
  resolveIdentity
} = resolver;

describe('multilingual-identity-resolver normalization', () => {
  test('strips Arabic diacritics/tatweel and folds أإآ to ا', () => {
    expect(normalizeArabicName('مُحَمَّد بْن سَلْمَان')).toBe('محمد بن سلمان');
    expect(normalizeArabicName('أحمد إبراهيم آدم')).toBe('احمد ابراهيم ادم');
  });

  test('applies ة/ه and ء/ئ/ؤ folding heuristics', () => {
    expect(normalizeArabicName('عائشة')).toBe('عايشه');
    expect(normalizeArabicName('مصطفى')).toBe('مصطفي');
  });

  test('normalizes Latin case and punctuation', () => {
    expect(normalizeLatinName('Mohammed  bin-Salman, PhD.')).toBe('mohammed bin salman phd');
    expect(normalizeLatinName('ABD-ALAZIZ')).toBe('abd alaziz');
  });

  test('folds transliteration-equivalent particles into one token space', () => {
    const fold = value => foldNameTokens(value).map(item => item.particle || item.canonical);
    expect(fold('محمد بن سلمان')).toEqual(['محمد', 'ibn', 'سلمان']);
    expect(fold('Mohammed bin Salman')).toEqual(['muhammad', 'ibn', 'salman']);
    expect(fold('Mohammad ben Salman')).toEqual(['muhammad', 'ibn', 'salman']);
    expect(fold('Abdel Fattah el-Sisi')).toEqual(['abd', 'fattah', 'al', 'sisi']);
    expect(fold('ناصر الدين').slice(1)).toEqual(['din']);
  });

  test('strips titles and honorifics in Arabic and English', () => {
    expect(stripHonorifics('الدكتور محمد بن سلمان').name).toBe('محمد بن سلمان');
    expect(stripHonorifics('سعادة المهندس خالد').name).toBe('خالد');
    expect(stripHonorifics('HRH Prince Mohammed bin Salman').name).toBe('Mohammed bin Salman');
    expect(stripHonorifics('Dr. Jane Doe').name).toBe('Jane Doe');
    expect(stripHonorifics('Sheikh Mohammed bin Salman').stripped).toEqual(['Sheikh']);
  });
});

describe('multilingual-identity-resolver transliteration variants', () => {
  const context = { country:'SA', role:'ولي العهد' };

  test('محمد بن سلمان resolves to the seed entity when qualifiers confirm', () => {
    const result = resolveIdentity('محمد بن سلمان', context);
    expect(result.entityType).toBe('person');
    expect(result.verificationState).toBe(VERIFICATION_STATES.VERIFIED);
    expect(result.canonicalName).toBe('Mohammed bin Salman');
    expect(result.canonicalNameAr).toBe('محمد بن سلمان');
    expect(result.aliases).toContain('محمد بن سلمان');
    expect(result.aliases).toContain('Mohammed bin Salman');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.evidence.some(item => item.type === 'known_entity_match' && item.provenance === 'seed:known-entities:v1')).toBe(true);
  });

  test('Mohammed bin Salman / Mohammad bin Salman are the same identity', () => {
    for (const mention of ['Mohammed bin Salman', 'Mohammad bin Salman', 'Mohammed Bin Salman']) {
      const result = resolveIdentity(mention, context);
      expect(result.verificationState).toBe(VERIFICATION_STATES.VERIFIED);
      expect(result.canonicalName).toBe('Mohammed bin Salman');
      expect(result.canonicalNameAr).toBe('محمد بن سلمان');
    }
  });

  test('MBS abbreviation resolves via the known-alias table with its own provenance', () => {
    const result = resolveIdentity('MBS', { country:'SA' });
    expect(result.verificationState).toBe(VERIFICATION_STATES.VERIFIED);
    expect(result.canonicalName).toBe('Mohammed bin Salman');
    const abbreviation = result.evidence.find(item => item.type === 'abbreviation_match');
    expect(abbreviation).toBeDefined();
    expect(abbreviation.provenance).toBe('seed:known-entities:v1');
  });

  test('محمد سلمان short form matches with qualifiers and stays at or below full-form confidence', () => {
    const short = resolveIdentity('محمد سلمان', context);
    const full = resolveIdentity('محمد بن سلمان', context);
    expect(short.verificationState).toBe(VERIFICATION_STATES.VERIFIED);
    expect(short.canonicalName).toBe('Mohammed bin Salman');
    expect(short.confidence).toBeLessThanOrEqual(full.confidence);
  });

  test('titles are stripped before matching', () => {
    const result = resolveIdentity('الدكتور محمد بن سلمان', { country:'SA' });
    expect(result.verificationState).toBe(VERIFICATION_STATES.VERIFIED);
    expect(result.canonicalName).toBe('Mohammed bin Salman');
    expect(result.evidence.some(item => item.type === 'honorific_stripped')).toBe(true);
  });

  test('cross-language role qualifiers confirm (Crown Prince == ولي العهد)', () => {
    const result = resolveIdentity('Mohammed bin Salman', { country:'SA', role:'Crown Prince' });
    expect(result.verificationState).toBe(VERIFICATION_STATES.VERIFIED);
  });

  test('near-name "Mohammad Salim" never matches the Salman entity', () => {
    const result = resolveIdentity('Mohammad Salim', { country:'SA' });
    expect(result.verificationState).not.toBe(VERIFICATION_STATES.VERIFIED);
    expect(result.canonicalName).not.toBe('Mohammed bin Salman');
    expect(result.evidence.some(item => item.type === 'known_entity_match')).toBe(false);
  });
});

describe('multilingual-identity-resolver ambiguity discipline', () => {
  test('a matched name without qualifiers is never VERIFIED', () => {
    for (const mention of ['محمد بن سلمان', 'Mohammed bin Salman', 'MBS']) {
      const result = resolveIdentity(mention, {});
      expect(result.verificationState).not.toBe(VERIFICATION_STATES.VERIFIED);
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    }
    const named = resolveIdentity('محمد بن سلمان', {});
    expect(named.evidence.some(item => item.type === 'missing_qualifiers' || item.type === 'ambiguity')).toBe(true);
  });

  test('two different people sharing a name are not merged', () => {
    const saudi = resolveIdentity('محمد سلمان', { country:'SA' });
    const bangladeshi = resolveIdentity('محمد سلمان', { country:'BD' });
    expect(saudi.verificationState).toBe(VERIFICATION_STATES.VERIFIED);
    expect(bangladeshi.verificationState).toBe(VERIFICATION_STATES.VERIFIED);
    expect(saudi.canonicalName).not.toBe(bangladeshi.canonicalName);
  });

  test('a shared name without distinguishing signals is AMBIGUOUS', () => {
    const result = resolveIdentity('محمد سلمان', {});
    expect(result.verificationState).toBe(VERIFICATION_STATES.AMBIGUOUS);
    expect(result.canonicalName).toBeNull();
    expect(result.aliases).toEqual([]);
    const ambiguity = result.evidence.find(item => item.type === 'ambiguity');
    expect(ambiguity.candidates.length).toBeGreaterThanOrEqual(2);
  });

  test('conflicting country yields CONTRADICTED', () => {
    const result = resolveIdentity('محمد بن سلمان', { country:'EG' });
    expect(result.verificationState).toBe(VERIFICATION_STATES.CONTRADICTED);
    expect(result.confidence).toBeLessThanOrEqual(0.4);
    expect(result.evidence.some(item => item.type === 'qualifier_conflict' && item.field === 'country')).toBe(true);
  });

  test('conflicting role yields CONTRADICTED', () => {
    const result = resolveIdentity('محمد بن سلمان', { country:'SA', role:'وزير الخارجيه' });
    expect(result.verificationState).toBe(VERIFICATION_STATES.CONTRADICTED);
    expect(result.evidence.some(item => item.type === 'qualifier_conflict' && item.field === 'role')).toBe(true);
  });

  test('unknown names return INSUFFICIENT_EVIDENCE with the mention preserved', () => {
    const result = resolveIdentity('John Smith', { country:'GB' });
    expect(result.verificationState).toBe(VERIFICATION_STATES.INSUFFICIENT_EVIDENCE);
    expect(result.entityType).toBe('person');
    expect(result.canonicalName).toBe('John Smith');
    expect(result.evidence.some(item => item.type === 'no_known_entity')).toBe(true);
  });

  test('qualifiers are echoed in the output shape', () => {
    const result = resolveIdentity('محمد بن سلمان', { country:'السعودية', role:'ولي العهد', organization:null });
    expect(result.qualifiers.country).toBe('SA');
    expect(result.qualifiers.role).toBe('ولي العهد');
    expect(result.rawMention).toBe('محمد بن سلمان');
  });
});
