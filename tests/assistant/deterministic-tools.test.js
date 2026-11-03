'use strict';

const {
  parseMathCommand,
  parseCalculatorOpen,
  mathCommandNeedsClarification,
  resolveDeterministicTool,
  formatDeterministicToolReply
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
});
