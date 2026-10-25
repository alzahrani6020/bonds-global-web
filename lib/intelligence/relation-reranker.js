'use strict';

const { isInstitutionalDomain } = require('./institutional-source-registry');
const { relationAliases } = require('./search-router');

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g,'')
    .replace(/[إأآٱ]/g,'ا')
    .replace(/ى/g,'ي')
    .replace(/[^\p{L}\p{N}.:/_-]+/gu,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function organizationAliases(entityFrame) {
  const raw = [
    entityFrame?.canonical_name,
    ...(entityFrame?.organizations || []).map(item => item?.value)
  ].filter(Boolean);
  const out = new Set();
  for (const value of raw) {
    const n = norm(value);
    if (!n) continue;
    out.add(n);
    out.add(n.replace(/^(?:شركة|company|corporation|corp)\s+/iu,'').trim());
  }
  return [...out].filter(Boolean);
}

function scoreRelationCandidate(row = {}, entityFrame = null) {
  if (!entityFrame || entityFrame.entity_type !== 'relation') {
    return { relevant:false, score:0, organization_support:0, relation_support:0, institutional_support:0 };
  }

  const text = norm([
    row.title,
    row.snippet,
    row.text,
    row.extracted?.title,
    row.extracted?.text,
    row.url
  ].filter(Boolean).join(' '));
  const orgAliases = organizationAliases(entityFrame);
  const relAliases = relationAliases(entityFrame.relations?.[0]?.value).map(norm).filter(Boolean);

  const organizationSupport = orgAliases.some(alias => alias && text.includes(alias)) ? 1 : 0;
  const relationMatches = relAliases.filter(alias => alias && text.includes(alias)).length;
  const relationSupport = relAliases.length ? Math.min(1, relationMatches / Math.min(2, relAliases.length)) : 0;
  const institutionalSource = isInstitutionalDomain(row.url || '');
  const institutionalSupport = institutionalSource ? institutionalSource.authority_score : 0;

  const score =
    organizationSupport * 0.5 +
    relationSupport * 0.3 +
    institutionalSupport * 0.2;

  return {
    relevant: Boolean(
      (organizationSupport && relationSupport) ||
      (institutionalSupport >= 0.95 && organizationSupport)
    ),
    score,
    organization_support:organizationSupport,
    relation_support:relationSupport,
    institutional_support:institutionalSupport,
    institutional_source:institutionalSource?.id || null
  };
}

function rankRelationAwareResults(results = [], entityFrame = null) {
  return (Array.isArray(results) ? results : [])
    .map((row,index) => ({ row,index,relation_relevance:scoreRelationCandidate(row,entityFrame) }))
    .filter(item => item.relation_relevance.relevant)
    .sort((a,b) =>
      b.relation_relevance.score - a.relation_relevance.score ||
      a.index - b.index
    )
    .map(item => ({
      ...item.row,
      relevance_score:item.relation_relevance.score,
      relevance_matches:Math.round(item.relation_relevance.score * 100),
      relation_relevance:item.relation_relevance
    }));
}

module.exports = {
  organizationAliases,
  scoreRelationCandidate,
  rankRelationAwareResults
};
