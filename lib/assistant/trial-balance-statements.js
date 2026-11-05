'use strict';

const { parseNumeric } = require('../finance/financial-data-intake');

const MAX_PARSE_ROWS = 500;
const MAX_UNMAPPED = 12;
const HEADER_SCAN_ROWS = 25;

const HEADER_ACCOUNT = /حساب|account|اسم|البيان|description|particular/i;
const HEADER_DEBIT = /مدين|debit|\bdr\b/i;
const HEADER_CREDIT = /دائن|credit|\bcr\b/i;
const SKIP_NAME = /^(?:اجمالي|المجموع|مجموع|total|totals|grand total|ميزان(?:\s*ال)?مراجعه|trial\s*balance)$/i;
const TRIAL_HINT = /ميزان(?:\s*(?:ال)?)?مراجعة|trial[\s_-]*balance|مدين|دائن|\bdebit\b|\bcredit\b/i;
const ACCOUNT_CODE = /^\d{3,}$/;

const CLASSIFIERS = Object.freeze([
  { type: 'asset', patterns: [
    /مدفوع(?:ه)?\s*مقدما|prepaid/,
    /مجمع\s*(?:ال)?(?:اهلاك|استهلاك)|accumulated\s+depreciat/i
  ] },
  { type: 'expense', patterns: [
    /تكلفه\s*(?:البضاعه|المبيعات|الايراد)/,
    /cost of (?:goods|sales)/i,
    /مصروفات?/,
    /مصروف/,
    /عمول(?:ه|ات)/,
    /\bexpenses?\b/i,
    /\bcogs\b/i,
    /رواتب|اجور|اهلاك|استهلاك|ايجار/,
    /salaries|wages|depreciation|rent|utilities|commission/i
  ] },
  { type: 'contra_revenue', patterns: [/مردود(?:ات)?|مسموحات|sales\s+returns?|allowances/i] },
  { type: 'liability', patterns: [
    /(?:ضريبه|ضريبة).*(?:مبيعات|قيمه\s*مضافه)/,
    /vat/i
  ] },
  { type: 'revenue', patterns: [/ايرادات?|مبيعات|جزاءات|\brevenues?\b|\bsales\b|\bincome\b/i] },
  { type: 'cash', patterns: [/نقد(?:يه)?|صندوق|بنك|مصرف|\bcash\b|\bbank\b/i] },
  { type: 'asset', patterns: [
    /اصول|مدينون|ذمم\s*(?:الموظفين|العملاء|مدينه)|ذمم(?!\s*دائن)|مخزون|عقارات|اثاث|معدات|سيارات|مشروعات|سلف/,
    /receivable|inventory|prepaid|equipment|furniture|vehicle|asset/i
  ] },
  { type: 'liability', patterns: [
    /التزامات|خصوم|دائنون|ذمم\s*دائنه|قروض|مستحقات|مستحق|مورد|مخصص|عربون/,
    /تامين(?:ات)?\s*(?:زبائن|زباين|عملاء)/,
    /(?:ضريبه|ضريبة).*(?:مبيعات|قيمه\s*مضافه)|الهيئه\s*العامه\s*للزكاه|الزكاة/,
    /payable|liabilit|loan|accrual|deferred|supplier|provision|vat/i
  ] },
  { type: 'equity', patterns: [
    /راس\s*المال|حقوق\s*(?:ملكيه|الملكيه)|ارباح\s*مبقاه|خسائر\s*متراكمه|الاحتياطي|ارباح\s*و(?:ال)?خسائر/,
    /capital|equity|retained|reserve/i
  ] }
]);

function money(value) {
  const out = Number(value);
  if (!Number.isFinite(out)) return 0;
  return Math.round((out + Number.EPSILON) * 100) / 100;
}

function formatAmount(value) {
  return money(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function normalizeLabel(value) {
  return String(value ?? '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}

function cellsOf(row) {
  if (Array.isArray(row)) return row.map(cell => (cell == null ? '' : cell));
  if (row && typeof row === 'object') {
    const keys = Object.keys(row);
    if (keys.length && keys.every(key => /^\d+$/.test(key))) {
      const max = Math.max(...keys.map(Number));
      const out = Array(max + 1).fill('');
      for (const key of keys) out[Number(key)] = row[key] == null ? '' : row[key];
      return out;
    }
    return Object.values(row);
  }
  return [row];
}

function rowsFromExtracted(extracted) {
  if (!extracted || typeof extracted !== 'object') return [];
  if (Array.isArray(extracted.rows) && extracted.rows.length) {
    return extracted.rows.slice(0, MAX_PARSE_ROWS).map(cellsOf);
  }
  const text = String(extracted.text_excerpt || extracted.text || extracted.summary || '');
  if (!text.includes('\t') && !text.includes(',')) {
    return text.split(/\r?\n/).map(line => [line]).filter(row => String(row[0]).trim());
  }
  const delimiter = text.includes('\t') ? '\t' : ',';
  return text.split(/\r?\n/).slice(0, MAX_PARSE_ROWS).map(line => line.split(delimiter));
}

function looksLikeHeader(row) {
  const text = cellsOf(row).map(cell => String(cell)).join(' ');
  return HEADER_ACCOUNT.test(text) || (HEADER_DEBIT.test(text) && HEADER_CREDIT.test(text));
}

function bestIndex(row, scoreFn) {
  let index = -1;
  let score = 0;
  cellsOf(row).forEach((cell, i) => {
    const next = scoreFn(cell);
    if (next > score) {
      score = next;
      index = i;
    }
  });
  return { index, score };
}

function scoreNameHeader(cell) {
  const n = normalizeLabel(cell);
  if (!n) return 0;
  if (/رقم\s*الحساب|account\s*(?:no|code|number|#)/i.test(n)) return 0;
  if (/اسم\s*الحساب|account\s*name|^البيان$|^description$|^particulars?$/i.test(n)) return 8;
  if (/^الحساب$|^account$/i.test(n)) return 6;
  if (HEADER_ACCOUNT.test(String(cell))) return 2;
  return 0;
}

function scoreCodeHeader(cell) {
  const n = normalizeLabel(cell);
  if (/رقم\s*الحساب|account\s*(?:no|code|number|#)/i.test(n)) return 8;
  return 0;
}

function scoreBalanceHeader(cell, kind) {
  const n = normalizeLabel(cell);
  if (!n) return 0;
  const isDebit = kind === 'debit';
  const exact = isDebit
    ? /^(?:رصيد\s*)?مدين$|^debit$|^dr$/i
    : /^(?:رصيد\s*)?دائن$|^credit$|^cr$/i;
  const loose = isDebit ? HEADER_DEBIT : HEADER_CREDIT;
  if (/افتتاحي|opening|حرك|movement|period/i.test(n)) return loose.test(String(cell)) ? 2 : 0;
  if (exact.test(n)) return 8;
  if (loose.test(String(cell))) return 3;
  return 0;
}

function findColumnLayout(table) {
  let best = null;
  for (let i = 0; i < Math.min(HEADER_SCAN_ROWS, table.length); i++) {
    const row = table[i];
    const name = bestIndex(row, scoreNameHeader);
    const debit = bestIndex(row, cell => scoreBalanceHeader(cell, 'debit'));
    const credit = bestIndex(row, cell => scoreBalanceHeader(cell, 'credit'));
    const code = bestIndex(row, scoreCodeHeader);
    if (debit.score < 2 || credit.score < 2) continue;
    if (debit.index === credit.index) continue;
    const score = (name.score || 0) + debit.score + credit.score + (code.score ? 1 : 0);
    if (!best || score > best.score) {
      best = {
        headerIndex: i,
        nameIndex: name.score >= 2 ? name.index : 0,
        debitIndex: debit.index,
        creditIndex: credit.index,
        codeIndex: code.score >= 2 ? code.index : -1,
        score
      };
    }
  }
  return best;
}

function classifyByAccountCode(code) {
  const digits = String(code || '').replace(/\D/g, '');
  if (!digits) return null;
  if (/^11/.test(digits)) return 'cash';
  if (/^1/.test(digits)) return 'asset';
  if (/^21/.test(digits)) return 'liability';
  if (/^22/.test(digits) || /^3/.test(digits)) return 'equity';
  if (/^4/.test(digits)) return 'revenue';
  if (/^5/.test(digits)) return 'expense';
  return null;
}

function classifyAccount(name, code) {
  const normalized = normalizeLabel(name);
  if (!normalized || SKIP_NAME.test(normalized)) return null;
  let type = null;
  for (const rule of CLASSIFIERS) {
    if (rule.patterns.some(pattern => pattern.test(normalized))) {
      type = rule.type;
      break;
    }
  }
  const digits = String(code || '').replace(/\D/g, '');
  if (/^11/.test(digits) && (type === 'revenue' || type === 'contra_revenue' || type === 'expense' || !type)) {
    return 'cash';
  }
  return type || classifyByAccountCode(digits);
}

function resolveAccountName(cells, nameIndex, codeIndex) {
  let name = String(cells[nameIndex] || '').trim();
  let code = codeIndex >= 0 ? String(cells[codeIndex] || '').trim() : '';
  if (ACCOUNT_CODE.test(name)) {
    if (!code) code = name;
    const neighbor = nameIndex + 1 < cells.length ? String(cells[nameIndex + 1] || '').trim() : '';
    if (neighbor && !ACCOUNT_CODE.test(neighbor)) name = neighbor;
  }
  return { name, code };
}

function looksLikeTrialBalance(attachment) {
  if (!attachment || attachment.error) return false;
  const filename = String(attachment.filename || attachment.name || '');
  const extracted = attachment.extracted && typeof attachment.extracted === 'object' ? attachment.extracted : {};
  const classification = attachment.assistant_analysis?.classification?.type;
  if (classification === 'trial_balance') return true;
  if (TRIAL_HINT.test(filename)) return true;
  const excerpt = String(extracted.text_excerpt || extracted.text || extracted.summary || '');
  if (TRIAL_HINT.test(excerpt)) return true;
  const rows = rowsFromExtracted(extracted);
  if (rows.length >= 2 && (looksLikeHeader(rows[0]) || findColumnLayout(rows))) return true;
  return false;
}

function parseTrialBalanceRows(extracted) {
  const table = rowsFromExtracted(extracted);
  if (!table.length) return [];
  const layout = findColumnLayout(table);
  const nameIndex = layout ? layout.nameIndex : 0;
  const debitIndex = layout ? layout.debitIndex : 1;
  const creditIndex = layout ? layout.creditIndex : 2;
  const codeIndex = layout ? layout.codeIndex : -1;
  const start = layout ? layout.headerIndex + 1 : 0;

  const parsed = [];
  for (const raw of table.slice(start)) {
    const cells = cellsOf(raw);
    if (looksLikeHeader(cells)) continue;
    const resolved = resolveAccountName(cells, nameIndex, codeIndex);
    if (!resolved.name || SKIP_NAME.test(normalizeLabel(resolved.name))) continue;
    const debit = parseNumeric(cells[debitIndex]);
    const credit = parseNumeric(cells[creditIndex]);
    if (debit == null && credit == null) continue;
    parsed.push({
      account_name: resolved.name.slice(0, 240),
      account_code: resolved.code ? String(resolved.code).slice(0, 32) : null,
      debit: money(debit || 0),
      credit: money(credit || 0),
      type: classifyAccount(resolved.name, resolved.code)
    });
  }
  return parsed;
}

function signedBalance(row) {
  if (row.type === 'revenue' || row.type === 'liability' || row.type === 'equity') {
    return money(row.credit - row.debit);
  }
  return money(row.debit - row.credit);
}

function sumType(rows, type) {
  return money(rows.filter(row => row.type === type).reduce((sum, row) => sum + signedBalance(row), 0));
}

function buildFromParsed(rows, language, filename) {
  const classified = rows.filter(row => row.type);
  const unmapped = rows.filter(row => !row.type);
  if (!classified.length) return null;

  const revenue = money(sumType(classified, 'revenue') - sumType(classified, 'contra_revenue'));
  const expenses = sumType(classified, 'expense');
  const netIncome = money(revenue - expenses);
  const cash = sumType(classified, 'cash');
  const assets = money(sumType(classified, 'asset') + cash);
  const liabilities = sumType(classified, 'liability');
  const baseEquity = sumType(classified, 'equity');
  const equity = money(baseEquity + netIncome);
  const totalDebit = money(rows.reduce((sum, row) => sum + row.debit, 0));
  const totalCredit = money(rows.reduce((sum, row) => sum + row.credit, 0));
  const trialDifference = money(totalDebit - totalCredit);
  const accountingDifference = money(assets - liabilities - equity);
  const arabic = language !== 'en';
  const sourceFile = filename ? `«${filename}»` : (arabic ? 'المرفق' : 'the attachment');

  const given = arabic ? 'معطى' : 'given';
  const derived = arabic ? 'مشتق' : 'derived';
  const missing = arabic ? 'غير متوفر من الميزان' : 'not in the trial balance';

  const incomeItems = [
    `${arabic ? 'الإيرادات' : 'Revenue'}: ${formatAmount(revenue)} (${derived})`,
    `${arabic ? 'المصروفات' : 'Expenses'}: ${formatAmount(expenses)} (${derived})`,
    `${arabic ? 'صافي الربح' : 'Net profit'}: ${formatAmount(netIncome)} (${derived})`
  ];
  const cashItems = [
    cash
      ? `${arabic ? 'رصيد النقد' : 'Cash balance'}: ${formatAmount(cash)} (${given})`
      : `${arabic ? 'رصيد النقد' : 'Cash balance'}: ${missing}`,
    `${arabic ? 'التدفق من التشغيل' : 'Operating cash flow'}: ${missing}`,
    `${arabic ? 'التدفق من الاستثمار' : 'Investing cash flow'}: ${missing}`,
    `${arabic ? 'التدفق من التمويل' : 'Financing cash flow'}: ${missing}`
  ];
  const positionItems = [
    `${arabic ? 'إجمالي الأصول' : 'Total assets'}: ${formatAmount(assets)} (${derived})`,
    `${arabic ? 'إجمالي الالتزامات' : 'Total liabilities'}: ${formatAmount(liabilities)} (${derived})`,
    `${arabic ? 'حقوق الملكية قبل الربح' : 'Equity before profit'}: ${formatAmount(baseEquity)} (${derived})`,
    `${arabic ? 'إجمالي حقوق الملكية' : 'Total equity'}: ${formatAmount(equity)} (${derived})`
  ];

  const unmappedNames = unmapped.slice(0, MAX_UNMAPPED).map(row => row.account_name);
  const trialOk = Math.abs(trialDifference) <= 0.01;
  const equationOk = Math.abs(accountingDifference) <= 0.01 && unmapped.length === 0;

  const reply = arabic
    ? [
        `بنيت القوائم من ميزان المراجعة المرفوع ${sourceFile}. لم أختلق بنوداً غير موجودة في الملف.`,
        `الدخل: إيرادات ${formatAmount(revenue)}، مصروفات ${formatAmount(expenses)}، صافي ربح ${formatAmount(netIncome)}.`,
        `المركز: أصول ${formatAmount(assets)}، التزامات ${formatAmount(liabilities)}، حقوق ملكية ${formatAmount(equity)}.` +
          (equationOk ? ' معادلة الميزانية متزنة من البنود المصنفة.' : ` فرق المعادلة ${formatAmount(accountingDifference)} ولم أعدل الأرقام لإغلاقه.`),
        trialOk
          ? `الميزان متزن: مدين ${formatAmount(totalDebit)} ودائن ${formatAmount(totalCredit)}.`
          : `الميزان غير متزن في الملف: مدين ${formatAmount(totalDebit)} ودائن ${formatAmount(totalCredit)} والفرق ${formatAmount(trialDifference)}.`,
        'قائمة التدفقات تحتاج حركة الفترة. ميزان المراجعة أرصدة، لذلك لم أفترض تدفقاً تشغيلياً من الربح.',
        unmappedNames.length
          ? `بنود غير مصنفة (${unmapped.length}): ${unmappedNames.join('؛ ')}.`
          : 'صنفت كل البنود ذات الأرقام.'
      ].join('\n')
    : [
        `I built the statements from the uploaded trial balance ${sourceFile}. No missing lines were invented.`,
        `Income: revenue ${formatAmount(revenue)}, expenses ${formatAmount(expenses)}, net profit ${formatAmount(netIncome)}.`,
        `Position: assets ${formatAmount(assets)}, liabilities ${formatAmount(liabilities)}, equity ${formatAmount(equity)}.` +
          (equationOk ? ' The classified accounts close the accounting equation.' : ` Equation gap ${formatAmount(accountingDifference)}; I did not plug a balancing figure.`),
        trialOk
          ? `The trial balance foots: debit ${formatAmount(totalDebit)} and credit ${formatAmount(totalCredit)}.`
          : `The file does not foot: debit ${formatAmount(totalDebit)}, credit ${formatAmount(totalCredit)}, difference ${formatAmount(trialDifference)}.`,
        'A cash-flow statement needs period movements. A trial balance is balances only, so I did not assume operating cash flow equals profit.',
        unmappedNames.length
          ? `Unclassified lines (${unmapped.length}): ${unmappedNames.join('; ')}.`
          : 'Every numeric line was classified.'
      ].join('\n');

  return {
    source: 'trial_balance',
    filename: filename || null,
    revenue,
    expenses,
    profit: netIncome,
    cash,
    assets,
    liabilities,
    equity,
    trial_difference: trialDifference,
    accounting_difference: accountingDifference,
    unmapped_count: unmapped.length,
    accounts: rows.map(row => ({
      account_code: row.account_code || null,
      account_name: row.account_name,
      type: row.type,
      debit: row.debit,
      credit: row.credit
    })),
    reply,
    ui: [
      { type: 'result_card', title: arabic ? 'قائمة الدخل' : 'Income statement', items: incomeItems },
      { type: 'result_card', title: arabic ? 'قائمة التدفقات النقدية' : 'Cash flow statement', items: cashItems },
      { type: 'result_card', title: arabic ? 'قائمة المركز المالي' : 'Statement of financial position', items: positionItems }
    ]
  };
}

function sheetFromRows(rows) {
  const xlsx = require('xlsx');
  return xlsx.utils.aoa_to_sheet(rows);
}

function typeLabel(type, arabic) {
  const labels = {
    revenue: arabic ? 'إيراد' : 'Revenue',
    contra_revenue: arabic ? 'مقابل إيراد' : 'Contra revenue',
    expense: arabic ? 'مصروف' : 'Expense',
    cash: arabic ? 'نقد' : 'Cash',
    asset: arabic ? 'أصل' : 'Asset',
    liability: arabic ? 'التزام' : 'Liability',
    equity: arabic ? 'حقوق ملكية' : 'Equity'
  };
  return labels[type] || (arabic ? 'غير مصنف' : 'Unclassified');
}

function accountStatementLines(accounts, types, arabic) {
  const given = arabic ? 'معطى' : 'given';
  return (Array.isArray(accounts) ? accounts : [])
    .filter(row => types.includes(row.type))
    .map(row => [
      typeLabel(row.type, arabic),
      row.account_code || '',
      row.account_name,
      signedBalance(row),
      given
    ]);
}

function totalLine(label, amount, arabic) {
  return [label, '', '', amount, arabic ? 'مشتق' : 'derived'];
}

function statementsDownloadCard(file, autodownload) {
  if (!file) return null;
  return {
    type: 'download_file',
    title: file.filename,
    filename: file.filename,
    mime: file.mime,
    base64: file.base64,
    autodownload: autodownload === true
  };
}

function attachStatementsFile(built, language, { autodownload = false } = {}) {
  if (!built) return built;
  const file = buildStatementsWorkbook(built, language);
  const card = statementsDownloadCard(file, autodownload);
  if (!card) return built;
  const ready = autodownload
    ? formatStatementsFileReply(language, file.filename)
    : [built.reply, formatStatementsFileReady(language, file.filename)].filter(Boolean).join('\n');
  return {
    ...built,
    reply: ready,
    ui: [...(Array.isArray(built.ui) ? built.ui : []), card]
  };
}

function buildStatementsWorkbook(built, language = 'ar') {
  if (!built || typeof built !== 'object') return null;
  const xlsx = require('xlsx');
  const arabic = language !== 'en';
  const missing = arabic ? 'غير متوفر من الميزان' : 'not in the trial balance';
  const derived = arabic ? 'مشتق' : 'derived';
  const given = arabic ? 'معطى' : 'given';
  const accounts = Array.isArray(built.accounts) ? built.accounts : [];
  const headers = arabic
    ? ['القسم', 'رقم الحساب', 'الحساب', 'المبلغ', 'المصدر']
    : ['Section', 'Code', 'Account', 'Amount', 'Source'];
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheetFromRows([
    headers,
    ...accountStatementLines(accounts, ['revenue', 'contra_revenue'], arabic),
    totalLine(arabic ? 'إجمالي الإيرادات' : 'Total revenue', built.revenue, arabic),
    ...accountStatementLines(accounts, ['expense'], arabic),
    totalLine(arabic ? 'إجمالي المصروفات' : 'Total expenses', built.expenses, arabic),
    totalLine(arabic ? 'صافي الربح' : 'Net profit', built.profit, arabic)
  ]), arabic ? 'الدخل' : 'Income');
  xlsx.utils.book_append_sheet(workbook, sheetFromRows([
    headers,
    [arabic ? 'رصيد النقد' : 'Cash balance', '', '', built.cash || missing, built.cash ? given : missing],
    [arabic ? 'التدفق من التشغيل' : 'Operating cash flow', '', '', missing, missing],
    [arabic ? 'التدفق من الاستثمار' : 'Investing cash flow', '', '', missing, missing],
    [arabic ? 'التدفق من التمويل' : 'Financing cash flow', '', '', missing, missing]
  ]), arabic ? 'التدفقات' : 'CashFlow');
  xlsx.utils.book_append_sheet(workbook, sheetFromRows([
    headers,
    ...accountStatementLines(accounts, ['cash', 'asset'], arabic),
    totalLine(arabic ? 'إجمالي الأصول' : 'Total assets', built.assets, arabic),
    ...accountStatementLines(accounts, ['liability'], arabic),
    totalLine(arabic ? 'إجمالي الالتزامات' : 'Total liabilities', built.liabilities, arabic),
    ...accountStatementLines(accounts, ['equity'], arabic),
    totalLine(arabic ? 'صافي ربح الفترة' : 'Period net profit', built.profit, arabic),
    totalLine(arabic ? 'إجمالي حقوق الملكية' : 'Total equity', built.equity, arabic)
  ]), arabic ? 'المركز' : 'Position');
  xlsx.utils.book_append_sheet(workbook, sheetFromRows([
    [arabic ? 'رقم الحساب' : 'Code', arabic ? 'اسم الحساب' : 'Account', arabic ? 'التصنيف' : 'Type', arabic ? 'مدين' : 'Debit', arabic ? 'دائن' : 'Credit'],
    ...accounts.slice(0, MAX_PARSE_ROWS).map(row => [
      row.account_code || '',
      row.account_name,
      row.type || '',
      row.debit,
      row.credit
    ])
  ]), arabic ? 'الحسابات' : 'Accounts');
  xlsx.utils.book_append_sheet(workbook, sheetFromRows([
    [arabic ? 'ملاحظة' : 'Note', arabic ? 'القيمة' : 'Value'],
    [arabic ? 'ملف المصدر' : 'Source file', built.filename || ''],
    [arabic ? 'فرق الميزان' : 'Trial difference', built.trial_difference],
    [arabic ? 'فرق المعادلة' : 'Equation gap', built.accounting_difference],
    [arabic ? 'بنود غير مصنفة' : 'Unclassified lines', built.unmapped_count],
    [arabic ? 'التدفقات' : 'Cash flow', missing]
  ]), arabic ? 'ملاحظات' : 'Notes');
  const bytes = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  if (!Buffer.isBuffer(bytes) || !bytes.length) return null;
  return {
    filename: 'bonds-statements.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: bytes.toString('base64')
  };
}

function formatStatementsFileReady(language, filename) {
  const name = filename || 'bonds-statements.xlsx';
  return language === 'en'
    ? `The Excel file ${name} is ready on the card. I will not download it until you ask or click Download file.`
    : `ملف إكسل ${name} جاهز في البطاقة. لن أنزّله حتى تطلب احملها في ملف أو تضغط تنزيل الملف.`;
}

function formatStatementsFileReply(language, filename) {
  const name = filename || 'bonds-statements.xlsx';
  return language === 'en'
    ? `The Excel file ${name} is ready from the uploaded trial balance. Cash-flow movements are marked unavailable. Use Download file.`
    : `ملف إكسل ${name} جاهز من ميزان المراجعة المرفوع. حركات التدفق معلّمة بغير متوفر. التحميل من زر تنزيل الملف.`;
}

function formatStatementsFileMissing(language) {
  return language === 'en'
    ? 'Keep the trial-balance file attached, then ask me to put the statements in a file.'
    : 'أبقِ ميزان المراجعة مرفوعاً، ثم اكتب احملها في ملف.';
}

function selectTrialBalanceAttachment(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  return list.find(item => looksLikeTrialBalance(item) && item.extracted) ||
    list.find(item => item && !item.error && item.extracted) ||
    null;
}

function buildStatementsFromTrialBalance(attachments, language = 'ar') {
  const attachment = selectTrialBalanceAttachment(attachments);
  if (!attachment) return null;
  const rows = parseTrialBalanceRows(attachment.extracted);
  if (!rows.length) return null;
  return buildFromParsed(rows, language, attachment.filename || attachment.name || null);
}

function formatTrialBalanceUnreadable(language) {
  return language === 'en'
    ? 'The uploaded file is ready, but I could not read account/debit/credit rows from it. Send an xlsx trial balance with those columns.'
    : 'الملف المرفوع جاهز، لكن تعذر قراءة صفوف الحساب/مدين/دائن منه. أرسل ميزان مراجعة xlsx بهذه الأعمدة.';
}

module.exports = {
  looksLikeTrialBalance,
  parseTrialBalanceRows,
  classifyAccount,
  buildStatementsFromTrialBalance,
  buildStatementsWorkbook,
  attachStatementsFile,
  statementsDownloadCard,
  formatStatementsFileReady,
  formatStatementsFileReply,
  formatStatementsFileMissing,
  formatTrialBalanceUnreadable
};
