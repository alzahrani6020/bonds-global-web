'use strict';

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0600-\u06ff_\s]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length >= 2);
}

function metricAliases(metric) {
  const values = [
    metric?.metric_key,
    metric?.display_name_ar,
    metric?.display_name_en
  ].filter(Boolean);

  const aliases = new Set();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) aliases.add(normalized);
    const tokens = tokenize(value);
    if (tokens.length > 1) aliases.add(tokens.join(' '));
  }
  return [...aliases];
}

function scoreMetric(question, metric) {
  const q = normalizeText(question);
  const qTokens = new Set(tokenize(question));
  let score = 0;

  for (const alias of metricAliases(metric)) {
    if (!alias) continue;
    if (q === alias) score = Math.max(score, 100);
    else if (q.includes(alias) && alias.length >= 4) score = Math.max(score, 70 + Math.min(alias.length, 20));

    const tokens = tokenize(alias);
    if (tokens.length) {
      const hits = tokens.filter(token => qTokens.has(token)).length;
      const ratio = hits / tokens.length;
      if (hits >= 1 && ratio >= 0.5) {
        score = Math.max(score, 20 + Math.round(ratio * 40) + Math.min(hits * 4, 16));
      }
    }
  }

  return score;
}

function detectIntent(question) {
  const q = normalizeText(question);
  const hasAny = terms => terms.some(term => q.includes(normalizeText(term)));

  if (hasAny(['المصدر', 'مصدر', 'source', 'من اين', 'من أين'])) return 'source';
  if (hasAny(['الفرق', 'الانحراف', 'variance', 'فوق الهدف', 'تحت الهدف', 'عن الهدف', 'عن هدف'])) return 'variance';
  if (hasAny(['الهدف', 'هدف', 'المستهدف', 'مستهدف', 'target', 'budget', 'الميزانيه'])) return 'target';
  if (hasAny(['الوحده', 'وحده', 'الوحدة', 'وحدة', 'unit'])) return 'unit';
  return 'actual';
}

function selectBaseTarget(governance, metricKey) {
  const targets = Array.isArray(governance?.targets) ? governance.targets : [];
  return targets.find(row =>
    row?.metric_key === metricKey &&
    row?.scenario === 'base'
  ) || null;
}

function answerNaturalLanguageAnalytics(question, governance = {}) {
  const rawQuestion = String(question || '').trim();
  if (!rawQuestion) {
    return {
      status: 'unknown',
      answer: 'UNKNOWN',
      reason: 'question required',
      evidence: []
    };
  }
  if (rawQuestion.length > 500) {
    return {
      status: 'unknown',
      answer: 'UNKNOWN',
      reason: 'question too long',
      evidence: []
    };
  }

  const metrics = Array.isArray(governance.metrics) ? governance.metrics : [];
  const scored = metrics
    .map(metric => ({ metric, score: scoreMetric(rawQuestion, metric) }))
    .filter(item => item.score >= 60)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      status: 'unknown',
      answer: 'UNKNOWN',
      reason: 'No governed metric matched the question.',
      candidates: [],
      evidence: [],
      supportedIntents: ['actual', 'target', 'variance', 'source', 'unit']
    };
  }

  const top = scored[0];
  const second = scored[1] || null;
  if (second && second.score === top.score && top.score < 90) {
    return {
      status: 'unknown',
      answer: 'UNKNOWN',
      reason: 'Question is ambiguous between governed metrics.',
      candidates: [top.metric, second.metric].map(metric => ({
        metric_key: metric.metric_key,
        display_name_ar: metric.display_name_ar,
        display_name_en: metric.display_name_en
      })),
      evidence: []
    };
  }

  const metric = top.metric;
  const metricKey = metric.metric_key;
  const intent = detectIntent(rawQuestion);
  const actual = finite(metric.actual);
  const targetRow = selectBaseTarget(governance, metricKey);
  const target = finite(targetRow?.target_value);

  let value = null;
  let answer = 'UNKNOWN';
  let reason = null;

  if (intent === 'actual') {
    value = actual;
    if (actual === null) reason = 'Current governed value is unavailable.';
    else answer = String(actual);
  } else if (intent === 'target') {
    value = target;
    if (target === null) reason = 'No active governed base target is available for this metric.';
    else answer = String(target);
  } else if (intent === 'variance') {
    if (actual === null || target === null) {
      reason = 'Variance requires both a governed current value and an active base target.';
    } else {
      value = actual - target;
      answer = String(value);
    }
  } else if (intent === 'source') {
    value = metric.source_key || null;
    if (!value) reason = 'Governed source metadata is unavailable.';
    else answer = String(value);
  } else if (intent === 'unit') {
    value = metric.unit || null;
    if (!value) reason = 'Governed unit metadata is unavailable.';
    else answer = String(value);
  }

  const evidence = [
    {
      type: 'metric_definition',
      metric_key: metricKey,
      display_name_ar: metric.display_name_ar || null,
      display_name_en: metric.display_name_en || null,
      unit: metric.unit || null,
      source_key: metric.source_key || null,
      version: metric.version || null,
      status: metric.status || null
    }
  ];

  if (actual !== null) {
    evidence.push({
      type: 'current_value',
      metric_key: metricKey,
      value: actual,
      as_of: governance.asOfDate || null
    });
  }

  if (targetRow) {
    evidence.push({
      type: 'base_target',
      metric_key: metricKey,
      target_value: target,
      comparison: targetRow.comparison || null,
      period_start: targetRow.period_start || null,
      period_end: targetRow.period_end || null,
      scenario: targetRow.scenario || null
    });
  }

  return {
    status: value === null ? 'unknown' : 'active',
    answer,
    reason,
    intent,
    confidence: top.score >= 90 ? 'high' : top.score >= 70 ? 'medium' : 'low',
    matchedMetric: {
      metric_key: metricKey,
      display_name_ar: metric.display_name_ar || null,
      display_name_en: metric.display_name_en || null,
      unit: metric.unit || null,
      source_key: metric.source_key || null
    },
    value,
    evidence,
    semantics: 'governed_metric_lookup_no_freeform_generation'
  };
}

module.exports = {
  normalizeText,
  detectIntent,
  answerNaturalLanguageAnalytics
};
