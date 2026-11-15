'use strict';

const {
  normalizeUtterance,
  understandCalculatorOpen,
  calculatorNeedsClarification,
  formatCalculatorClarificationReply
} = require('../../lib/assistant/request-understanding');
const {
  resolveDeterministicTool,
  parseCalculatorOpen,
  calculatorOpenNeedsClarification
} = require('../../lib/assistant/deterministic-tools');

describe('request-understanding engine', () => {
  test('normalizes Arabic dialect and typo variants without destroying text', () => {
    expect(normalizeUtterance('حاسبة')).toBe('حاسبه');
    expect(normalizeUtterance('جدوى')).toBe('جدوي');
    expect(normalizeUtterance('إفتح الحاسبة')).toBe('افتح الحاسبه');
    expect(normalizeUtterance('أبغى أحاسب')).toBe('ابغي احاسب');
    expect(normalizeUtterance('احسب ٢+٢')).toBe('احسب 2+2');
    expect(normalizeUtterance('  عايز   حاسبة   ')).toBe('عايز حاسبه');
  });

  test('understands dialect and desire phrasings for a specific calculator', () => {
    expect(understandCalculatorOpen('ابغى اسلف واحسب القسط')).toEqual({ calculator: 'loan' });
    expect(understandCalculatorOpen('عايز حاسبة الجدوى')).toEqual({ calculator: 'feasibility' });
    expect(understandCalculatorOpen('جدوه')).toEqual({ calculator: 'feasibility' });
    expect(understandCalculatorOpen('ممكن حاسبة السيولة')).toEqual({ calculator: 'cash_flow' });
    expect(understandCalculatorOpen('ابي احاسب التعادل')).toEqual({ calculator: 'break_even' });
    expect(understandCalculatorOpen('حاسبة المطعم')).toEqual({ calculator: 'restaurant' });
    expect(understandCalculatorOpen('ابغى اعرف جدارتي الائتمانية')).toEqual({ calculator: 'creditworthiness' });
    expect(understandCalculatorOpen('open break even')).toEqual({ calculator: 'break_even' });
    expect(understandCalculatorOpen('ابغى حاسبة العايد')).toEqual({ calculator: 'roi' });
  });

  test('understands incomplete sentences that are just the calculator name', () => {
    expect(understandCalculatorOpen('القرض')).toEqual({ calculator: 'loan' });
    expect(understandCalculatorOpen('التدفق النقدي')).toEqual({ calculator: 'cash_flow' });
    expect(understandCalculatorOpen('break even')).toEqual({ calculator: 'break_even' });
  });

  test('does not hijack math commands, how-to questions, or explanations', () => {
    expect(understandCalculatorOpen('احسب 2+2')).toBeNull();
    expect(understandCalculatorOpen('كيف استخدم حاسبة القرض')).toBeNull();
    expect(understandCalculatorOpen('كيف احسب القسط')).toBeNull();
    expect(understandCalculatorOpen('ابي افهم القرض')).toBeNull();
    expect(understandCalculatorOpen('اشرحلي الجدارة الائتمانية')).toBeNull();
  });

  test('does not treat questions about calculator topics as open requests', () => {
    expect(understandCalculatorOpen('وش الفرق بين القرض والتمويل')).toBeNull();
    expect(understandCalculatorOpen('ما هي الجدارة الائتمانية')).toBeNull();
    expect(understandCalculatorOpen('هل حاسبة القرض دقيقة')).toBeNull();
    expect(calculatorNeedsClarification('وش الفرق بين القرض والتمويل')).toBe(false);
  });

  test('asks for clarification when two calculators tie or only context exists', () => {
    expect(calculatorNeedsClarification('عايز احاسب')).toBe(true);
    expect(calculatorNeedsClarification('عايز حاسبة roi او قرض')).toBe(true);
    expect(calculatorNeedsClarification('ابغى اسلف')).toBe(false);
    expect(calculatorNeedsClarification('احسب 2+2')).toBe(false);
    expect(calculatorNeedsClarification('كيف استخدم حاسبة القرض')).toBe(false);
    expect(calculatorNeedsClarification('ابي افهم القرض')).toBe(false);
  });

  test('formats a bilingual clarification reply listing the calculators', () => {
    expect(formatCalculatorClarificationReply('ar')).toContain('حاسبة القرض');
    expect(formatCalculatorClarificationReply('en')).toContain('Loan');
  });
});

describe('resolveDeterministicTool with request understanding', () => {
  test('strict parser still wins on exact phrases', () => {
    expect(resolveDeterministicTool('افتح حاسبة القرض')).toEqual({
      action: 'calculator_open',
      input: { calculator: 'loan' }
    });
    expect(resolveDeterministicTool('احسب 2+2')).toEqual({
      action: 'math_calculate',
      input: { expression: '2+2' }
    });
  });

  test('opens the right calculator from dialect and incomplete phrasings', () => {
    expect(resolveDeterministicTool('ابغى اسلف واحسب القسط')).toEqual({
      action: 'calculator_open',
      input: { calculator: 'loan' }
    });
    expect(resolveDeterministicTool('عايز حاسبة الجدوى')).toEqual({
      action: 'calculator_open',
      input: { calculator: 'feasibility' }
    });
    expect(resolveDeterministicTool('القرض')).toEqual({
      action: 'calculator_open',
      input: { calculator: 'loan' }
    });
    expect(resolveDeterministicTool('جدوه')).toEqual({
      action: 'calculator_open',
      input: { calculator: 'feasibility' }
    });
  });

  test('keeps the merged clarification contract for generic calculator requests', () => {
    // Generic requests do not produce a plan; the orchestrator asks which one.
    expect(parseCalculatorOpen('فتح الحاسبة')).toBeNull();
    expect(calculatorOpenNeedsClarification('فتح الحاسبة')).toBe(true);
    expect(calculatorOpenNeedsClarification('الحاسبة')).toBe(true);
    expect(calculatorOpenNeedsClarification('open calculator')).toBe(true);
    // Dialect contexts without the literal word also ask instead of guessing.
    expect(resolveDeterministicTool('عايز احاسب')).toBeNull();
    expect(calculatorOpenNeedsClarification('عايز احاسب')).toBe(true);
    expect(resolveDeterministicTool('عايز حاسبة roi او قرض')).toBeNull();
    expect(calculatorOpenNeedsClarification('عايز حاسبة roi او قرض')).toBe(true);
    // And do not interfere with specific or non-open intents.
    expect(calculatorOpenNeedsClarification('افتح حاسبة القرض')).toBe(false);
    expect(calculatorOpenNeedsClarification('كيف أستخدم الحاسبة؟')).toBe(false);
    expect(calculatorOpenNeedsClarification('احسب 2+2')).toBe(false);
  });

  test('leaves questions and explanations outside the deterministic tools', () => {
    expect(resolveDeterministicTool('وش الفرق بين القرض والتمويل')).toBeNull();
    expect(resolveDeterministicTool('ابي افهم القرض')).toBeNull();
    expect(resolveDeterministicTool('هل حاسبة القرض دقيقة')).toBeNull();
    expect(resolveDeterministicTool('كيف استخدم حاسبة القرض')).toEqual({
      action: 'site_navigate',
      input: { target: 'calculator_loan' }
    });
  });
});
