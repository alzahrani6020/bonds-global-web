'use strict';

const BONDS_ANSWER_BRIEF = Object.freeze({
  owner: 'bonds',
  id: 'BONDS-CAP-BRIEF-001',
  name: 'bonds.answer_brief',
  action: 'bonds_answer_brief'
});

const SOURCE_KINDS = new Set(['official', 'academic', 'reference', 'news', 'community', 'blog', 'unknown']);
const AUTHORITY_KINDS = new Set(['official', 'academic', 'reference']);
const MAX_SOURCES = 8;
const MAX_FACTS = 10;
const MAX_FACETS = 5;
const MAX_KEY_TERMS = 5;
const MAX_CONSENSUS = 5;
const MAX_CONFLICTS = 5;
const MAX_OPEN_QUESTIONS = 5;
const MAX_SIGNALS = 8;
const MAX_TEXT_CHARS = 6000;
const MAX_FIELD_WORDS = 40;

const CLAUSE_SPLIT = /[.!؟?\n]+|؛|;/u;
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;
const DATE_YEAR = /(?:19|20)\d{2}/;
const STOPWORDS = new Set(
  ('the and for with that this from into about what when where which are was were ' +
    'has have had will its their his her them they then than such also more most ' +
    'هذا هذه ذلك التي الذي الذين في من على إلى عن ما أن ان إن كان كانت يكون ' +
    'تم يتم بعد قبل عند كل بعض غير بين فوق تحت')
    .split(/\s+/)
    .filter(Boolean)
);
const CITATION_SIGNALS = [
  'according to', 'study', 'studies', 'report', 'survey', 'research',
  'cited', 'evidence', 'وفق', 'تقول', 'تقرير', 'أفاد', 'افاد',
  'أشارت', 'اشارت', 'دراسة', 'دراسات', 'بحث', 'بيانات'
];
const DEFINITION_SIGNALS = [
  ' is ', ' are ', ' was ', ' were ', 'defined as', 'known as', ' refers to',
  'هو ', 'هي ', 'يعرف بأنه', 'تعرف بأنها'
];
const NEGATION_SIGNALS = [
  'not ', ' no ', 'never', "n't", 'without', 'لا ', 'ليس ', 'ليست ', 'لم ', 'لن '
];

function words(text) {
  return String(text || '').split(/\s+/).filter(Boolean);
}

function capWords(text, limit = MAX_FIELD_WORDS) {
  return words(text).slice(0, limit).join(' ');
}

function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(TOKEN_SPLIT)
      .filter(token => token.length >= 3 && !STOPWORDS.has(token))
  );
}

function sentences(text) {
  return String(text || '')
    .split(CLAUSE_SPLIT)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normClaim(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function relevance(topic, text) {
  const topicTokens = tokens(topic);
  const docTokens = tokens(text);
  if (!topicTokens.size || !docTokens.size) return 0;
  let overlap = 0;
  for (const token of topicTokens) if (docTokens.has(token)) overlap += 1;
  return Math.round(100 * (2 * overlap) / (topicTokens.size + docTokens.size));
}

function discoverSources(topic, candidates) {
  const discovered = [];
  (candidates || []).forEach((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return;
    const title = String(candidate.title || '').replace(/\s+/g, ' ').trim();
    const text = String(candidate.text || '').slice(0, MAX_TEXT_CHARS);
    let kind = String(candidate.kind || 'unknown').trim().toLowerCase();
    if (!SOURCE_KINDS.has(kind)) kind = 'unknown';
    const source = {
      id: String(candidate.id || `src-${index + 1}`),
      title,
      publisher: String(candidate.publisher || 'unknown').replace(/\s+/g, ' ').trim() || 'unknown',
      kind,
      text,
      url: candidate.url || null
    };
    const score = relevance(topic, `${title} ${text}`);
    if (score <= 0) return;
    source.relevance = score;
    discovered.push(source);
  });
  discovered.sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id));
  return discovered.slice(0, MAX_SOURCES);
}

function verifySource(source, corpus) {
  const publisher = String(source.publisher || '').trim().toLowerCase();
  const title = String(source.title || '');
  const text = String(source.text || '');
  const kind = String(source.kind || 'unknown').trim().toLowerCase();
  let score = 0;
  const signals = [];
  if (publisher && publisher !== 'unknown') {
    score += 2;
    signals.push('publisher');
  }
  if (DATE_YEAR.test(`${source.published || ''} ${text}`)) {
    score += 1;
    signals.push('date');
  }
  const lowered = text.toLowerCase();
  const citationHits = CITATION_SIGNALS.reduce((count, signal) => {
    if (signal.split('').every(char => char.charCodeAt(0) < 128)) {
      const pattern = new RegExp(`\\b${signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return count + (pattern.test(lowered) ? 1 : 0);
    }
    return count + (lowered.includes(signal) ? 1 : 0);
  }, 0);
  if (citationHits) {
    score += Math.min(2, 0.5 * citationHits);
    signals.push('citations');
  }
  if (/\d/.test(text)) {
    score += 1;
    signals.push('numeric_data');
  }
  if (AUTHORITY_KINDS.has(kind)) {
    score += 2;
    signals.push('authority_kind');
  }
  const titleTokens = tokens(title);
  const others = (corpus || []).join(' ');
  if (titleTokens.size && others) {
    const otherTokens = tokens(others);
    for (const token of titleTokens) {
      if (otherTokens.has(token)) {
        score += 1;
        signals.push('cross_referenced');
        break;
      }
    }
  }
  const authority = Math.round(Math.min(1, score / 10) * 100) / 100;
  const uncertainty = authority >= 0.7 ? 'low' : authority >= 0.4 ? 'medium' : 'high';
  return {
    ...source,
    verification: { authority, signals: signals.slice(0, MAX_SIGNALS), uncertainty }
  };
}

function rankSources(sources) {
  const scored = (sources || []).map(source => {
    const relevanceScore = Number(source.relevance) || 0;
    const authority = Math.max(0, Math.min(1, Number(source.verification?.authority) || 0));
    return {
      ...source,
      rank_score: Math.round(0.6 * relevanceScore + 0.4 * authority * 100)
    };
  });
  scored.sort((a, b) =>
    b.rank_score - a.rank_score ||
    (Number(b.relevance) || 0) - (Number(a.relevance) || 0) ||
    String(a.id).localeCompare(String(b.id))
  );
  return scored.map((source, index) => ({ ...source, rank: index + 1 }));
}

function claimUncertainty(sentence) {
  const lowered = String(sentence || '').toLowerCase();
  const numeric = /\d/.test(sentence);
  const cited = CITATION_SIGNALS.some(signal => {
    if (signal.split('').every(char => char.charCodeAt(0) < 128)) {
      return new RegExp(`\\b${signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lowered);
    }
    return lowered.includes(signal);
  });
  if (numeric && cited) return 'low';
  if (numeric || cited) return 'medium';
  if (DEFINITION_SIGNALS.some(signal => lowered.includes(signal))) return 'high';
  return null;
}

function extractFacts(sources, topic) {
  const topicTokens = tokens(topic);
  const facts = [];
  const seen = new Set();
  for (const source of sources || []) {
    for (const rawSentence of sentences(source.text)) {
      const sentence = capWords(rawSentence);
      const uncertainty = claimUncertainty(sentence);
      if (!uncertainty) continue;
      const key = normClaim(sentence);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const sentenceTokens = tokens(sentence);
      let overlap = 0;
      for (const token of sentenceTokens) if (topicTokens.has(token)) overlap += 1;
      facts.push({
        claim: sentence,
        source_id: String(source.id || ''),
        evidence: sentence,
        uncertainty,
        overlap,
        order: facts.length
      });
    }
  }
  facts.sort((a, b) => b.overlap - a.overlap || a.order - b.order);
  return facts.slice(0, MAX_FACTS).map(fact => ({
    claim: fact.claim,
    source_id: fact.source_id,
    evidence: fact.evidence,
    uncertainty: fact.uncertainty
  }));
}

function negated(sentence) {
  const lowered = ` ${String(sentence || '').toLowerCase()} `;
  return NEGATION_SIGNALS.some(signal => lowered.includes(signal));
}

function analyzeTopic(topic, sources, facts) {
  const topicTokens = tokens(topic);
  const facets = [...topicTokens].sort().slice(0, MAX_FACETS);
  const counts = new Map();
  for (const source of sources || []) {
    for (const token of tokens(source.text)) counts.set(token, (counts.get(token) || 0) + 1);
  }
  const keyTerms = [...counts.keys()]
    .sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b))
    .slice(0, MAX_KEY_TERMS);
  const factSources = new Set(facts.map(fact => fact.source_id).filter(Boolean));
  const coverage = factSources.size === 0 ? 'none' : factSources.size === 1 ? 'single_source' : 'multi_source';
  const factTokens = facts.map(fact => [fact, tokens(fact.claim)]);
  const consensus = [];
  const conflicts = [];
  for (let i = 0; i < factTokens.length; i += 1) {
    const [leftFact, leftTokens] = factTokens[i];
    if (!leftTokens.size) continue;
    for (let j = i + 1; j < factTokens.length; j += 1) {
      const [rightFact, rightTokens] = factTokens[j];
      if (!rightTokens.size || leftFact.source_id === rightFact.source_id) continue;
      const score = jaccard(leftTokens, rightTokens);
      if (score >= 0.5 && consensus.length < MAX_CONSENSUS) {
        consensus.push(capWords(leftFact.claim, 12));
      } else if (
        score >= 1 / 3 &&
        negated(leftFact.claim) !== negated(rightFact.claim) &&
        conflicts.length < MAX_CONFLICTS
      ) {
        conflicts.push(`تعارض: «${capWords(leftFact.claim, 12)}» مقابل «${capWords(rightFact.claim, 12)}»`);
      }
    }
  }
  return {
    facets: facets.length ? facets : (topic ? [capWords(topic, 12)] : []),
    key_terms: keyTerms,
    coverage,
    consensus,
    conflicts
  };
}

function reportConfidence(sources, facts, topic) {
  const usable = sources.filter(source => ['low', 'medium'].includes(source.verification?.uncertainty)).length;
  const lowFacts = facts.filter(fact => fact.uncertainty === 'low').length;
  const level = usable >= 2 && lowFacts >= 1 ? 'high' : (usable >= 1 || facts.length) ? 'medium' : 'low';
  const first = sources[0];
  const basis = capWords(
    `topic states: "${words(topic).slice(0, 12).join(' ')}"` +
      (first ? `; best source: ${first.title || '?'} (${first.publisher || '?'})` : ''),
    MAX_FIELD_WORDS
  );
  return { level, basis };
}

function bondsAnswerBrief(topic, candidates) {
  const cleanTopic = capWords(String(topic || '').trim(), MAX_FIELD_WORDS);
  const emptyAnalysis = {
    facets: [],
    key_terms: [],
    coverage: 'none',
    consensus: [],
    conflicts: []
  };
  if (!cleanTopic) {
    return {
      ...BONDS_ANSWER_BRIEF,
      topic: '',
      sources: [],
      facts: [],
      analysis: emptyAnalysis,
      confidence: { level: 'low', basis: '' },
      open_questions: ['السؤال فارغ.']
    };
  }
  const discovered = discoverSources(cleanTopic, candidates);
  const verified = discovered.map((source, index) => verifySource(
    source,
    discovered.filter((_, other) => other !== index).map(item => item.text)
  ));
  const ranked = rankSources(verified);
  const facts = extractFacts(ranked, cleanTopic);
  const analysis = analyzeTopic(cleanTopic, ranked, facts);
  const confidence = reportConfidence(ranked, facts, cleanTopic);
  const openQuestions = [];
  if (!discovered.length) openQuestions.push('لا توجد صفحة ذات صلة بهذا السؤال.');
  else if (ranked.every(source => source.verification?.uncertainty === 'high')) {
    openQuestions.push('لم تتأكد جهة الصفحة.');
  }
  if (!facts.length) openQuestions.push('لا توجد جملة قابلة للاستخراج من الصفحة.');
  if (tokens(cleanTopic).size < 2) openQuestions.push('السؤال أقصر من أن يُفصَّل.');
  return {
    ...BONDS_ANSWER_BRIEF,
    topic: cleanTopic,
    sources: ranked,
    facts,
    analysis,
    confidence,
    open_questions: openQuestions.slice(0, MAX_OPEN_QUESTIONS)
  };
}

function leadRank(text) {
  const value = String(text || '');
  let rank = 0;
  if (/حالياً|حاليا|الحالي|الحالية|منذ|current|currently|since/iu.test(value)) rank += 2;
  if (DATE_YEAR.test(value)) rank += 1;
  return rank;
}

function chooseLead(candidates) {
  const rows = [];
  (candidates || []).forEach((text, index) => {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length < 12) return;
    rows.push({ value, index, rank: leadRank(value) });
  });
  rows.sort((a, b) => b.rank - a.rank || a.index - b.index);
  return rows[0]?.value || '';
}

module.exports = {
  BONDS_ANSWER_BRIEF,
  bondsAnswerBrief,
  chooseLead,
  leadRank
};
