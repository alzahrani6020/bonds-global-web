'use strict';

const { getCapability } = require('../capabilities/bonds-capability-registry');

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const MATH_COMMAND = /^(?:احسب|احسبي|احسبوا|calculate|compute)(?:\s|$)/iu;
const HOW_TO_PREFIX = /^(?:كيف|كيفية|how)(?:\s|$)/iu;
const OPEN_VERB = /^(?:افتح|افتحي|open)(?:\s|$)/iu;
const CALCULATOR_WORD = /(?:حاسبة|calculator)/iu;

const CALCULATOR_ALIASES = Object.freeze([
  { key: 'loan', pattern: /قرض|loan/i },
  { key: 'break_even', pattern: /تعادل|break[\s-]?even/i },
  { key: 'roi', pattern: /عائد|roi/i },
  { key: 'cash_flow', pattern: /(?:تدفق|سيولة)|cash[\s-]?flow/i },
  { key: 'restaurant', pattern: /مطعم|restaurant/i },
  { key: 'creditworthiness', pattern: /جدارة|ائتمان|creditworthiness/i },
  { key: 'feasibility', pattern: /جدوى|feasibility/i }
]);

const CALCULATOR_LABELS = Object.freeze({
  loan: { ar: 'حاسبة القرض', en: 'Loan calculator' },
  break_even: { ar: 'حاسبة نقطة التعادل', en: 'Break-even calculator' },
  roi: { ar: 'حاسبة العائد', en: 'ROI calculator' },
  cash_flow: { ar: 'حاسبة التدفق النقدي', en: 'Cash-flow calculator' },
  feasibility: { ar: 'حاسبة الجدوى', en: 'Feasibility calculator' },
  restaurant: { ar: 'حاسبة المطعم', en: 'Restaurant calculator' },
  creditworthiness: { ar: 'حاسبة الجدارة الائتمانية', en: 'Creditworthiness calculator' }
});

function cleanText(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function easternToAscii(value) {
  return String(value || '').replace(/[٠-٩]/g, digit => String(EASTERN_DIGITS.indexOf(digit)));
}

function parseMagnitude(value) {
  const text = easternToAscii(cleanText(value, 80))
    .replace(/,/g, '')
    .replace(/^(?:ال)/, '')
    .replace(/^(?:a|one)\s+/i, '');
  if (!text) return NaN;
  if (/^(?:مليون|million)$/i.test(text)) return 1000000;
  if (/^(?:الف|ألف|thousand)$/i.test(text)) return 1000;

  const match = text.match(/^([\d.]+)\s*(مليون|million|ألف|الف|thousand)?$/i);
  if (!match) {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return NaN;
  if (match[2] && /مليون|million/i.test(match[2])) return amount * 1000000;
  if (match[2] && /ألف|الف|thousand/i.test(match[2])) return amount * 1000;
  return amount;
}

function parseMathCommand(text) {
  const raw = cleanText(text, 240);
  if (!MATH_COMMAND.test(raw) || HOW_TO_PREFIX.test(raw)) return null;

  const rest = easternToAscii(
    raw.replace(/^(?:احسب|احسبي|احسبوا|calculate|compute)\s+(?:لي|لنا|من فضلك|please|for me)?\s*/iu, '')
  ).replace(/٪/g, '%').trim();
  if (!rest) return null;

  const percentOf = rest.match(
    /^([\d.]+)\s*(?:%|بالمئة|بالمائة|في\s*المئة|percent)\s*(?:من|of)\s+(.+)$/iu
  );
  if (percentOf) {
    const percent = Number(percentOf[1]);
    const base = parseMagnitude(percentOf[2]);
    if (Number.isFinite(percent) && Number.isFinite(base)) {
      return { expression: `(${base}) * (${percent} / 100)` };
    }
  }

  const arithmetic = rest
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '');
  if (!/^[\d.\s+\-*/()]+$/.test(arithmetic)) return null;

  return { expression: arithmetic.replace(/\s+/g, '') };
}

function parseCalculatorOpen(text) {
  const raw = cleanText(text, 240);
  if (!raw || HOW_TO_PREFIX.test(raw) || MATH_COMMAND.test(raw)) return null;
  if (!OPEN_VERB.test(raw) && !CALCULATOR_WORD.test(raw)) return null;
  if (OPEN_VERB.test(raw) && !CALCULATOR_WORD.test(raw)) return null;

  const match = CALCULATOR_ALIASES.find(item => item.pattern.test(raw));
  return match ? { calculator: match.key } : null;
}

function mathCommandNeedsClarification(text) {
  const raw = cleanText(text, 240);
  if (!MATH_COMMAND.test(raw) || HOW_TO_PREFIX.test(raw)) return false;
  return !parseMathCommand(raw);
}

function resolveDeterministicTool(text) {
  const calculator = parseCalculatorOpen(text);
  if (calculator && getCapability('calculator_open')) {
    return {
      action: 'calculator_open',
      input: calculator
    };
  }

  const math = parseMathCommand(text);
  if (math && getCapability('math_calculate')) {
    return {
      action: 'math_calculate',
      input: math
    };
  }

  return null;
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return String(value || '');
  const numeric = Number(value);
  if (Number.isInteger(numeric)) return String(numeric);
  return String(Number(numeric.toPrecision(12)));
}

function calculatorLabel(key, language) {
  const labels = CALCULATOR_LABELS[key];
  if (!labels) return key;
  return language === 'en' ? labels.en : labels.ar;
}

function formatMathClarificationReply(language) {
  return language === 'en'
    ? 'I can calculate this when you send a clear expression, for example: 18% of 1000000 or 2+2.'
    : 'يمكنني الحساب عندما ترسل عبارة واضحة، مثل: 18 بالمئة من مليون أو 2+2.';
}

function formatDeterministicToolReply(plan, execution, language) {
  const arabic = language !== 'en';
  const ok = execution?.ok === true;

  if (plan?.action === 'math_calculate') {
    if (!ok) return arabic ? 'تعذر إكمال الحساب.' : 'The calculation could not be completed.';
    return arabic
      ? `الناتج: ${formatNumber(execution.result?.value)}`
      : `Result: ${formatNumber(execution.result?.value)}`;
  }

  if (plan?.action === 'calculator_open') {
    if (!ok) return arabic ? 'تعذر فتح الحاسبة المطلوبة.' : 'The requested calculator could not be opened.';
    const key = execution.result?.calculator || plan.input?.calculator;
    const route = execution.result?.navigation?.route || '';
    const label = calculatorLabel(key, arabic ? 'ar' : 'en');
    return route ? `${label}\n${route}` : label;
  }

  return arabic ? 'تعذر تشغيل الأداة.' : 'The tool could not be run.';
}

function calculatorNavigationAction(execution) {
  if (execution?.ok !== true) return null;
  const target = String(execution.result?.navigation?.target || '').trim();
  if (!target) return null;
  return {
    type: 'site_navigate',
    capability: 'site_navigate',
    target,
    risk: 'low'
  };
}

module.exports = {
  MATH_COMMAND,
  parseMathCommand,
  parseCalculatorOpen,
  mathCommandNeedsClarification,
  resolveDeterministicTool,
  formatDeterministicToolReply,
  formatMathClarificationReply,
  calculatorLabel,
  calculatorNavigationAction
};
