'use strict';

const {
  parseMathCommand,
  parseCalculatorOpen,
  parsePageOpen,
  parsePageUse,
  parseHereQuestion,
  mathCommandNeedsClarification,
  resolveDeterministicTool,
  formatDeterministicToolReply,
  formatHereReply,
  calculatorNavigationAction
} = require('../../lib/assistant/deterministic-tools');

describe('deterministic assistant tools', () => {
  test('parses Arabic percent-of-magnitude commands into arithmetic', () => {
    expect(parseMathCommand('احسب 18 بالمئة من مليون')).toEqual({
      expression:'(1000000) * (18 / 100)'
    });
    expect(parseMathCommand('احسب لي 18 بالمئة من مليون')).toEqual({
      expression:'(1000000) * (18 / 100)'
    });
    expect(parseMathCommand('احسب ١٨٪ من مليون')).toEqual({
      expression:'(1000000) * (18 / 100)'
    });
    expect(parseMathCommand('calculate 18% of a million')).toEqual({
      expression:'(1000000) * (18 / 100)'
    });
    expect(parseMathCommand('calculate 2 + 2')).toEqual({
      expression:'2+2'
    });
    expect(parseMathCommand('كيف احسب الميزانية')).toBeNull();
    expect(parseMathCommand('احسب الميزانية')).toBeNull();
  });

  test('parses explicit calculator open commands to registered keys', () => {
    expect(parseCalculatorOpen('افتح حاسبة القرض')).toEqual({ calculator:'loan' });
    expect(parseCalculatorOpen('open loan calculator')).toEqual({ calculator:'loan' });
    expect(parseCalculatorOpen('كيف اعمل ميزانية')).toBeNull();
    expect(parseCalculatorOpen('احسب 18 بالمئة من مليون')).toBeNull();
  });

  test('opens registered pages instead of asking for accounting identifiers', () => {
    expect(parsePageOpen('افتح صفحة الميزانية')).toEqual({ target:'budgeting' });
    expect(parsePageOpen('افتح الميزانية')).toEqual({ target:'budgeting' });
    expect(parsePageOpen('open budgeting page')).toEqual({ target:'budgeting' });
    expect(parsePageOpen('افتح صفحة التمويل')).toEqual({ target:'funding' });
    expect(parsePageOpen('كيف اعمل ميزانية')).toBeNull();
    expect(parseCalculatorOpen('افتح حاسبة التمويل')).toEqual({ calculator:'loan' });
    expect(parseCalculatorOpen('افتح صفحة حاسبة التمويل')).toEqual({ calculator:'loan' });
    expect(resolveDeterministicTool('افتح حاسبة التمويل')).toEqual({
      action:'calculator_open',
      input:{ calculator:'loan' }
    });
    expect(resolveDeterministicTool('افتح صفحة حاسبة التمويل')).toEqual({
      action:'calculator_open',
      input:{ calculator:'loan' }
    });
    expect(resolveDeterministicTool('افتح صفحة الميزانية')).toEqual({
      action:'site_navigate',
      input:{ target:'budgeting' }
    });
  });

  test('routes registered City Intelligence use requests but not informational questions', () => {
    expect(parsePageOpen('افتح ذكاء المدن من الموقع')).toEqual({ target:'city_intelligence' });
    expect(parsePageOpen('افتح مؤشرات المدينة من الموقع')).toEqual({ target:'city_intelligence' });
    expect(parsePageUse('كيف استخدم ذكاء المدن')).toEqual({ target:'city_intelligence' });
    expect(parsePageUse('كيف أستخدم ذكاء المدن من الموقع')).toEqual({ target:'city_intelligence' });
    expect(parsePageUse('كيف استخدم مؤشرات المدينة')).toEqual({ target:'city_intelligence' });
    expect(parsePageUse('how do I use city intelligence')).toEqual({ target:'city_intelligence' });
    expect(parsePageUse('how do I use city indicators')).toEqual({ target:'city_intelligence' });
    expect(parsePageUse('كيف يعمل ذكاء المدن؟')).toBeNull();
    expect(parsePageUse('ما فوائد ذكاء المدن؟')).toBeNull();
    expect(parsePageOpen('كيف استخدم ذكاء المدن من الموقع')).toBeNull();
    expect(resolveDeterministicTool('كيف استخدم ذكاء المدن')).toEqual({
      action:'site_navigate',
      input:{ target:'city_intelligence' }
    });
    expect(resolveDeterministicTool('كيف استخدم مؤشرات المدينة من الموقع')).toEqual({
      action:'site_navigate',
      input:{ target:'city_intelligence' }
    });
    expect(resolveDeterministicTool('كيف يعمل ذكاء المدن؟')).toBeNull();
  });

  test('describes the current page without asking for more context', () => {
    expect(parseHereQuestion('ما الموجود هنا')).toBe(true);
    expect(parseHereQuestion('ما هذه الصفحة')).toBe(true);
    expect(parseHereQuestion('افتح صفحة الميزانية')).toBe(false);
    expect(formatHereReply({ pagePath:'/calculators/loan', pageTitle:'حاسبة القرض والتمويل | بوندز' }, 'ar'))
      .toBe('أنت الآن في حاسبة القرض والتمويل. تحسب الأقساط والفائدة وجدول الاستهلاك.');
    expect(formatHereReply({ pagePath:'/budgeting' }, 'ar'))
      .toBe('أنت الآن في صفحة إعداد الميزانيات والموازنات والتوقعات المالية.');
  });

  test('resolves registered tools only', () => {
    expect(resolveDeterministicTool('احسب 18 بالمئة من مليون')).toEqual({
      action:'math_calculate',
      input:{ expression:'(1000000) * (18 / 100)' }
    });
    expect(resolveDeterministicTool('افتح حاسبة القرض')).toEqual({
      action:'calculator_open',
      input:{ calculator:'loan' }
    });
    expect(resolveDeterministicTool('من مردونا')).toBeNull();
    expect(mathCommandNeedsClarification('احسب الميزانية')).toBe(true);
    expect(mathCommandNeedsClarification('احسب 18 بالمئة من مليون')).toBe(false);
  });

  test('formats bilingual tool replies from governed results', () => {
    expect(formatDeterministicToolReply(
      { action:'math_calculate', input:{ expression:'2+2' } },
      { ok:true, result:{ value:4 } },
      'ar'
    )).toBe('الناتج: 4');

    expect(formatDeterministicToolReply(
      { action:'calculator_open', input:{ calculator:'loan' } },
      { ok:true, result:{ calculator:'loan', navigation:{ route:'/calculators/loan' } } },
      'ar'
    )).toBe('حاسبة القرض\n/calculators/loan');
  });

  test('exposes a governed navigation action only after a registered calculator opens', () => {
    expect(calculatorNavigationAction({
      ok:true,
      result:{ navigation:{ target:'calculator_loan', route:'/calculators/loan' } }
    })).toEqual({
      type:'site_navigate',
      capability:'site_navigate',
      target:'calculator_loan',
      risk:'low'
    });
    expect(calculatorNavigationAction({ ok:false, result:{ navigation:{ target:'calculator_loan' } } })).toBeNull();
    expect(calculatorNavigationAction({ ok:true, result:{} })).toBeNull();
  });
});
