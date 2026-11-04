'use strict';

const { parseNumeric } = require('../finance/financial-data-intake');

const MAX_PARSE_ROWS = 400;
const MAX_UNMAPPED = 12;

const HEADER_ACCOUNT = /حساب|account|اسم|البيان|description|particular/i;
const HEADER_DEBIT = /مدين|debit|\bdr\b/i;
const HEADER_CREDIT = /دائن|credit|\bcr\b/i;
const SKIP_NAME = /^(?:اجمالي|المجموع|مجموع|total|totals|grand total|ميزان(?:\s*ال)?مراجعه|trial\s*balance)$/i;
const TRIAL_HINT = /ميزان(?:\s*(?:ال)?)?مراجعة|trial[\s_-]*balance|مدين|دائن|\bdebit\b|\bcredit\b/i;

const CLASSIFIERS = Object.freeze([
  { type: 'expense', patterns: [
    /تكلفه\s*(?:البضاعه|المبيعات|الايراد)/,
    /cost of (?:goods|sales)/i,
    /مصروفات?/,
    /مصروف/,
    /\bexpenses?\b/i,
    /\bcogs\b/i,
    /رواتب|اجور|اهلاك|استهلاك|ايجار/,
    /salaries|wages|depreciation|rent|utilities/i
  ] },
  { type: 'contra_revenue', patterns: [/مردودات|مسموحات|sales\s+returns?|allowances/i] },
  { type: 'revenue', patterns: [/ايرادات?|مبيعات|\brevenues?\b|\bsales\b|\bincome\b/i] },
  { type: 'cash', patterns: [/نقد(?:يه)?|صندوق|بنك|مصرف|\bcash\b|\bbank\b/i] },
  { type: 'asset', patterns: [
    /اصول|مدينون|ذمم\s*مدينه|مخزون|عقارات|اثاث|معدات|سيارات|مشروعات/,
    /receivable|inventory|prepaid|equipment|furniture|vehicle|asset/i
  ] },
  { type: 'liability', patterns: [
    /التزامات|خصوم|دائنون|ذمم\s*دائنه|قروض|مستحقات/,
    /payable|liabilit|loan|accrual|deferred/i
  ] },
  { type: 'equity', patterns: [
    /راس\s*المال|حقوق\s*(?:ملكيه|الملكيه)|ارباح\s*مبقاه|خسائر\s*متراكمه|الاحتياطي/,
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
  if (row && typeof row === 'object') return Object.values(row);
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

function indexByPattern(row, pattern) {
  return cellsOf(row).findIndex(cell => pattern.test(String(cell || '')));
}

function classifyAccount(name) {
  const normalized = normalizeLabel(name);
  if (!normalized || SKIP_NAME.test(normalized)) return null;
  for (const rule of CLASSIFIERS) {
    if (rule.patterns.some(pattern => pattern.test(normalized))) return rule.type;
  }
  return null;
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
  if (rows.length >= 2 && looksLikeHeader(rows[0])) return true;
  return false;
}

function parseTrialBalanceRows(extracted) {
  const table = rowsFromExtracted(extracted);
  if (!table.length) return [];
  let start = 0;
  let nameIndex = 0;
  let debitIndex = 1;
  let creditIndex = 2;
  if (looksLikeHeader(table[0])) {
    const header = cellsOf(table[0]);
    const named = indexByPattern(header, HEADER_ACCOUNT);
    const debit = indexByPattern(header, HEADER_DEBIT);
    const credit = indexByPattern(header, HEADER_CREDIT);
    if (named >= 0) nameIndex = named;
    if (debit >= 0) debitIndex = debit;
    if (credit >= 0) creditIndex = credit;
    start = 1;
  }

  const parsed = [];
  for (const raw of table.slice(start)) {
    const cells = cellsOf(raw);
    const name = String(cells[nameIndex] || '').trim();
    if (!name || SKIP_NAME.test(normalizeLabel(name))) continue;
    const debit = parseNumeric(cells[debitIndex]);
    const credit = parseNumeric(cells[creditIndex]);
    if (debit == null && credit == null) continue;
    parsed.push({
      account_name: name.slice(0, 240),
      debit: money(debit || 0),
      credit: money(credit || 0),
      type: classifyAccount(name)
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
    reply,
    ui: [
      { type: 'result_card', title: arabic ? 'قائمة الدخل' : 'Income statement', items: incomeItems },
      { type: 'result_card', title: arabic ? 'قائمة التدفقات النقدية' : 'Cash flow statement', items: cashItems },
      { type: 'result_card', title: arabic ? 'قائمة المركز المالي' : 'Statement of financial position', items: positionItems }
    ]
  };
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
  formatTrialBalanceUnreadable
};
