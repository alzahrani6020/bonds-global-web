'use strict';

const {
  parseSpokenNumber,
  parseStatementBuild,
  buildIdentityStatements
} = require('../../lib/assistant/identity-statements');
const { resolveDeterministicTool } = require('../../lib/assistant/deterministic-tools');

describe('identity statement builder', () => {
  test('parses Arabic spoken magnitudes used in budget requests', () => {
    expect(parseSpokenNumber('عشرة مليون')).toBe(10000000);
    expect(parseSpokenNumber('عشره مليون')).toBe(10000000);
    expect(parseSpokenNumber('سبع مئة الف')).toBe(700000);
    expect(parseSpokenNumber('سبع مئة ألف')).toBe(700000);
    expect(parseSpokenNumber('10 مليون')).toBe(10000000);
    expect(parseSpokenNumber('700 ألف')).toBe(700000);
  });

  test('parses a build-statements command with given revenue and profit', () => {
    expect(parseStatementBuild(
      'اعمل لي ميزانية قائمة مركز مالي ودخل وتدفقات ايرادات عشرة مليون وربح سبع مئة الف ولوزن الباقي كمتراكم مناسب'
    )).toEqual({
      revenue: 10000000,
      profit: 700000
    });
  });

  test('does not steal how-to or feasibility requests', () => {
    expect(parseStatementBuild('كيف اعمل ميزانية')).toBeNull();
    expect(parseStatementBuild('اعمل دراسة جدوى للمشروع')).toBeNull();
    expect(parseStatementBuild('افتح صفحة الميزانية')).toBeNull();
  });

  test('builds identity-closed statements without inventing extra P&L lines', () => {
    const built = buildIdentityStatements({ revenue: 10000000, profit: 700000 }, 'ar');
    expect(built.expenses).toBe(9300000);
    expect(built.reply).toContain('مساعد بوندز');
    expect(built.reply).not.toMatch(/نموذج لغوي/);
    expect(built.ui).toHaveLength(3);
    expect(built.ui[0].title).toBe('قائمة الدخل');
    expect(built.ui[0].items.join('\n')).toContain('10,000,000');
    expect(built.ui[0].items.join('\n')).toContain('9,300,000');
    expect(built.ui[0].items.join('\n')).toContain('700,000');
  });

  test('resolves the user screenshot command as a local statement tool', () => {
    expect(resolveDeterministicTool(
      'اعمل لي ميزانية قائمة مركز مالي ودخل وتدفقات ايرادات عشرة مليون وربح سبع مئة الف ولوزن الباقي كمتراكم مناسب'
    )).toEqual({
      action: 'statement_build',
      input: { revenue: 10000000, profit: 700000 }
    });
    expect(resolveDeterministicTool(
      'اعمل لي ميزانية قائمة مركز مالي ودخل وتدفقات ايرادات عشره مليون وربح سبع مئة الف واوزن الباقي كمتراه مناسب'
    )).toEqual({
      action: 'statement_build',
      input: { revenue: 10000000, profit: 700000 }
    });
  });
});
