'use strict';

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const BUILD_VERB = /^(?:اعمل|أعمل|انشئ|أنشئ|أنشى|جهز|ابن|ابني|كوّن|كون|build|create|prepare|make)(?:\s|$)/iu;
const HOW_TO_PREFIX = /^(?:كيف|كيفية|how)(?:\s|$)/iu;
const STATEMENT_WORD = /ميزانية|قوائم|مركز مالي|ميزانية عمومية|دخل|تدفقات|income statement|balance sheet|cash[\s-]?flow/i;
const FEASIBILITY_WORD = /جدوى|feasibility/i;
const ACTUAL_ACCOUNTING_WORD = /(?:فعلي(?:ة|ه)?|الحقيقي(?:ة)?|دفتر\s*(?:ال)?أستاذ|دفتر\s*(?:ال)?استاذ|posted\s+ledger|actual)/iu;
const ONES = Object.freeze({
  صفر: 0,
  واحد: 1,
  واحدة: 1,
  اثنان: 2,
  اثنين: 2,
  ثلاث: 3,
  ثلاثة: 3,
  اربع: 4,
  أربع: 4,
  أربعة: 4,
  خمس: 5,
  خمسة: 5,
  ست: 6,
  ستة: 6,
  سبع: 7,
  سبعة: 7,
  ثمان: 8,
  ثمانية: 8,
  تسع: 9,
  تسعة: 9,
  عشر: 10,
  عشرة: 10,
  عشره: 10
});
const SCALES = Object.freeze({
  مئة: 100,
  مائه: 100,
  مائة: 100,
  ألف: 1000,
  الف: 1000,
  مليون: 1000000
});

function cleanText(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function easternToAscii(value) {
  return String(value || '').replace(/[٠-٩]/g, digit => String(EASTERN_DIGITS.indexOf(digit)));
}

function expandCompoundArabic(value) {
  return String(value || '')
    .replace(/سبعمائة|سبعمائه/g, 'سبع مئة')
    .replace(/ستمائة|ستمائه/g, 'ست مئة')
    .replace(/خمسمائة|خمسمائه/g, 'خمس مئة')
    .replace(/اربعمائة|أربعمائة|اربعمائه|أربعمائه/g, 'أربع مئة')
    .replace(/ثلاثمائة|ثلاثمائه/g, 'ثلاث مئة')
    .replace(/مائتين|مئتين/g, 'مئتين');
}

function parseSpokenNumber(value) {
  const raw = expandCompoundArabic(easternToAscii(cleanText(value, 80)))
    .replace(/,/g, '')
    .replace(/(^|\s)و(\s|$)/g, ' ')
    .replace(/ملايين/g, 'مليون')
    .replace(/آلاف|الاف/g, 'ألف');
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;

  const magnitude = raw.match(/^([\d.]+)\s*(مليون|ألف|الف|thousand|million)?$/i);
  if (magnitude) {
    const amount = Number(magnitude[1]);
    if (!Number.isFinite(amount)) return null;
    if (magnitude[2] && /مليون|million/i.test(magnitude[2])) return amount * 1000000;
    if (magnitude[2] && /ألف|الف|thousand/i.test(magnitude[2])) return amount * 1000;
    return amount;
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let seen = false;
  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(ONES, token)) {
      current += ONES[token];
      seen = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(SCALES, token)) {
      if (current === 0) current = 1;
      current *= SCALES[token];
      if (SCALES[token] >= 1000) {
        total += current;
        current = 0;
      }
      seen = true;
      continue;
    }
    const digit = Number(token);
    if (Number.isFinite(digit)) {
      current += digit;
      seen = true;
      continue;
    }
    if (/[\u0600-\u06FF]/.test(token)) break;
  }
  const valueNumber = total + current;
  return seen && Number.isFinite(valueNumber) && valueNumber > 0 ? valueNumber : null;
}

const AMOUNT_STOP = '\\s+و(?:ال)?(?:أ|ا)?رباح|\\s+و(?:ال)?ربح|\\s+و(?:صافي|إيراد|ايراد|revenue|profit)';
const REVENUE_KEYWORD = 'إيرادات?|ايرادات?|revenues?';
const PROFIT_KEYWORD = 'صافي(?:\\s+ال)?ربح|(?:ال)?(?:أ|ا)?رباح|ربح|profit|net\\s+income';

function extractAmountAfter(raw, keyword) {
  const match = raw.match(new RegExp(
    `(?:${keyword})\\s+(.+?)(?=${AMOUNT_STOP}|$)`,
    'i'
  ));
  if (!match) return null;
  return parseSpokenNumber(match[1]);
}

function parseStatementBuild(text) {
  const raw = cleanText(text, 500);
  if (!raw || HOW_TO_PREFIX.test(raw) || FEASIBILITY_WORD.test(raw) || ACTUAL_ACCOUNTING_WORD.test(raw)) return null;
  if (!BUILD_VERB.test(raw) || !STATEMENT_WORD.test(raw)) return null;

  return {
    revenue: extractAmountAfter(raw, REVENUE_KEYWORD),
    profit: extractAmountAfter(raw, PROFIT_KEYWORD)
  };
}

function formatAmount(value) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function line(label, amount, source, language) {
  const sourceLabel = language === 'en'
    ? { given: 'given', derived: 'derived', assumption: 'assumption' }[source]
    : { given: 'معطى', derived: 'مشتق', assumption: 'افتراض' }[source];
  return `${label}: ${formatAmount(amount)} (${sourceLabel})`;
}

function buildIdentityStatements(input, language) {
  if (input?.revenue == null || input?.profit == null) return null;
  const revenue = Number(input.revenue);
  const profit = Number(input.profit);
  if (!Number.isFinite(revenue) || !Number.isFinite(profit) || revenue <= 0) return null;
  if (profit < 0 || profit >= revenue) return null;

  const expenses = revenue - profit;
  const arabic = language !== 'en';

  const incomeItems = [
    line(arabic ? 'الإيرادات' : 'Revenue', revenue, 'given', language),
    line(arabic ? 'المصروفات المتبقية' : 'Residual expenses', expenses, 'derived', language),
    line(arabic ? 'صافي الربح' : 'Net profit', profit, 'given', language)
  ];
  const cashItems = [
    line(arabic ? 'التدفق من التشغيل' : 'Operating cash flow', profit, 'assumption', language),
    line(arabic ? 'التدفق من الاستثمار' : 'Investing cash flow', 0, 'assumption', language),
    line(arabic ? 'التدفق من التمويل' : 'Financing cash flow', 0, 'assumption', language),
    line(arabic ? 'صافي التغير في النقد' : 'Net change in cash', profit, 'derived', language)
  ];
  const positionItems = [
    line(arabic ? 'النقد' : 'Cash', profit, 'derived', language),
    line(arabic ? 'إجمالي الأصول' : 'Total assets', profit, 'derived', language),
    line(arabic ? 'الأرباح المبقاة' : 'Retained earnings', profit, 'derived', language),
    line(arabic ? 'إجمالي حقوق الملكية' : 'Total equity', profit, 'derived', language)
  ];

  const reply = arabic
    ? [
        'أنا مساعد بوندز. بنيت مسودة القوائم من الأرقام التي أعطيتها كوكيل حسابي، ولم أتوقف عند الشرح.',
        `المعطى: إيرادات ${formatAmount(revenue)} وصافي ربح ${formatAmount(profit)}.`,
        `المشتق: المصروفات ${formatAmount(expenses)} لتغلق الربح المعطى. لم أختلق بنود تكلفة غير مذكورة.`,
        'التدفقات والمركز المالي افترضا أساسًا نقديًا وبداية فترة صفرًا، لأن رأس المال العامل والاندثار والأصول لم تُذكر.',
        'أرسل نسب تكلفة البضاعة أو بنود الأصول إذا أردت تفصيلاً أدق.'
      ].join('\n')
    : [
        'I built a draft of the statements from the numbers you gave, as the BONDS agent, not as a language model.',
        `Given: revenue ${formatAmount(revenue)} and net profit ${formatAmount(profit)}.`,
        `Derived: expenses ${formatAmount(expenses)} to close the given profit. No undisclosed cost lines were invented.`,
        'Cash flow and financial position assume a cash basis and a zero opening balance, because working capital, depreciation, and assets were not given.',
        'Send COGS ratios or asset lines if you want a more detailed draft.'
      ].join('\n');

  return {
    revenue,
    profit,
    expenses,
    reply,
    ui: [
      {
        type: 'result_card',
        title: arabic ? 'قائمة الدخل' : 'Income statement',
        items: incomeItems
      },
      {
        type: 'result_card',
        title: arabic ? 'قائمة التدفقات النقدية' : 'Cash flow statement',
        items: cashItems
      },
      {
        type: 'result_card',
        title: arabic ? 'قائمة المركز المالي' : 'Statement of financial position',
        items: positionItems
      }
    ]
  };
}

function formatStatementClarification(language) {
  return language === 'en'
    ? 'I can build the statements as soon as you give revenue and profit. Example: revenue 10 million and profit 700 thousand.'
    : 'يمكنني بناء القوائم عندما ترسل الإيرادات والربح. مثال: إيرادات عشرة مليون وربح سبع مئة ألف.';
}

module.exports = {
  parseSpokenNumber,
  parseStatementBuild,
  buildIdentityStatements,
  formatStatementClarification
};
