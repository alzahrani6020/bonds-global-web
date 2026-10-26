'use strict';

const { detectLanguage } = require('../media/language-engine');
const { detectIntent } = require('../intent/intent-engine');
const semantic = require('../semantic');
const { resolveEntityFrame } = require('../intelligence/entity-resolution');
const {
  buildPersonEntityFrame,
  hasPersonDescriptorSignals
} = require('./person-identity');

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

function stripOutputInstructions(text) {
  return clean(text, 1000)
    .replace(
      /(?:[،,;؛]\s*|\s+)(?:(?:و|ف|ثم)\s*)?(?:اذكر|أذكر|اعطني|أعطني|قدم|قدّم|اكتب|أدرج|ادرج|اعرض|أعرض|ارجع|أرجع|وفر|وفّر|ارفق|أرفق)(?=\s|$)[\s\S]*$/iu,
      ''
    )
    .replace(
      /(?:[,;]\s*|\s+)(?:and\s+|then\s+)?(?:mention|provide|return|give|include|show|list)\b[\s\S]*$/iu,
      ''
    )
    .trim();
}

function cleanExtractedEntity(type, value) {
  let entity = clean(value, 300);
  if (type === 'topic') entity = stripOutputInstructions(entity);
  if (type !== 'person') return entity;

  entity = entity
    .replace(/\s+[0-9٠-٩]+\s*$/u, '')
    .trim();

  const frame = buildPersonEntityFrame(entity);
  return frame?.canonical_name || entity;
}

function personEntityFromMention(value, confidence = 0.96) {
  const frame = buildPersonEntityFrame(value);
  if (!frame?.canonical_name) return null;
  return {
    type:'person',
    text:frame.canonical_name,
    confidence:Math.min(confidence, frame.confidence || confidence),
    person_entity_frame:frame
  };
}

function extractEntity(text) {
  const value = clean(text, 1000);
  if (!value) return null;

  const companyPatterns = [
    /^(?:\u0645\u0627|\u0645\u0627\u0630\u0627)\s+(?:\u0647\u064a|\u0639\u0646)\s+(?:\u0634\u0631\u0643\u0629|\u0645\u0624\u0633\u0633\u0629)\s+(.+?)[\u061f?!.,\u060c]*$/iu,
    /^(?:\u0645\u0639\u0644\u0648\u0645\u0627\u062a|\u0646\u0628\u0630\u0629)\s+\u0639\u0646\s+(?:\u0634\u0631\u0643\u0629|\u0645\u0624\u0633\u0633\u0629)\s+(.+?)[\u061f?!.,\u060c]*$/iu,
    /^(?:company|firm)\s+(.+?)[?!.]*$/i
  ];

  for (const re of companyPatterns) {
    const match = value.match(re);
    if (!match) continue;
    const entity = cleanExtractedEntity('company', match[1]);
    if (entity) return { type:'company', text:entity, confidence:0.98 };
  }

  const relationPatterns = [
    /^(?:من\s+(?:هو|هي))\s+(.+?)\s+((?:شركة|مؤسسة|بنك|مصرف|وزارة|هيئة|جامعة|صندوق|منظمة|مجلس|معهد|نادي|فريق)\s+.+?)[\u061f?!.,\u060c]*$/iu,
    /^who\s+is\s+(?:the\s+)?(.+?)\s+(?:of|at)\s+(.+?)[?!.]*$/i
  ];

  for (const re of relationPatterns) {
    const match = value.match(re);
    if (!match) continue;
    const relation = clean(match[1], 180);
    const organization = clean(match[2], 300);
    if (!relation || !organization) continue;
    return {
      type:'relation',
      text:organization,
      confidence:0.98,
      relation:{ type:'role_relation', value:relation, source:'user', verified:false },
      organization:{ value:organization, source:'user', verified:false }
    };
  }

  const personPatterns = [
    /^(?:\u0645\u0646\s+(?:\u0647\u0648|\u0647\u064a))\s+(.+?)[\u061f?!.,\u060c]*$/iu,
    /^who\s+is\s+(.+?)[?!.]*$/i,
    /^\u0645\u0646\s+([\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+){1,5})[\u061f?!.,\u060c]*$/iu,
    /^([\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+){1,5})\s+\u0645\u0646[\u061f?!.,\u060c]*$/iu,
    /^(?:\u0639\u0631\u0641\u0646\u064a|\u0639\u0631\u0651\u0641\u0646\u064a)\s+(?:\u0639\u0644\u0649|\u0639\u0646)\s+([\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+){1,5})[\u061f?!.,\u060c]*$/iu
  ];

  for (const re of personPatterns) {
    const match = value.match(re);
    if (!match) continue;
    const entity = personEntityFromMention(match[1], 0.96);
    if (entity) return entity;
  }

  const topicPatterns = [
    /^(?:\u0645\u0639\u0644\u0648\u0645\u0627\u062a|\u0645\u0639\u0644\u0648\u0645\u0629|\u0646\u0628\u0630\u0629)\s+\u0639\u0646\s+(.+?)[\u061f?!.,\u060c]*$/iu,
    /^(?:\u0645\u0627\u0630\u0627|\u0648\u0634|\u0627\u064a\u0634|\u0625\u064a\u0634)\s+\u062a\u0639\u0631\u0641\s+\u0639\u0646\s+(.+?)[\u061f?!.,\u060c]*$/iu,
    /^\u0645\u0627\s+\u062a\u0639\u0631\u0641\s+\u0639\u0646\s+(.+?)[\u061f?!.,\u060c]*$/iu,
    /^(?:\u062d\u062f\u062b\u0646\u064a|\u062d\u062f\u062b\u0646\u0627|\u0643\u0644\u0645\u0646\u064a|\u0643\u0644\u0645\u0646\u0627|\u062a\u0643\u0644\u0645)\s+(?:\u0644\u064a\s+)?\u0639\u0646\s+(.+?)[\u061f?!.,\u060c]*$/iu,
    /^(?:tell\s+me\s+about|information\s+about|about)\s+(.+?)[?!.]*$/i
  ];

  for (const re of topicPatterns) {
    const match = value.match(re);
    if (!match) continue;
    const person = personEntityFromMention(match[1], 0.94);
    if (
      person?.person_entity_frame?.provenance?.parser === 'structural' &&
      hasPersonDescriptorSignals(person.person_entity_frame)
    ) {
      return person;
    }
    const entity = cleanExtractedEntity('topic', match[1]);
    if (entity) return { type:'topic', text:entity, confidence:0.94 };
  }

  const stripped = stripSearchCommand(value);
  if (stripped && stripped !== value && stripped.split(/\s+/).length <= 12) {
    const entity = cleanExtractedEntity('topic', stripped);
    if (entity) return { type:'topic', text:entity, confidence:0.90 };
  }

  return null;
}

function classifyGeneralIntent(text) {
  const value = clean(text, 1000);
  const lower = value.toLowerCase();
  const entity = extractEntity(value);

  if (entity?.type === 'person') {
    return { intent:'person_lookup', confidence:0.98, requires_research:true };
  }

  if (entity?.type === 'relation') {
    return { intent:'relation_lookup', confidence:0.98, requires_research:true };
  }

  if (entity?.type === 'company') {
    return { intent:'company_lookup', confidence:0.96, requires_research:true };
  }

  if (entity?.type === 'topic') {
    return { intent:'web_research', confidence:0.92, requires_research:true };
  }

  if (/(?:^|\s)(?:\u0627\u0628\u062d\u062b|\u0627\u0628\u062d\u062b\u0648\u0627|\u0628\u062d\u062b|\u0641\u062a\u0634|\u062f\u0648\u0631\s+\u0644\u064a|\u062f\u0648\u0631\s+\u0644\u0646\u0627|\u0634\u0648\u0641\s+\u0644\u064a|\u0634\u0648\u0641\s+\u0644\u0646\u0627|search|look\s+up|find\s+online)(?:\s|$)/iu.test(value)) {
    return { intent:'web_research', confidence:0.98, requires_research:true };
  }

  if (/(?:\u0623\u062d\u062f\u062b|\u0627\u062d\u062f\u062b|\u0622\u062e\u0631\s+\u0627\u0644\u0623\u062e\u0628\u0627\u0631|\u0627\u062e\u0631\s+\u0627\u0644\u0627\u062e\u0628\u0627\u0631|\u0627\u0644\u064a\u0648\u0645|\u062d\u0627\u0644\u064a\u0627|latest|today|current|recent)(?:\s|$|[\u061f?,\u060c.])/iu.test(value)) {
    return { intent:'current_fact', confidence:0.94, requires_research:true };
  }

  if (/(?:\u0642\u0627\u0631\u0646|\u0645\u0642\u0627\u0631\u0646\u0629|compare|versus|\bvs\b)/iu.test(value)) {
    return { intent:'comparison', confidence:0.86, requires_research:true };
  }

  if (/^(?:\u0645\u0627\s+(?:\u0647\u0648|\u0647\u064a)|\u0645\u0627\u0630\u0627\s+\u064a\u0639\u0646\u064a|what\s+is|define)\s+\S+/iu.test(value)) {
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
  const personFrame = entity?.type === 'person' ? entity.person_entity_frame : null;
  const canonicalName = personFrame?.canonical_name || entity?.text || '';

  if (canonicalName) {
    if (entity.type === 'relation') {
      const relation = clean(entity?.relation?.value, 180);
      const organization = clean(entity?.organization?.value || canonicalName, 300);
      if (relation && organization) {
        variants.push(relation + ' ' + organization);
        variants.push(organization + ' ' + relation);
      }
      variants.push(organization);
    } else {
      variants.push(canonicalName);
    }

    if (entity.type === 'person') {
      const softSignals = [
        ...(personFrame?.organizations || []).map(item => item.value),
        ...(personFrame?.relations || []).map(item => item.value),
        ...(personFrame?.qualifiers || []).map(item => item.value)
      ].filter(Boolean);

      for (const signal of softSignals.slice(0, 2)) {
        variants.push(canonicalName + ' ' + signal);
      }

      variants.push(canonicalName + ' سيرة');
      variants.push(canonicalName + ' biography');
    } else if (entity.type === 'company') {
      variants.push(canonicalName + ' official');
      variants.push(canonicalName + ' about');
    }
  }

  if (stripped && stripped !== raw && entity?.type !== 'person') variants.push(stripped);
  variants.push(...aliases);
  if (normalized && normalized !== raw && entity?.type !== 'person') variants.push(normalized);
  if (entity?.type !== 'person') variants.push(raw);

  if (generalIntent?.intent === 'current_fact' && canonicalName) {
    variants.unshift(canonicalName + ' latest');
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
  const entityFrame = resolveEntityFrame(entity, { rawMention:entity?.text || raw });

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
    entity_frame:entityFrame,
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
      person_entity_frame: entity?.person_entity_frame || null,
      entity_frame:entityFrame,
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
  stripOutputInstructions,
  cleanExtractedEntity,
  extractEntity,
  classifyGeneralIntent,
  buildQueryVariants,
  resolveLanguageQuery
};
