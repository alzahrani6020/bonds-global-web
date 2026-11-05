'use strict';

const {
  classifyAccount,
  parseTrialBalanceRows,
  looksLikeTrialBalance,
  buildStatementsFromTrialBalance,
  buildStatementsWorkbook
} = require('../../lib/assistant/trial-balance-statements');
const { runDeterministicLocalTools } = require('../../lib/assistant/universal-orchestrator');
const { parseDocumentBuffer } = require('../../lib/api/document-parser-core');
const XLSX = require('xlsx');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
    const file = buildStatementsWorkbook(built, 'ar');
    const workbook = XLSX.read(Buffer.from(file.base64, 'base64'), { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['الدخل', 'التدفقات', 'المركز', 'الحسابات', 'ملاحظات']);
    const cashFlow = XLSX.utils.sheet_to_json(workbook.Sheets['التدفقات'], { header: 1 });
    expect(cashFlow[2][1]).toBe('غير متوفر من الميزان');
    expect(cashFlow[2][1]).not.toBe(built.profit);
    const income = XLSX.utils.sheet_to_json(workbook.Sheets['الدخل'], { header: 1 });
    expect(income[1][1]).toBe(10900000);
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

  test('classifies prepaid, accumulated depreciation and bank accounts named after sales', () => {
    expect(classifyAccount('مصروفات مدفوعة مقدما')).toBe('asset');
    expect(classifyAccount('مجمع اهلاك سيارات')).toBe('asset');
    expect(classifyAccount('ذمم الموظفين - محمد')).toBe('asset');
    expect(classifyAccount('مورد الموردين')).toBe('liability');
    expect(classifyAccount('الارباح والخسائر ( سنوات سابقة )')).toBe('equity');
    expect(classifyAccount('مبيعات شبكة', '110203')).toBe('cash');
    expect(classifyAccount('ايرادات المبيعات', '410101')).toBe('revenue');
    expect(classifyAccount('عمولة مبيعات')).toBe('expense');
    expect(classifyAccount('مردود المبيعات')).toBe('contra_revenue');
    expect(classifyAccount('ضريبه القيمه المضافه للمبيعات')).toBe('liability');
    expect(classifyAccount('مخصص نهاية الخدمة للموظفين')).toBe('liability');
    expect(classifyAccount('عربون زبائن -- فرع جدة')).toBe('liability');
  });

  test('reads office trial-balance layout with title rows and closing مدين/دائن', async () => {
    const attachment = {
      document_id: 'doc-office-tb',
      filename: 'ميزان مراجعة خاص مكتب د-- طلال.xlsx',
      status: 'analyzed',
      extracted: {
        method: 'local',
        summary: 'تم استخراج 10 صفوف',
        rows: [
          ['', '', '', '', 'ميزان المراجعة'],
          ['', '', '', '', '01/01/2026  /  30/09/2026'],
          ['', '', '', '', '', '', '', ''],
          ['رقم الحساب', 'اسم الحساب', 'افتتاحي مدين', 'افتتاحي دائن', 'الحركة المدينة', 'الحركة الدائنة', 'مدين', 'دائن'],
          [110101, 'الصندوق الرئيسي', '', 451, '', 14262.05, '', 14713.05],
          [110203, 'مبيعات شبكة', 992002.33, '', 1592726.7, 559829.07, 2024899.96, ''],
          [410101, 'ايرادات المبيعات', '', '', '', 500000, '', 500000],
          [510101, 'تكلفة البضاعة المباعة', '', '', 200000, '', 200000, ''],
          [220101, 'رأس المال', '', 100000, '', '', '', 100000],
          ['', '', 1, 1, 1, 1, 714599.96, 614713.05]
        ]
      }
    };
    const rows = parseTrialBalanceRows(attachment.extracted);
    expect(rows.find(row => row.account_name === 'الصندوق الرئيسي')).toMatchObject({
      credit: 14713.05,
      debit: 0,
      type: 'cash'
    });
    expect(rows.find(row => row.account_name === 'مبيعات شبكة').type).toBe('cash');
    expect(rows.find(row => row.account_name === 'ايرادات المبيعات').credit).toBe(500000);
    expect(rows.some(row => !row.account_name)).toBe(false);

    const result = await runDeterministicLocalTools([
      { role: 'user', content: 'اعمل القوائم المالية' }
    ], { attachments: [attachment] }, {}, []);
    expect(result.planner).toBe('universal-v2-deterministic-trial-balance');
    expect(result.reply).toContain('500,000');
    expect(result.reply).toContain('200,000');
    expect(result.reply).not.toMatch(/تعذر قراءة صفوف/);
    expect(result.ui[1].items.join('\n')).toMatch(/غير متوفر من الميزان/);
  });
});

describe('spreadsheet sheet selection', () => {
  test('reads the trial-balance worksheet even if the first sheet is empty', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'ورقة1');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['', '', '', '', 'ميزان المراجعة'],
      ['رقم الحساب', 'اسم الحساب', 'افتتاحي مدين', 'افتتاحي دائن', 'الحركة المدينة', 'الحركة الدائنة', 'مدين', 'دائن'],
      [410101, 'ايرادات المبيعات', '', '', '', 5000, '', 5000]
    ]), 'ورقة2');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const extracted = await parseDocumentBuffer({
      buffer,
      mime: XLSX_MIME,
      filename: 'ميزان مراجعة.xlsx'
    });
    expect(extracted.sheet_name).toBe('ورقة2');
    const rows = parseTrialBalanceRows(extracted);
    expect(rows.find(row => row.account_name === 'ايرادات المبيعات').credit).toBe(5000);
  });
});
