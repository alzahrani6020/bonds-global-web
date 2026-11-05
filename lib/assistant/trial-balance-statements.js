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
  { type: 'liability', patterns: [
    /مستحق(?:ه|ات)?/,
    /ايجار\s*مستحق/,
    /رواتب\s*مستحق/
  ] },
  { type: 'asset', patterns: [
    /تحسينات/,
    /leasehold|improvements/i
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
  const fromCode = classifyByAccountCode(digits);
  if (fromCode === 'asset' && type && type !== 'asset' && type !== 'cash') return 'asset';
  if (fromCode === 'cash' && type && type !== 'cash' && type !== 'asset') return 'cash';
  if (fromCode === 'liability' && type && type !== 'liability') return 'liability';
  if (fromCode === 'equity' && type && type !== 'equity') return 'equity';
  if (fromCode === 'revenue' && type === 'expense') return 'revenue';
  if (fromCode === 'expense' && (type === 'revenue' || type === 'asset' || type === 'cash')) return 'expense';
  return type || fromCode;
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

function isCogsAccount(row) {
  return /تكلفه\s*(?:البضاعه|المبيعات|الايراد)|cost of (?:goods|sales)|\bcogs\b/i.test(normalizeLabel(row.account_name));
}

function extractStatementMeta(extracted) {
  const table = rowsFromExtracted(extracted);
  const layout = findColumnLayout(table);
  const prelude = table
    .slice(0, layout ? layout.headerIndex : HEADER_SCAN_ROWS)
    .map(row => cellsOf(row).map(cell => String(cell || '').trim()).filter(Boolean).join(' '))
    .filter(Boolean);
  const joined = prelude.join(' | ');
  const period = joined.match(/(\d{1,2}[/.\\-]\d{1,2}[/.\\-]\d{2,4})\s*(?:\/|,|-|إلى|الى)\s*(\d{1,2}[/.\\-]\d{1,2}[/.\\-]\d{2,4})/);
  return {
    period_from: period ? period[1] : null,
    period_to: period ? period[2] : null
  };
}

function buildFromParsed(rows, language, filename, meta = {}) {
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

  const missing = arabic ? 'غير متوفر من الميزان' : 'not in the trial balance';
  const cogs = money(classified.filter(row => row.type === 'expense' && isCogsAccount(row)).reduce((sum, row) => sum + signedBalance(row), 0));
  const operatingExpenses = money(expenses - cogs);
  const grossProfit = money(revenue - cogs);
  const profitLabel = netIncome < 0
    ? (arabic ? 'صافي الخسارة' : 'Net loss')
    : (arabic ? 'صافي الربح' : 'Net profit');

  const incomeItems = [
    `${arabic ? 'إيرادات النشاط' : 'Operating revenue'}: ${formatAmount(revenue)}`,
    cogs ? `${arabic ? 'تكلفة الإيرادات' : 'Cost of revenue'}: ${formatAmount(cogs)}` : null,
    cogs ? `${arabic ? 'مجمل الربح' : 'Gross profit'}: ${formatAmount(grossProfit)}` : null,
    `${arabic ? 'المصروفات' : 'Expenses'}: ${formatAmount(cogs ? operatingExpenses : expenses)}`,
    `${profitLabel}: ${formatAmount(netIncome)}`
  ].filter(Boolean);
  const cashItems = [
    cash
      ? `${arabic ? 'النقد وما في حكمه' : 'Cash and cash equivalents'}: ${formatAmount(cash)}`
      : `${arabic ? 'النقد وما في حكمه' : 'Cash and cash equivalents'}: ${missing}`,
    `${arabic ? 'التدفقات من الأنشطة التشغيلية' : 'Cash from operating activities'}: ${missing}`,
    `${arabic ? 'التدفقات من الأنشطة الاستثمارية' : 'Cash from investing activities'}: ${missing}`,
    `${arabic ? 'التدفقات من الأنشطة التمويلية' : 'Cash from financing activities'}: ${missing}`
  ];
  const positionItems = [
    `${arabic ? 'إجمالي الأصول' : 'Total assets'}: ${formatAmount(assets)}`,
    `${arabic ? 'إجمالي الالتزامات' : 'Total liabilities'}: ${formatAmount(liabilities)}`,
    `${arabic ? 'حقوق الملكية' : 'Equity'}: ${formatAmount(equity)}`,
    `${arabic ? 'إجمالي الالتزامات وحقوق الملكية' : 'Total liabilities and equity'}: ${formatAmount(money(liabilities + equity))}`
  ];

  const unmappedNames = unmapped.slice(0, MAX_UNMAPPED).map(row => row.account_name);
  const trialOk = Math.abs(trialDifference) <= 0.01;
  const equationOk = Math.abs(accountingDifference) <= 0.01 && unmapped.length === 0;

  const reply = arabic
    ? [
        `بنيت القوائم من ميزان المراجعة المرفوع ${sourceFile}. لم أختلق بنوداً غير موجودة في الملف.`,
        `قائمة الدخل: إيرادات نشاط ${formatAmount(revenue)}، مصروفات ${formatAmount(expenses)}، ${profitLabel} ${formatAmount(netIncome)}.`,
        `الميزانية العمومية: أصول ${formatAmount(assets)}، التزامات ${formatAmount(liabilities)}، حقوق ملكية ${formatAmount(equity)}.` +
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
    period_from: meta.period_from || null,
    period_to: meta.period_to || null,
    revenue,
    expenses,
    cogs,
    gross_profit: grossProfit,
    operating_expenses: operatingExpenses,
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
      { type: 'result_card', title: arabic ? 'قائمة التدفقات النقدية' : 'Statement of cash flows', items: cashItems },
      { type: 'result_card', title: arabic ? 'الميزانية العمومية' : 'Statement of financial position', items: positionItems }
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
    contra_revenue: arabic ? 'مردود / مسموحات' : 'Contra revenue',
    expense: arabic ? 'مصروف' : 'Expense',
    cash: arabic ? 'نقد' : 'Cash',
    asset: arabic ? 'أصل' : 'Asset',
    liability: arabic ? 'التزام' : 'Liability',
    equity: arabic ? 'حقوق ملكية' : 'Equity'
  };
  return labels[type] || (arabic ? 'غير مصنف' : 'Unclassified');
}

function ofTypes(accounts, types) {
  return (Array.isArray(accounts) ? accounts : []).filter(row => types.includes(row.type));
}

function codeClass(row) {
  return String(row.account_code || '').replace(/\D/g, '');
}

function splitByHorizon(rows, currentPattern, noncurrentPattern) {
  const current = [];
  const noncurrent = [];
  const other = [];
  for (const row of rows) {
    const digits = codeClass(row);
    if (currentPattern.test(digits) || row.type === 'cash') current.push(row);
    else if (noncurrentPattern.test(digits)) noncurrent.push(row);
    else other.push(row);
  }
  return { current, noncurrent, other };
}

function periodCaption(built, arabic) {
  if (built.period_from && built.period_to) {
    return arabic
      ? `عن الفترة من ${built.period_from} إلى ${built.period_to}`
      : `For the period ${built.period_from} to ${built.period_to}`;
  }
  return arabic ? 'من أرصدة ميزان المراجعة المرفوع' : 'From the uploaded trial-balance balances';
}

function sourceCaption(built, arabic) {
  const name = built.filename ? `«${built.filename}»` : (arabic ? 'المرفق' : 'the attachment');
  return arabic ? `المصدر: ميزان المراجعة ${name}` : `Source: trial balance ${name}`;
}

function section(label) {
  return { label, section: true };
}

function item(label, amount) {
  return { label: `  ${label}`, amount };
}

function total(label, amount) {
  return { label, amount, total: true };
}

function noteLine(label, value) {
  return { label, amount: value };
}

function buildIncomePresentation(built, arabic) {
  const accounts = built.accounts || [];
  const revenues = ofTypes(accounts, ['revenue']);
  const contras = ofTypes(accounts, ['contra_revenue']);
  const expenses = ofTypes(accounts, ['expense']);
  const cogsRows = expenses.filter(isCogsAccount);
  const opexRows = expenses.filter(row => !isCogsAccount(row));
  const profitLabel = built.profit < 0
    ? (arabic ? 'صافي الخسارة' : 'Net loss')
    : (arabic ? 'صافي الربح' : 'Net profit');
  const lines = [section(arabic ? 'الإيرادات' : 'Revenue')];
  for (const row of revenues) lines.push(item(row.account_name, signedBalance(row)));
  for (const row of contras) lines.push(item(row.account_name, money(-signedBalance(row))));
  lines.push(total(arabic ? 'صافي الإيرادات' : 'Net revenue', built.revenue));
  if (cogsRows.length) {
    lines.push(section(arabic ? 'تكلفة الإيرادات' : 'Cost of revenue'));
    for (const row of cogsRows) lines.push(item(row.account_name, signedBalance(row)));
    lines.push(total(arabic ? 'إجمالي تكلفة الإيرادات' : 'Total cost of revenue', built.cogs));
    lines.push(total(arabic ? 'مجمل الربح' : 'Gross profit', built.gross_profit));
  }
  lines.push(section(arabic ? 'المصروفات' : 'Expenses'));
  for (const row of opexRows) lines.push(item(row.account_name, signedBalance(row)));
  lines.push(total(
    arabic ? 'إجمالي المصروفات' : 'Total expenses',
    cogsRows.length ? built.operating_expenses : built.expenses
  ));
  lines.push(total(profitLabel, built.profit));
  return {
    title: arabic ? 'قائمة الدخل' : 'Income statement',
    header: [
      arabic ? 'قائمة الدخل' : 'Income statement',
      periodCaption(built, arabic),
      sourceCaption(built, arabic)
    ],
    lines
  };
}

function buildPositionPresentation(built, arabic) {
  const accounts = built.accounts || [];
  const assetRows = [...ofTypes(accounts, ['cash']), ...ofTypes(accounts, ['asset'])];
  const liabilityRows = ofTypes(accounts, ['liability']);
  const equityRows = ofTypes(accounts, ['equity']);
  const assets = splitByHorizon(assetRows, /^11/, /^1[2-9]/);
  const liabilities = splitByHorizon(liabilityRows, /^21/, /^2[2-9]/);
  const useAssetSplit = assets.current.length && assets.noncurrent.length;
  const useLiabilitySplit = liabilities.current.length && liabilities.noncurrent.length;
  const lines = [];

  function addGroup(title, rows, totalLabel, totalAmount) {
    if (title) lines.push(section(title));
    for (const row of rows) lines.push(item(row.account_name, signedBalance(row)));
    if (totalLabel) lines.push(total(totalLabel, totalAmount));
  }

  if (useAssetSplit) {
    const currentTotal = money([...assets.current, ...assets.other.filter(row => row.type === 'cash')].reduce((sum, row) => sum + signedBalance(row), 0));
    const currentRows = [...assets.current, ...assets.other.filter(row => /^11/.test(codeClass(row)) || row.type === 'cash')];
    const noncurrentRows = [...assets.noncurrent, ...assets.other.filter(row => !currentRows.includes(row))];
    const noncurrentTotal = money(noncurrentRows.reduce((sum, row) => sum + signedBalance(row), 0));
    addGroup(
      arabic ? 'الأصول المتداولة' : 'Current assets',
      currentRows,
      arabic ? 'إجمالي الأصول المتداولة' : 'Total current assets',
      currentTotal
    );
    addGroup(
      arabic ? 'الأصول غير المتداولة' : 'Non-current assets',
      noncurrentRows,
      arabic ? 'إجمالي الأصول غير المتداولة' : 'Total non-current assets',
      noncurrentTotal
    );
  } else {
    addGroup(arabic ? 'الأصول' : 'Assets', assetRows);
  }
  lines.push(total(arabic ? 'إجمالي الأصول' : 'Total assets', built.assets));

  if (useLiabilitySplit) {
    addGroup(
      arabic ? 'الالتزامات المتداولة' : 'Current liabilities',
      [...liabilities.current, ...liabilities.other.filter(row => /^21/.test(codeClass(row)))],
      arabic ? 'إجمالي الالتزامات المتداولة' : 'Total current liabilities',
      money(liabilities.current.reduce((sum, row) => sum + signedBalance(row), 0))
    );
    addGroup(
      arabic ? 'الالتزامات غير المتداولة' : 'Non-current liabilities',
      [...liabilities.noncurrent, ...liabilities.other.filter(row => !/^21/.test(codeClass(row)))],
      arabic ? 'إجمالي الالتزامات غير المتداولة' : 'Total non-current liabilities',
      money(liabilities.noncurrent.reduce((sum, row) => sum + signedBalance(row), 0))
    );
  } else {
    addGroup(arabic ? 'الالتزامات' : 'Liabilities', liabilityRows);
  }
  lines.push(total(arabic ? 'إجمالي الالتزامات' : 'Total liabilities', built.liabilities));

  lines.push(section(arabic ? 'حقوق الملكية' : 'Equity'));
  for (const row of equityRows) lines.push(item(row.account_name, signedBalance(row)));
  lines.push(item(arabic ? 'صافي ربح (خسارة) الفترة' : 'Period profit (loss)', built.profit));
  lines.push(total(arabic ? 'إجمالي حقوق الملكية' : 'Total equity', built.equity));
  lines.push(total(
    arabic ? 'إجمالي الالتزامات وحقوق الملكية' : 'Total liabilities and equity',
    money((built.liabilities || 0) + (built.equity || 0))
  ));
  return {
    title: arabic ? 'الميزانية العمومية' : 'Statement of financial position',
    header: [
      arabic ? 'الميزانية العمومية' : 'Statement of financial position',
      periodCaption(built, arabic),
      sourceCaption(built, arabic)
    ],
    lines
  };
}

function buildCashFlowPresentation(built, arabic) {
  const missing = arabic ? 'غير متوفر من الميزان' : 'not in the trial balance';
  return {
    title: arabic ? 'قائمة التدفقات النقدية' : 'Statement of cash flows',
    header: [
      arabic ? 'قائمة التدفقات النقدية' : 'Statement of cash flows',
      periodCaption(built, arabic),
      sourceCaption(built, arabic)
    ],
    lines: [
      noteLine(
        arabic ? 'النقد وما في حكمه (رصيد ختامي)' : 'Cash and cash equivalents (closing balance)',
        built.cash || missing
      ),
      noteLine(arabic ? 'التدفقات من الأنشطة التشغيلية' : 'Cash from operating activities', missing),
      noteLine(arabic ? 'التدفقات من الأنشطة الاستثمارية' : 'Cash from investing activities', missing),
      noteLine(arabic ? 'التدفقات من الأنشطة التمويلية' : 'Cash from financing activities', missing),
      noteLine(
        arabic ? 'إيضاح' : 'Note',
        arabic
          ? 'ميزان المراجعة أرصدة ختامية وليس حركة الفترة، لذلك لم تُشتق التدفقات من الربح.'
          : 'A trial balance holds closing balances, not period movements, so cash flows were not derived from profit.'
      )
    ]
  };
}

function presentationToAoa(presentation, arabic) {
  const rows = presentation.header.map(line => [line]);
  rows.push([]);
  rows.push([arabic ? 'البيان' : 'Description', arabic ? 'المبلغ' : 'Amount']);
  for (const line of presentation.lines) {
    rows.push([line.label, line.amount == null ? '' : line.amount]);
  }
  return rows;
}

function decorateStatementSheet(sheet, arabic) {
  const xlsx = require('xlsx');
  if (arabic) sheet['!views'] = [{ RTL: true }];
  sheet['!cols'] = [{ wch: 58 }, { wch: 22 }];
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  const ref = sheet['!ref'];
  if (!ref) return sheet;
  const range = xlsx.utils.decode_range(ref);
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cell = sheet[xlsx.utils.encode_cell({ r, c: 1 })];
    if (cell && cell.t === 'n') cell.z = '#,##0.00';
  }
  return sheet;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPresentationAmount(amount) {
  if (amount == null || amount === '') return '';
  if (typeof amount === 'number') return formatAmount(amount);
  return String(amount);
}

function statementColumnHeaders(language) {
  return language === 'en'
    ? ['Description', 'Amount']
    : ['البيان', 'المبلغ'];
}

function buildStatementsHtml(built, language = 'ar') {
  if (!built || typeof built !== 'object') return null;
  const arabic = language !== 'en';
  const income = buildIncomePresentation(built, arabic);
  const position = buildPositionPresentation(built, arabic);
  const cash = buildCashFlowPresentation(built, arabic);
  const headers = statementColumnHeaders(language);
  const sectionHtml = (presentation) => {
    const body = presentation.lines.map(line => {
      const cls = line.section ? 'section' : (line.total ? 'total' : 'line');
      return `<tr class="${cls}"><td>${escapeHtml(line.label)}</td><td class="amt">${escapeHtml(formatPresentationAmount(line.amount))}</td></tr>`;
    }).join('');
    return `<section>
      <h1>${escapeHtml(presentation.title)}</h1>
      ${presentation.header.slice(1).map(line => `<p class="sub">${escapeHtml(line)}</p>`).join('')}
      <table>
        <thead><tr><th>${escapeHtml(headers[0])}</th><th>${escapeHtml(headers[1])}</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
  };
  return `<!DOCTYPE html>
<html lang="${arabic ? 'ar' : 'en'}" dir="${arabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${arabic ? 'القوائم المالية' : 'Financial statements'}</title>
  <style>
    body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; color: #0a0f1a; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    .sub { color: #445; margin: 0 0 4px; font-size: 13px; }
    section { margin-bottom: 32px; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 7px 8px; border-bottom: 1px solid #d7dbe3; vertical-align: top; }
    th { font-size: 12px; color: #445; text-align: inherit; }
    td.amt { width: 28%; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.section td { font-weight: 700; border-bottom: none; padding-top: 14px; }
    tr.total td { font-weight: 800; border-top: 2px solid #0a0f1a; border-bottom: 2px solid #0a0f1a; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  ${sectionHtml(income)}
  ${sectionHtml(position)}
  ${sectionHtml(cash)}
</body>
</html>`;
}

function buildStatementsWorkbook(built, language = 'ar') {
  if (!built || typeof built !== 'object') return null;
  const xlsx = require('xlsx');
  const arabic = language !== 'en';
  const missing = arabic ? 'غير متوفر من الميزان' : 'not in the trial balance';
  const accounts = Array.isArray(built.accounts) ? built.accounts : [];
  const workbook = xlsx.utils.book_new();
  const addPresentation = (presentation, name) => {
    const sheet = decorateStatementSheet(sheetFromRows(presentationToAoa(presentation, arabic)), arabic);
    xlsx.utils.book_append_sheet(workbook, sheet, name);
  };
  addPresentation(buildIncomePresentation(built, arabic), arabic ? 'قائمة الدخل' : 'Income');
  addPresentation(buildCashFlowPresentation(built, arabic), arabic ? 'التدفقات النقدية' : 'CashFlows');
  addPresentation(buildPositionPresentation(built, arabic), arabic ? 'الميزانية العمومية' : 'Position');
  const ledger = sheetFromRows([
    [arabic ? 'رقم الحساب' : 'Code', arabic ? 'اسم الحساب' : 'Account', arabic ? 'التصنيف' : 'Type', arabic ? 'مدين' : 'Debit', arabic ? 'دائن' : 'Credit'],
    ...accounts.slice(0, MAX_PARSE_ROWS).map(row => [
      row.account_code || '',
      row.account_name,
      typeLabel(row.type, arabic),
      row.debit,
      row.credit
    ])
  ]);
  ledger['!cols'] = [{ wch: 16 }, { wch: 48 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  if (arabic) ledger['!views'] = [{ RTL: true }];
  xlsx.utils.book_append_sheet(workbook, ledger, arabic ? 'دليل الحسابات' : 'Accounts');
  const notes = sheetFromRows([
    [arabic ? 'الإيضاح' : 'Note', arabic ? 'القيمة' : 'Value'],
    [arabic ? 'ملف المصدر' : 'Source file', built.filename || ''],
    [arabic ? 'الفترة' : 'Period', [built.period_from, built.period_to].filter(Boolean).join(' — ')],
    [arabic ? 'فرق الميزان' : 'Trial difference', built.trial_difference],
    [arabic ? 'فرق المعادلة' : 'Equation gap', built.accounting_difference],
    [arabic ? 'بنود غير مصنفة' : 'Unclassified lines', built.unmapped_count],
    [arabic ? 'التدفقات النقدية' : 'Cash flows', missing]
  ]);
  notes['!cols'] = [{ wch: 28 }, { wch: 48 }];
  if (arabic) notes['!views'] = [{ RTL: true }];
  xlsx.utils.book_append_sheet(workbook, notes, arabic ? 'إيضاحات' : 'Notes');
  const bytes = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  if (!Buffer.isBuffer(bytes) || !bytes.length) return null;
  return {
    filename: 'bonds-statements.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    base64: bytes.toString('base64')
  };
}

function htmlDownload(built, language) {
  const html = buildStatementsHtml(built, language);
  if (!html) return null;
  return {
    filename: 'bonds-statements.html',
    mime: 'text/html;charset=utf-8',
    base64: Buffer.from(html, 'utf8').toString('base64'),
    print_html: html
  };
}

function statementsDownloadCard(file, autodownload, extras = {}) {
  if (!file) return null;
  return {
    type: 'download_file',
    title: extras.title || file.filename,
    filename: file.filename,
    mime: file.mime,
    base64: file.base64,
    autodownload: autodownload === true,
    ...extras
  };
}

function attachStatementsFile(built, language, { autodownload = false, format = null } = {}) {
  if (!built) return built;
  const workbook = buildStatementsWorkbook(built, language);
  if (!workbook) return built;
  const htmlFile = htmlDownload(built, language);
  const arabic = language !== 'en';
  const files = [
    {
      label: arabic ? 'إكسل' : 'Excel',
      format: 'xlsx',
      filename: workbook.filename,
      mime: workbook.mime,
      base64: workbook.base64
    },
    htmlFile && {
      label: 'PDF',
      format: 'pdf',
      filename: 'bonds-statements.pdf',
      mime: 'text/html;charset=utf-8',
      print_html: htmlFile.print_html
    },
    htmlFile && {
      label: 'HTML',
      format: 'html',
      filename: htmlFile.filename,
      mime: htmlFile.mime,
      base64: htmlFile.base64
    }
  ].filter(Boolean).map(file => ({
    ...file,
    autodownload: autodownload === true && file.format === (format || 'xlsx')
  }));
  const preferred = files.find(file => file.format === (format || 'xlsx')) || files[0];
  const card = statementsDownloadCard(workbook, autodownload === true && Boolean(format), {
    title: arabic ? 'تنزيل القوائم المالية' : 'Download financial statements',
    body: arabic
      ? 'قائمة الدخل والميزانية العمومية من الميزان. اختر إكسل أو PDF أو HTML. حركات التدفق غير متوفرة من الميزان.'
      : 'Income statement and statement of financial position from the trial balance. Choose Excel, PDF, or HTML. Cash-flow movements are not in the trial balance.',
    files
  });
  const ready = autodownload && format
    ? formatStatementsFileReply(language, preferred.filename, format)
    : [built.reply, formatStatementsFileReady(language)].filter(Boolean).join('\n');
  return {
    ...built,
    reply: ready,
    ui: [card, ...(Array.isArray(built.ui) ? built.ui : [])]
  };
}

function formatStatementsFileReady(language) {
  return language === 'en'
    ? 'The statements are ready in conventional layout. Choose Excel, PDF, or HTML on the card; nothing downloads until you pick a format.'
    : 'القوائم جاهزة بصيغة قائمة الدخل والميزانية العمومية. اختر إكسل أو PDF أو HTML من البطاقة؛ لن يُنزَّل شيء حتى تختار الصيغة.';
}

function formatStatementsFileReply(language, filename, format) {
  const name = filename || 'bonds-statements.xlsx';
  if (format === 'pdf') {
    return language === 'en'
      ? 'PDF opens from the card for printing. Cash-flow movements stay marked unavailable.'
      : 'PDF للطباعة من زر PDF في البطاقة. حركات التدفق معلّمة بغير متوفر.';
  }
  if (format === 'html') {
    return language === 'en'
      ? `The HTML file ${name} is ready.`
      : `ملف HTML ${name} جاهز.`;
  }
  return language === 'en'
    ? `The Excel file ${name} is ready from the uploaded trial balance. Cash-flow movements are marked unavailable.`
    : `ملف إكسل ${name} جاهز من ميزان المراجعة المرفوع. حركات التدفق معلّمة بغير متوفر.`;
}

function formatStatementsFileMissing(language) {
  return language === 'en'
    ? 'Keep the trial-balance file attached, then ask me to raise the statements and pick Excel, PDF, or HTML.'
    : 'أبقِ ميزان المراجعة مرفوعاً، ثم اكتب ارفع القوائم لي واختر إكسل أو PDF أو HTML.';
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
  return buildFromParsed(
    rows,
    language,
    attachment.filename || attachment.name || null,
    extractStatementMeta(attachment.extracted)
  );
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
