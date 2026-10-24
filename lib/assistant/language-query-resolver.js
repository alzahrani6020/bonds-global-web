'use strict';

const { detectLanguage } = require('../media/language-engine');
const { detectIntent } = require('../intent/intent-engine');
const semantic = require('../semantic');

const MAX_QUERY_VARIANTS = 8;

function clean(value, max = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : '';
}

function normalizeArabicSearch(text) {
  return clean(text, 1000)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[“”"']/g, ' ')
    .replace(/[؟?!.,،:;؛()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForSearch(text, languageInfo = detectLanguage(text)) {
  const value = clean(text, 1000);
  if (!value) return '';
  const dominant = languageInfo?.dominant_language || languageInfo?.language;
  if (dominant === 'ar' || languageInfo?.language === 'mixed') {
    return normalizeArabicSearch(value);
  }
  return value
    .toLowerCase()
    .replace(/[“”"']/g, ' ')
    .replace(/[?!.,:;()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSearchCommand(text) {
  return clean(text, 1000)
    .replace(/^(?:ابحث|ابحثوا|بحث|فتش|دور\s+لي|دور\s+لنا|شوف\s+لي|شوف\s+لنا)(?:\s+(?:لي|لنا))?(?:\s+(?:في\s+)?(?:النت|الإنترنت|الانترنت|الويب))?\s+(?:عن\s+)?/i, '')
    .replace(/^(?:search|look\s+up|find\s+online)(?:\s+(?:the\s+web|online))?\s+(?:for\s+)?/i, '')
    .trim();
}

function extractEntity(text) {
  const value = clean(text, 1000);
  if (!value) return null;

  const patterns = [
    { type:'person', re:/^(?:من\s+(?:هو|هي))\s+(.+?)[؟?!.,،]*$/i },
    { type:'person', re:/^who\s+is\s+(.+?)[?!.]*$/i },
    { type:'company', re:/^(?:ما|ماذا)\s+(?:هي|عن)\s+(?:شركة|مؤسسة)\s+(.+?)[؟?!.,،]*$/i },
    { type:'company', re:/^(?:company|firm)\s+(.+?)[?!.]*$/i }
  ];

  for (const item of patterns) {
    const match = value.match(item.re);
    if (!match) continue;
    const entity = clean(match[1], 300);
    if (entity) return { type:item.type, text:entity, confidence:0.96 };
  }

  const stripped = stripSearchCommand(value);
  if (stripped && stripped !== value && stripped.split(/\s+/).length <= 12) {
    return { type:'topic', text:stripped, confidence:0.72 };
  }

  return null;
}

function classifyGeneralIntent(text) {
  const value = clean(text, 1000);
  const lower = value.toLowerCase();

  if (/^(?:من\s+(?:هو|هي))\s+\S+/i.test(value) || /^who\s+is\s+\S+/i.test(lower)) {
    return { intent:'person_lookup', confidence:0.98, requires_research:true };
  }
  if (/(?:^|\s)(?:ابحث|ابحثوا|بحث|فتش|دور\s+لي|دور\s+لنا|شوف\s+لي|شوف\s+لنا|search|look\s+up|find\s+online)(?:\s|$)/i.test(value)) {
    return { intent:'web_research', confidence:0.98, requires_research:true };
  }
  if (/(?:أحدث|احدث|آخر\s+الأخبار|اخر\s+الاخبار|اليوم|حالياً|حاليًا|latest|today|current|recent)(?:\s|$|[؟?،,.])/i.test(value)) {
    return { intent:'current_fact', confidence:0.94, requires_research:true };
  }
  if (/(?:قارن|مقارنة|compare|versus|\bvs\b)/i.test(value)) {
    return { intent:'comparison', confidence:0.86, requires_research:true };
  }
  if (/(?:شركة|مؤسسة|company|corporation|firm)/i.test(value) && /(?:من|ما|عن|معلومات|who|what|about)/i.test(value)) {
    return { intent:'company_lookup', confidence:0.82, requires_research:true };
  }
  if (/^(?:ما\s+(?:هو|هي)|ماذا\s+يعني|what\s+is|define)\s+\S+/i.test(value)) {
    return { intent:'definition', confidence:0.8, requires_research:false };
  }

  return { intent:'information', confidence:0.55, requires_research:false };
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const item = clean(value, 500);
    if (!item) continue;
    const key = normalizeArabicSearch(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= MAX_QUERY_VARIANTS) break;
  }
  return out;
}

function buildQueryVariants({ raw, normalized, entity, generalIntent, aliases = [] }) {
  const variants = [];
  const stripped = stripSearchCommand(raw);

  if (entity?.text) {
    variants.push(entity.text);
    if (entity.type === 'person') {
      variants.push(entity.text + ' سيرة');
      variants.push(entity.text + ' biography');
    } else if (entity.type === 'company') {
      variants.push(entity.text + ' official');
      variants.push(entity.text + ' about');
    }
  }

  if (stripped && stripped !== raw) variants.push(stripped);
  variants.push(...aliases);
  if (normalized && normalized !== raw) variants.push(normalized);
  variants.push(raw);

  if (generalIntent?.intent === 'current_fact' && entity?.text) {
    variants.unshift(entity.text + ' latest');
  }

  return unique(variants);
}

function resolveLanguageQuery(message, options = {}) {
  const raw = clean(message, 1000);
  const language = detectLanguage(raw);
  const normalized = normalizeForSearch(raw, language);
  const generalIntent = classifyGeneralIntent(raw);
  const entity = extractEntity(raw);
  const domainIntent = detectIntent(raw, options.context || {});
  const sector = semantic.resolveSector(raw);

  const queryVariants = buildQueryVariants({
    raw,
    normalized,
    entity,
    generalIntent,
    aliases: options.aliases || []
  });

  return {
    raw_text: raw,
    normalized_text: normalized,
    language,
    intent: generalIntent.intent,
    intent_confidence: generalIntent.confidence,
    requires_research: generalIntent.requires_research,
    entity,
    domain_intent: domainIntent ? {
      intent: domainIntent.intent,
      confidence: domainIntent.confidence
    } : null,
    sector: sector ? {
      sector: sector.sector,
      confidence: sector.confidence
    } : null,
    query_variants: queryVariants,
    selected_query: queryVariants[0] || raw,
    ambiguity: Boolean(entity && entity.confidence < 0.8),
    semantic_frame: {
      intent: generalIntent.intent,
      entity_type: entity?.type || null,
      entity: entity?.text || null,
      language: language?.dominant_language || language?.language || 'unknown',
      normalized_text: normalized
    }
  };
}

module.exports = {
  MAX_QUERY_VARIANTS,
  normalizeArabicSearch,
  normalizeForSearch,
  stripSearchCommand,
  extractEntity,
  classifyGeneralIntent,
  buildQueryVariants,
  resolveLanguageQuery
};
