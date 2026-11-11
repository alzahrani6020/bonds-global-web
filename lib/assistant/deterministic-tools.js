'use strict';

const { getCapability } = require('../capabilities/bonds-capability-registry');
const navigationRegistry = require('./navigation-registry.json');
const { parseStatementBuild } = require('./identity-statements');

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const MATH_COMMAND = /^(?:احسب|احسبي|احسبوا|calculate|compute)(?:\s|$)/iu;
const HOW_TO_PREFIX = /^(?:كيف|كيفية|how)(?:\s|$)/iu;
const PAGE_USE_PREFIX = /^(?:كيف\s+(?:استخدم|أستخدم)|كيفية\s+استخدام|how\s+(?:do|can)\s+i\s+use)(?:\s|$)/iu;
const OPEN_VERB = /^(?:افتح|افتحي|open)(?:\s|$)/iu;
const CALCULATOR_WORD = /(?:حاسبة|calculator)/iu;
const HERE_QUESTION = /^(?:ما الموجود\s*هنا|ما الموجود|ما هذه الصفحة|ما هذه|ماذا هنا|وين أنا|أين أنا|what(?:'s| is) (?:here|this page)|describe this page)[؟?!.]*$/iu;

const CALCULATOR_ALIASES = Object.freeze([
  { key: 'loan', pattern: /قرض|تمويل|loan|financ/i },
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

const PAGE_ALIASES = Object.freeze([
  { target: 'deal_workspace', pattern: /مساحة\s*الصفقات|إدارة\s*الصفقات|deal\s*workspace|deal\s*room|deals/i },
  { target: 'service_workspace', pattern: /(?:مساحة\s*(?:العمل|الخدمة)|مساحة\s*عمل\s*الخدمة|service\s*workspace|workspace)/i },
  { target: 'city_intelligence', pattern: /ذكاء\s*المدن|ذكاء\s*المدينة|مؤشرات\s*المدينة|مؤشرات\s*المدن|city\s*intelligence|city\s*indicators/i },
  { target: 'budgeting', pattern: /ميزانية|موازن|budgeting|\bbudget\b/i },
  { target: 'funding_readiness', pattern: /جاهزية|readiness/i },
  { target: 'funding_sources', pattern: /مصادر|sources/i },
  { target: 'funding', pattern: /تمويل|funding/i },
  { target: 'calculator_loan', pattern: /قرض|loan/i },
  { target: 'calculator_break_even', pattern: /تعادل|break[\s-]?even/i },
  { target: 'calculator_roi', pattern: /عائد|\broi\b/i },
  { target: 'calculator_cash_flow', pattern: /تدفق|سيولة|cash[\s-]?flow/i },
  { target: 'calculator_feasibility', pattern: /جدوى|feasibility/i },
  { target: 'calculator_restaurant', pattern: /مطعم|restaurant/i },
  { target: 'calculator_creditworthiness', pattern: /جدارة|ائتمان|creditworthiness/i }
]);

const PAGE_LABELS = Object.freeze({
  deal_workspace: { ar: 'مساحة الصفقات', en: 'Deal workspace' },
  service_workspace: { ar: 'مساحة عمل الخدمة', en: 'Service workspace' },
  city_intelligence: { ar: 'مؤشرات المدينة', en: 'City indicators' },
  budgeting: { ar: 'الميزانيات والموازنات', en: 'Budgeting & forecasting' },
  funding: { ar: 'مركز التمويل', en: 'Funding hub' },
  funding_readiness: { ar: 'جاهزية التمويل', en: 'Funding readiness' },
  funding_sources: { ar: 'مصادر التمويل', en: 'Funding sources' },
  calculator_loan: { ar: 'حاسبة القرض', en: 'Loan calculator' },
  calculator_break_even: { ar: 'حاسبة نقطة التعادل', en: 'Break-even calculator' },
  calculator_roi: { ar: 'حاسبة العائد', en: 'ROI calculator' },
  calculator_cash_flow: { ar: 'حاسبة التدفق النقدي', en: 'Cash-flow calculator' },
  calculator_feasibility: { ar: 'حاسبة الجدوى', en: 'Feasibility calculator' },
  calculator_restaurant: { ar: 'حاسبة المطعم', en: 'Restaurant calculator' },
  calculator_creditworthiness: { ar: 'حاسبة الجدارة الائتمانية', en: 'Creditworthiness calculator' }
});

const PAGE_SUMMARIES = Object.freeze({
  deal_workspace: {
    ar: 'أنت الآن في مساحة الصفقات لإدارة ملف الصفقة والأطراف والمهام والفحص وغرفة البيانات.',
    en: 'You are in the deal workspace for the deal record, parties, tasks, due diligence, and data room.'
  },
  service_workspace: {
    ar: 'أنت الآن في مساحة عمل الخدمة المرتبطة بالخدمة الحالية.',
    en: 'You are in the workspace for the current service.'
  },
  city_intelligence: {
    ar: 'أنت الآن في مؤشرات المدينة: تحليل المدن والأحياء والمؤشرات لقرار الاستثمار.',
    en: 'You are on City indicators: city, district and indicator analysis for investment decisions.'
  },
  budgeting: {
    ar: 'أنت الآن في صفحة إعداد الميزانيات والموازنات والتوقعات المالية.',
    en: 'You are on the budgeting and forecasting page.'
  },
  funding: {
    ar: 'أنت الآن في مركز التمويل: الجاهزية، المصادر، واستخراج التمويل.',
    en: 'You are on the funding hub: readiness, sources, and extraction.'
  },
  calculator_loan: {
    ar: 'أنت الآن في حاسبة القرض والتمويل. تحسب الأقساط والفائدة وجدول الاستهلاك.',
    en: 'You are on the loan calculator. It computes installments, interest, and amortization.'
  },
  calculator_cash_flow: {
    ar: 'أنت الآن في حاسبة التدفق النقدي.',
    en: 'You are on the cash-flow calculator.'
  },
  calculator_feasibility: {
    ar: 'أنت الآن في حاسبة الجدوى.',
    en: 'You are on the feasibility calculator.'
  },
  calculator_break_even: {
    ar: 'أنت الآن في حاسبة نقطة التعادل.',
    en: 'You are on the break-even calculator.'
  },
  calculator_roi: {
    ar: 'أنت الآن في حاسبة العائد على الاستثمار.',
    en: 'You are on the ROI calculator.'
  },
  calculator_restaurant: {
    ar: 'أنت الآن في حاسبة المطعم.',
    en: 'You are on the restaurant calculator.'
  },
  calculator_creditworthiness: {
    ar: 'أنت الآن في حاسبة الجدارة الائتمانية.',
    en: 'You are on the creditworthiness calculator.'
  }
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

function parseHereQuestion(text) {
  return HERE_QUESTION.test(cleanText(text, 240));
}

function parsePageOpen(text) {
  const raw = cleanText(text, 240);
  if (!raw || HOW_TO_PREFIX.test(raw) || MATH_COMMAND.test(raw)) return null;
  if (!OPEN_VERB.test(raw)) return null;

  const rest = raw
    .replace(OPEN_VERB, '')
    .replace(/^(?:صفحة|الصفحة|page)\s+/iu, '')
    .trim();
  if (!rest) return null;

  const match = PAGE_ALIASES.find(item => item.pattern.test(rest) || item.pattern.test(raw));
  if (!match) return null;
  if (!navigationRegistry.destinations[match.target]) return null;
  return { target: match.target };
}

function parsePageUse(text) {
  const raw = cleanText(text, 240);
  if (!raw || !PAGE_USE_PREFIX.test(raw) || MATH_COMMAND.test(raw)) return null;

  const rest = raw
    .replace(PAGE_USE_PREFIX, '')
    .replace(/^(?:صفحة|الصفحة|page)\s+/iu, '')
    .trim();
  if (!rest) return null;

  const match = PAGE_ALIASES.find(item => item.pattern.test(rest) || item.pattern.test(raw));
  if (!match) return null;
  if (!navigationRegistry.destinations[match.target]) return null;
  return { target: match.target };
}

function mathCommandNeedsClarification(text) {
  const raw = cleanText(text, 240);
  if (!MATH_COMMAND.test(raw) || HOW_TO_PREFIX.test(raw)) return false;
  return !parseMathCommand(raw);
}

function resolveDeterministicTool(text) {
  const statements = parseStatementBuild(text);
  if (statements) {
    return {
      action: 'statement_build',
      input: statements
    };
  }

  const calculator = parseCalculatorOpen(text);
  if (calculator && getCapability('calculator_open')) {
    return {
      action: 'calculator_open',
      input: calculator
    };
  }

  const page = parsePageOpen(text) || parsePageUse(text);
  if (page && getCapability('site_navigate')) {
    return {
      action: 'site_navigate',
      input: page
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

  if (plan?.action === 'site_navigate') {
    if (!ok) return arabic ? 'تعذر فتح الصفحة المطلوبة.' : 'The requested page could not be opened.';
    const target = execution.result?.target || plan.input?.target;
    const route = execution.result?.route || '';
    const label = pageLabel(target, arabic ? 'ar' : 'en');
    return route ? `${label}\n${route}` : label;
  }

  return arabic ? 'تعذر تشغيل الأداة.' : 'The tool could not be run.';
}

function normalizePagePath(value) {
  return String(value || '')
    .split('#')[0]
    .split('?')[0]
    .replace(/\/index\.html$/i, '/')
    .replace(/\.html$/i, '')
    .replace(/\/+$/, '')
    || '/';
}

function pageLabel(target, language) {
  const labels = PAGE_LABELS[target];
  if (labels) return language === 'en' ? labels.en : labels.ar;
  return String(target || '').replace(/_/g, ' ');
}

function describeCurrentPage(context, language) {
  const arabic = language !== 'en';
  const path = normalizePagePath(context?.pagePath);
  const title = cleanText(context?.pageTitle, 180);
  const destinations = navigationRegistry.destinations || {};
  const found = Object.entries(destinations).find(([, entry]) => {
    const routes = Object.values(entry.routes || {});
    return routes.some(route => normalizePagePath(route) === path);
  });

  if (found) {
    const [target] = found;
    const summary = PAGE_SUMMARIES[target];
    if (summary) return arabic ? summary.ar : summary.en;
    return arabic
      ? `أنت الآن في صفحة ${pageLabel(target, 'ar')}.`
      : `You are on the ${pageLabel(target, 'en')} page.`;
  }

  if (title) {
    return arabic
      ? `أنت الآن في صفحة "${title.replace(/\s*\|\s*بوندز\s*$/i, '')}".`
      : `You are on "${title}".`;
  }

  if (path && path !== '/') {
    return arabic
      ? `أنت الآن في ${path}.`
      : `You are on ${path}.`;
  }

  return arabic
    ? 'أنت الآن في الصفحة الرئيسية لموقع بوندز.'
    : 'You are on the BONDS homepage.';
}

function formatHereReply(context, language) {
  return describeCurrentPage(context, language);
}

function calculatorNavigationAction(execution) {
  return navigationActionFromExecution(execution);
}

function navigationActionFromExecution(execution) {
  if (execution?.ok !== true) return null;
  const target = String(
    execution.result?.navigation?.target
    || execution.result?.target
    || ''
  ).trim();
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
  parsePageOpen,
  parsePageUse,
  parseHereQuestion,
  mathCommandNeedsClarification,
  resolveDeterministicTool,
  formatDeterministicToolReply,
  formatMathClarificationReply,
  formatHereReply,
  calculatorLabel,
  calculatorNavigationAction,
  navigationActionFromExecution
};
