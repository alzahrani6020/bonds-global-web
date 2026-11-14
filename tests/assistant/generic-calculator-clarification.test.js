'use strict';

const {
  parseCalculatorOpen,
  calculatorOpenNeedsClarification,
  formatCalculatorClarificationReply
} = require('../../lib/assistant/deterministic-tools');
const { runDeterministicLocalTools } = require('../../lib/assistant/universal-orchestrator');

describe('generic calculator intent clarification', () => {
  test.each(['فتح الحاسبة', 'افتح الحاسبة', 'الحاسبة', 'open calculator', 'open the calculator'])(
    'asks for a calculator type without guessing: %s',
    text => {
      expect(parseCalculatorOpen(text)).toBeNull();
      expect(calculatorOpenNeedsClarification(text)).toBe(true);
    }
  );

  test.each(['افتح حاسبة القرض', 'فتح حاسبة القرض', 'افتح حاسبة الجدوى', 'كيف أستخدم الحاسبة؟', 'احسب 2+2'])(
    'does not interfere with existing specific or non-open intents: %s',
    text => {
      expect(calculatorOpenNeedsClarification(text)).toBe(false);
    }
  );

  test('keeps the original specific calculator route', () => {
    expect(parseCalculatorOpen('افتح حاسبة القرض')).toEqual({ calculator: 'loan' });
    expect(parseCalculatorOpen('فتح حاسبة القرض')).toEqual({ calculator: 'loan' });
  });

  test('lists the seven supported calculators in Arabic and English', () => {
    expect(formatCalculatorClarificationReply('ar')).toContain('حاسبة الجدارة الائتمانية');
    expect(formatCalculatorClarificationReply('ar')).toContain('حاسبة القرض');
    expect(formatCalculatorClarificationReply('en')).toContain('Loan calculator');
    expect(formatCalculatorClarificationReply('en')).toContain('Feasibility calculator');
  });

  test.each(['فتح الحاسبة', 'افتح الحاسبة'])(
    'returns deterministic clarification without navigation: %s',
    async text => {
      const result = await runDeterministicLocalTools(
        [{ role: 'user', content: text }],
        {},
        {},
        []
      );
      expect(result).toMatchObject({
        ok: true,
        toolUsed: false,
        planner: 'universal-v2-deterministic-tool',
        actions: []
      });
      expect(result.reply).toContain('أي حاسبة');
    }
  );
});
