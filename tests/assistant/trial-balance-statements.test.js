'use strict';

const {
  classifyAccount,
  parseTrialBalanceRows,
  looksLikeTrialBalance,
  buildStatementsFromTrialBalance
} = require('../../lib/assistant/trial-balance-statements');
const { runDeterministicLocalTools } = require('../../lib/assistant/universal-orchestrator');

const BALANCED_EXCERPT = [
  'Account\tDebit\tCredit',
  'Cash\t1000000\t0',
  'Sales\t0\t10900000',
  'Operating expenses\t10000000\t0',
  'Capital\t0\t100000'
].join('\n');

const BALANCED_ATTACHMENT = Object.freeze({
  document_id: 'doc-tb-balanced',
  filename: 'ميزان مراجعة.xlsx',
  status: 'analyzed',
  extracted: {
    method: 'local',
    summary: 'تم استخراج 5 صفوف',
    text_excerpt: BALANCED_EXCERPT,
    rows_count: 5
  }
});

describe('trial balance statement builder', () => {
  test('classifies Arabic and English account names without guessing leftovers', () => {
    expect(classifyAccount('تكلفة المبيعات')).toBe('expense');
    expect(classifyAccount('إيرادات المبيعات')).toBe('revenue');
    expect(classifyAccount('النقد في الصندوق')).toBe('cash');
    expect(classifyAccount('رأس المال')).toBe('equity');
    expect(classifyAccount('بند غير معروف')).toBeNull();
  });

  test('parses Arabic حساب/مدين/دائن headers', () => {
    const rows = parseTrialBalanceRows({
      text_excerpt: 'الحساب\tمدين\tدائن\nإيرادات المبيعات\t0\t5000\nتكلفة المبيعات\t2000\t0'
    });
    expect(rows.find(row => row.type === 'revenue').credit).toBe(5000);
    expect(rows.find(row => row.type === 'expense').debit).toBe(2000);
  });

  test('parses debit and credit columns from a TSV excerpt', () => {
    const rows = parseTrialBalanceRows({ text_excerpt: BALANCED_EXCERPT });
    expect(rows).toHaveLength(4);
    expect(rows.find(row => row.account_name === 'Sales')).toMatchObject({
      credit: 10900000,
      debit: 0,
      type: 'revenue'
    });
  });

  test('builds income and position from the file and does not invent cash-flow movements', () => {
    const built = buildStatementsFromTrialBalance([BALANCED_ATTACHMENT], 'ar');
    expect(built.revenue).toBe(10900000);
    expect(built.expenses).toBe(10000000);
    expect(built.profit).toBe(900000);
    expect(built.cash).toBe(1000000);
    expect(built.assets).toBe(1000000);
    expect(built.equity).toBe(1000000);
    expect(built.trial_difference).toBe(0);
    expect(built.accounting_difference).toBe(0);
    expect(built.reply).toContain('ميزان مراجعة.xlsx');
    expect(built.reply).toContain('لم أختلق');
    expect(built.reply).not.toMatch(/التدفق من التشغيل: 900,000/);
    expect(built.ui[1].items.join('\n')).toMatch(/غير متوفر من الميزان/);
    expect(looksLikeTrialBalance(BALANCED_ATTACHMENT)).toBe(true);
  });

  test('does not plug a balancing figure when the file is incomplete', () => {
    const built = buildStatementsFromTrialBalance([{
      document_id: 'doc-sales-only',
      filename: 'trial-balance.xlsx',
      status: 'analyzed',
      extracted: {
        text_excerpt: 'Account\tDebit\tCredit\nSales\t0\t10900000'
      }
    }], 'ar');
    expect(built.revenue).toBe(10900000);
    expect(built.profit).toBe(10900000);
    expect(built.accounting_difference).not.toBe(0);
    expect(built.reply).toContain('فرق المعادلة');
  });

  test('orchestrator uses the uploaded trial balance instead of asking to paste amounts', async () => {
    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'أرسلت لك ميزان المراجعة اعمل القوائم' }
    ], { attachments: [BALANCED_ATTACHMENT] }, {}, []);
    expect(result.planner).toBe('universal-v2-deterministic-trial-balance');
    expect(result.ui).toHaveLength(3);
    expect(result.reply).toContain('900,000');
    expect(result.reply).not.toMatch(/لم يتم تزويدي/);
  });

  test('load-only path still acknowledges without building statements', async () => {
    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'حمله من "C:\\Users\\vip\\Downloads\\ميزان مراجعة.xlsx"' }
    ], { attachments: [BALANCED_ATTACHMENT] }, {}, []);
    expect(result.planner).toBe('universal-v2-deterministic-local-disk');
    expect(result.ui).toBeUndefined();
  });
});
