const {
  normalizeArabicSearch,
  stripSearchCommand,
  stripOutputInstructions,
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

  test('strips professional titles from person search entity', () => {
    const result = resolveLanguageQuery('من هو المستشار المالي الدكتور طلال حسن الزهراني؟');
    expect(result.intent).toBe('person_lookup');
    expect(result.entity).toEqual(expect.objectContaining({
      type:'person',
      text:'طلال حسن الزهراني'
    }));
    expect(result.selected_query).toBe('طلال حسن الزهراني');
    expect(result.query_variants).toEqual(expect.arrayContaining([
      'طلال حسن الزهراني',
      'طلال حسن الزهراني سيرة',
      'طلال حسن الزهراني biography'
    ]));
    expect(result.query_variants).not.toContain('المستشار المالي الدكتور طلال حسن الزهراني');
  });

  test('strips honorific prefixes from person search entity', () => {
    const result = resolveLanguageQuery('من هو صاحب السمو الملكي الأمير محمد بن سلمان؟');
    expect(result.intent).toBe('person_lookup');
    expect(result.entity.text).toBe('محمد بن سلمان');
    expect(result.selected_query).toBe('محمد بن سلمان');
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

  test('strips presentation instructions from a search topic without changing the subject', () => {
    expect(
      stripOutputInstructions('الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.')
    ).toBe('الموقع الرسمي لوزارة المالية السعودية');

    expect(
      stripOutputInstructions('Saudi Ministry of Finance official website, and return the organization name and official link only.')
    ).toBe('Saudi Ministry of Finance official website');
  });

  test('extracts a concise semantic topic from the production official-URL smoke prompt', () => {
    const result = resolveLanguageQuery(
      'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.'
    );

    expect(result.intent).toBe('web_research');
    expect(result.entity).toEqual(expect.objectContaining({
      type:'topic',
      text:'الموقع الرسمي لوزارة المالية السعودية'
    }));
    expect(result.selected_query).toBe('الموقع الرسمي لوزارة المالية السعودية');
    expect(result.query_variants[0]).toBe('الموقع الرسمي لوزارة المالية السعودية');
  });

  test('does not strip semantic comparison constraints that are part of the research subject', () => {
    const result = resolveLanguageQuery(
      'ابحث في الإنترنت عن أثر ضريبة القيمة المضافة على الشركات الصغيرة مع مقارنة 2025 و2026'
    );

    expect(result.entity.text).toContain('مع مقارنة 2025 و2026');
  });

  test('does not silently correct a possibly misspelled entity', () => {
    const result = resolveLanguageQuery('من هو عمر موسى؟');
    expect(result.entity.text).toBe('عمر موسى');
    expect(result.query_variants).not.toContain('عمرو موسى');
    expect(result.query_variants).not.toContain('Amr Moussa');
  });

  test('understands Arabic person lookup without copula', () => {
    const result = resolveLanguageQuery('\u0645\u0646 \u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646');
    expect(result.intent).toBe('person_lookup');
    expect(result.requires_research).toBe(true);
    expect(result.entity.type).toBe('person');
    expect(result.entity.text).toBe('\u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646');
  });

  test('understands reversed Arabic person lookup', () => {
    const result = resolveLanguageQuery('\u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646 \u0645\u0646\u061f');
    expect(result.intent).toBe('person_lookup');
    expect(result.entity.text).toBe('\u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646');
  });

  test('understands colloquial tell-me-about request', () => {
    const result = resolveLanguageQuery('\u0648\u0634 \u062a\u0639\u0631\u0641 \u0639\u0646 \u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646\u061f');
    expect(result.intent).toBe('web_research');
    expect(result.requires_research).toBe(true);
    expect(result.entity.text).toBe('\u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646');
  });

  test('understands information-about request', () => {
    const result = resolveLanguageQuery('\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0639\u0646 \u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646');
    expect(result.intent).toBe('web_research');
    expect(result.requires_research).toBe(true);
    expect(result.entity.text).toBe('\u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646');
  });

  test('understands introduce-me-to request', () => {
    const result = resolveLanguageQuery('\u0639\u0631\u0641\u0646\u064a \u0639\u0644\u0649 \u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646');
    expect(result.intent).toBe('person_lookup');
    expect(result.requires_research).toBe(true);
    expect(result.entity.text).toBe('\u0645\u062d\u0645\u062f \u0628\u0646 \u0633\u0644\u0645\u0627\u0646');
  });

  test('promotes titled tell-me-about request to person lookup with a versioned frame', () => {
    const result = resolveLanguageQuery('حدثني عن الدكتور طلال حسن الزهراني');
    expect(result.intent).toBe('person_lookup');
    expect(result.entity.type).toBe('person');
    expect(result.entity.text).toBe('طلال حسن الزهراني');
    expect(result.entity.person_entity_frame).toEqual(expect.objectContaining({
      person_identity_schema_version:1,
      raw_mention:'الدكتور طلال حسن الزهراني',
      canonical_name:'طلال حسن الزهراني'
    }));
    expect(result.semantic_frame.person_entity_frame.canonical_name).toBe('طلال حسن الزهراني');
  });

  test('promotes titled information-about request to person lookup', () => {
    const result = resolveLanguageQuery('معلومات عن المحامي أحمد محمد علي');
    expect(result.intent).toBe('person_lookup');
    expect(result.entity.text).toBe('أحمد محمد علي');
    expect(result.entity.person_entity_frame.qualifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value:'المحامي', source:'user', verified:false })
      ])
    );
  });

  test('keeps generic non-person topic phrasing out of person lookup', () => {
    const result = resolveLanguageQuery('حدثني عن مستقبل الذكاء الاصطناعي التوليدي');
    expect(result.intent).toBe('web_research');
    expect(result.entity.type).toBe('topic');
  });

  test('parses organization role-holder question as relation lookup, not a person named after the company', () => {
    const result = resolveLanguageQuery('من هو رئيس شركة أرامكو؟');

    expect(result.intent).toBe('relation_lookup');
    expect(result.entity).toEqual(expect.objectContaining({
      type:'relation',
      text:'شركة أرامكو',
      relation:expect.objectContaining({ value:'رئيس', verified:false }),
      organization:expect.objectContaining({ value:'شركة أرامكو', verified:false })
    }));
    expect(result.entity_frame).toEqual(expect.objectContaining({
      entity_type:'relation',
      canonical_name:'شركة أرامكو'
    }));
    expect(result.entity_frame.relations).toEqual([
      expect.objectContaining({ value:'رئيس' })
    ]);
    expect(result.entity_frame.organizations).toEqual([
      expect.objectContaining({ value:'شركة أرامكو' })
    ]);
    expect(result.query_variants).toEqual(expect.arrayContaining([
      'رئيس شركة أرامكو',
      'شركة أرامكو رئيس'
    ]));
    expect(result.query_variants).not.toEqual(expect.arrayContaining([
      'شركة أرامكو سيرة',
      'شركة أرامكو biography'
    ]));
  });

});
