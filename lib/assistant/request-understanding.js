'use strict';

/**
 * BONDS Request-Understanding Engine
 *
 * Deterministic Arabic utterance understanding for assistant actions.
 * Fills the gap between the strict literal parser (deterministic-tools.js)
 * and free chat: it normalizes dialect/typo variants, tolerates incomplete
 * sentences, and maps them to registered calculator actions. No LLM, no
 * hallucination — anything unclear becomes a clarification question.
 *
 * This module must stay dependency-free (deterministic-tools requires it).
 */

const EASTERN_DIGITS = '٠١٢٣٤٥٦٧٨٩';

// Verbs/particles of request and desire across major Arabic dialects. The
// strict parser only accepts the imperative "افتح/open"; users say "ابغى",
// "عايز", "ودي", "حاب", "ممكن", the masdar "فتح", or just the calculator name.
const REQUEST_MARKERS = Object.freeze([
  'ابغي', 'ابي', 'ابغى', 'بغيت', 'ابغاها', 'ابغاه',
  'عايز', 'عايزه', 'عاوز', 'عاوزه',
  'حاب', 'حابب', 'حابه', 'حابين',
  'ودي', 'ودني', 'وديه', 'وديها', 'نفسي',
  'اريد', 'اريدها', 'محتاج', 'محتاجه', 'محتاجين',
  'ممكن', 'لو سمحت', 'من فضلك',
  'خليني', 'خلني', 'خلنا',
  'افتح', 'افتحي', 'افتحوا', 'فتح', 'فتحها',
  'شغل', 'شغلي', 'شغلوا', 'شغلها',
  'وريني', 'ورينيها', 'اوريني', 'وروني',
  'اعطيني', 'اعطني', 'هات', 'هاتها', 'جيب', 'جيبلي', 'جيبها',
  'ابدأ', 'ابدء', 'ابداها', 'استخدم', 'اشتغل', 'اشتغلها',
  'ابشر', 'ياليت', 'يا ريت', 'ليت',
  'وين', 'فين', 'open', 'show', 'launch', 'start', 'give me', 'i want', 'need'
]);

// Explanations stay with the AI answer path; understanding only acts on
// requests ("ابي افهم القرض" must not navigate to the loan calculator).
const EXPLANATION_MARKERS = Object.freeze([
  'افهم', 'افهمها', 'اشرح', 'اشرحلي', 'اشرح لي', 'شرح', 'شرحها',
  'علمني', 'علمنا', 'تعلمني', 'ليش', 'ليه', 'لماذا', 'سبب',
  'explain', 'teach', 'learn', 'why', 'difference between', 'diffrence'
]);

// Calculator context without a specific type is detected by hasCalculatorWord
// plus the request/desire markers below.

const QUESTION_MARKERS = Object.freeze([
  'وش', 'ايش', 'شنو', 'شو', 'ليش', 'ليه', 'لماذا', 'لش',
  'هل', 'متي', 'كيف', 'وين', 'اين', 'كم', 'منو', 'مين', 'ايهما',
  'ما هو', 'ما هي', 'ما وظيفه', 'ما فايده', 'وشو', 'شلون',
  'how', 'what', 'why', 'when', 'where', 'which', 'who',
  'is', 'are', 'does', 'explain', 'meaning'
]);

const HOW_TO_PREFIX = /^(?:كيف|كيفية|شلون|how)(?:\s|$)/iu;
const PAGE_USE_PREFIX = /^(?:كيف\s+(?:استخدم|أستخدم)|كيفية\s+استخدام|how\s+(?:do|can)\s+i\s+use)(?:\s|$)/iu;
const MATH_COMMAND = /^(?:احسب|احسبي|احسبوا|calculate|compute)(?:\s|$)/iu;

// Registered calculator keys with dialect-rich keyword banks. Longer terms
// score higher so "نقطة التعادل" beats a bare "تعادل" overlap.
const CALCULATOR_KEYWORD_BANK = Object.freeze([
  { key: 'loan', terms: [
    'قرض', 'قروض', 'اقتراض', 'استلاف', 'استلف', 'اسلف', 'اسولف', 'سولف',
    'تسليف', 'تمويل', 'ممول', 'مولني', 'مولنيها',
    'قسط', 'اقساط', 'تقسيط', 'تقسط', 'قسطها',
    'loan', 'finance', 'financing', 'mortgage', 'installment', 'payment'
  ] },
  { key: 'break_even', terms: [
    'تعادل', 'نقطه التعادل', 'نقطة التعادل', 'تعادليه',
    'تغطيه التكاليف', 'تغطية التكاليف',
    'break even', 'breakeven', 'break-even'
  ] },
  { key: 'roi', terms: [
    'عائد', 'العائد', 'العايد', 'عوايد', 'عوائد', 'استرداد', 'استرداد راس المال',
    'ربحيه', 'هامش الربح', 'مردود',
    'roi', 'return', 'payback', 'profitability', 'margin'
  ] },
  { key: 'cash_flow', terms: [
    'تدفق', 'تدفقات', 'سيول', 'كاش فلو', 'كاشفلو',
    'مداخيل ومصاريف', 'مصاريف وايرادات', 'ايرادات ومصاريف',
    'cash flow', 'cashflow'
  ] },
  { key: 'restaurant', terms: [
    'مطعم', 'مطاعم', 'مطعمي', 'كافيه', 'كافيهات', 'كافتيريا', 'مقهي', 'مقاهي',
    'مطبخ', 'مطابخ', 'بوفيه',
    'restaurant', 'cafe', 'cafeteria', 'coffee'
  ] },
  { key: 'creditworthiness', terms: [
    'جدار', 'جدارتي', 'ائتمان', 'ائتمانيه', 'ائتمانية', 'الائتمان',
    'سكور', 'تقييم ائتماني', 'سداد مديونيه', 'سجل ائتماني',
    'creditworthiness', 'credit score'
  ] },
  { key: 'feasibility', terms: [
    'جدوي', 'جدوى', 'جدوه', 'جدوا', 'جدواها', 'دراسه جدوي', 'دراسة جدوى',
    'feasibility', 'feasibility study'
  ] }
]);

// Words that keep a short keyword-only utterance in "request" territory.
// "القرض" alone opens the loan calculator; "ما هو القرض" stays a question.
const BARE_NAME_WORD_LIMIT = 4;

function normalizeUtterance(value, max = 240) {
  return String(value || '')
    .slice(0, max)
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, digit => String(EASTERN_DIGITS.indexOf(digit)))
    .replace(/[^0-9a-z\u0600-\u06FF\s%٪/+.,؟?-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreCalculatorKeywords(text) {
  let bestKey = null;
  let bestScore = 0;
  let tied = false;
  for (const entry of CALCULATOR_KEYWORD_BANK) {
    let score = 0;
    for (const term of entry.terms) {
      if (text.includes(term)) score += term.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = entry.key;
      tied = false;
    } else if (score > 0 && score === bestScore && bestKey && entry.key !== bestKey) {
      tied = true;
    }
  }
  // A tie means the utterance names two calculators (e.g. "قرض او جدوى");
  // fall back to clarification instead of guessing.
  return tied ? { key: null, score: bestScore } : { key: bestKey, score: bestScore };
}

function hasCalculatorWord(text) {
  // Word-bounded so "المحاسبي"/"محاسبة" (accounting) never count as the
  // calculator; "الحاسبة"/"حاسبات"/"احاسب" do.
  return text.split(' ').filter(Boolean).some(word => {
    const stripped = word.startsWith('ال') ? word.slice(2) : word;
    return stripped.startsWith('حاسب') ||
      stripped.startsWith('احاسب') ||
      stripped.startsWith('calculate') ||
      stripped.startsWith('calc');
  });
}

function hasCalculationContext(text) {
  return hasCalculatorWord(text) ||
    REQUEST_MARKERS.some(marker => text.includes(marker));
}

function hasQuestionMarker(text) {
  // Short markers must match a whole word so "اهل"/"لاهلي" never counts as
  // the yes/no particle "هل"; longer phrases may match as substrings.
  const words = new Set(text.split(' ').filter(Boolean));
  for (const marker of QUESTION_MARKERS) {
    if (marker.length <= 3 && !marker.includes(' ')) {
      if (words.has(marker)) return true;
    } else if (text.includes(marker)) {
      return true;
    }
  }
  return false;
}

function hasExplanationMarker(text) {
  return EXPLANATION_MARKERS.some(marker => text.includes(marker));
}

/**
 * Understand a calculator-open request from free, dialect, or incomplete
 * Arabic/English text. Returns { calculator: <registered key> } or null.
 * Clarification cases are handled by calculatorNeedsClarification() so the
 * caller can ask "which calculator?" instead of staying silent.
 */
function understandCalculatorOpen(rawText) {
  const text = normalizeUtterance(rawText);
  if (!text) return null;
  // Ownership guards: math commands, how-to questions, and page-use questions
  // belong to other deterministic paths.
  if (MATH_COMMAND.test(text) || HOW_TO_PREFIX.test(text) || PAGE_USE_PREFIX.test(text)) {
    return null;
  }

  const { key } = scoreCalculatorKeywords(text);
  if (key && !hasQuestionMarker(text) && !hasExplanationMarker(text) && hasCalculationContext(text)) {
    return { calculator: key };
  }

  // Incomplete sentence: the bare calculator name by itself ("القرض",
  // "التدفق النقدي", "break even") — short, and not a question.
  if (key && !hasQuestionMarker(text) && !hasExplanationMarker(text)) {
    const wordCount = text.split(' ').filter(Boolean).length;
    if (wordCount <= BARE_NAME_WORD_LIMIT) {
      return { calculator: key };
    }
  }

  return null;
}

/**
 * True when the utterance is clearly about the calculators but names none,
 * so the assistant should list the registered calculators and ask which one.
 */
function calculatorNeedsClarification(rawText) {
  const text = normalizeUtterance(rawText);
  if (!text) return false;
  if (MATH_COMMAND.test(text) || HOW_TO_PREFIX.test(text) || PAGE_USE_PREFIX.test(text)) {
    return false;
  }
  if (hasExplanationMarker(text) || hasQuestionMarker(text)) return false;
  const { key, score } = scoreCalculatorKeywords(text);
  if (key) return false;
  if (score > 0) return true; // tied between two calculators — ask, don't guess
  return hasCalculatorWord(text);
}

function isQuestionOrExplanation(rawText) {
  const text = normalizeUtterance(rawText);
  if (!text) return false;
  // A trailing question mark settles ambiguous cases like
  // "ما متطلبات خدمة الجاهزية التمويلية؟" that no keyword list covers.
  if (/[؟?]\s*$/.test(text)) return true;
  return hasQuestionMarker(text) || hasExplanationMarker(text);
}

/**
 * True when the utterance names two calculators with equal confidence
 * ("عايز حاسبة roi او قرض") — the caller must ask, not pick one.
 */
function isAmbiguousCalculatorRequest(rawText) {
  const text = normalizeUtterance(rawText);
  if (!text) return false;
  if (MATH_COMMAND.test(text) || HOW_TO_PREFIX.test(text) || PAGE_USE_PREFIX.test(text)) {
    return false;
  }
  if (/[؟?]\s*$/.test(text) || hasExplanationMarker(text)) return false;
  const { key, score } = scoreCalculatorKeywords(text);
  return score > 0 && key === null;
}

function formatCalculatorClarificationReply(language) {
  return language === 'en'
    ? 'Sure — which calculator? Loan & financing, break-even, ROI, cash-flow, feasibility, restaurant, or creditworthiness. Name one and I will open it.'
    : 'أكيد — أي حاسبة تريد؟ حاسبة القرض والتمويل، نقطة التعادل، العائد على الاستثمار، التدفق النقدي، الجدوى، المطعم، أو الجدارة الائتمانية. اكتب اسمها وأفتحها لك.';
}

module.exports = {
  normalizeUtterance,
  understandCalculatorOpen,
  calculatorNeedsClarification,
  isQuestionOrExplanation,
  isAmbiguousCalculatorRequest,
  formatCalculatorClarificationReply,
  CALCULATOR_KEYWORD_BANK
};
