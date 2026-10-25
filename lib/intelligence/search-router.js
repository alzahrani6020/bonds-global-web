'use strict';

const { findInstitutionalSources } = require('./institutional-source-registry');

const SEARCH_ROUTE_SCHEMA_VERSION = 1;

function clean(value, max = 500) {
  return String(value || '').replace(/\s+/g,' ').trim().slice(0,max);
}

function unique(values, limit = 10) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const v = clean(value);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

function searchProfile(intent = '') {
  const value = String(intent || '').toLowerCase();
  if (value.includes('academic') || value.includes('scholar')) {
    return { categories:'science', engines:'google scholar,arxiv' };
  }
  if (value.includes('news') || value.includes('market')) {
    return { categories:'news', engines:'google news,bing news,brave news' };
  }
  if (value.includes('technical') || value.includes('github')) {
    return { categories:'it', engines:'github' };
  }
  return { categories:'general', engines:'' };
}

function relationAliases(relation) {
  const value = clean(relation,120).toLowerCase();
  if (!value) return [];
  const groups = [
    {
      test:/^(?:رئيس|الرئيس|president)$/iu,
      aliases:['رئيس','الرئيس','president','chairman','chairperson','chief executive','chief executive officer','ceo']
    },
    {
      test:/(?:رئيس مجلس الادارة|رئيس مجلس الإدارة|chairman|chairperson)/iu,
      aliases:['رئيس مجلس الإدارة','رئيس مجلس الادارة','chairman','chairperson']
    },
    {
      test:/(?:الرئيس التنفيذي|رئيس تنفيذي|chief executive|ceo)/iu,
      aliases:['الرئيس التنفيذي','رئيس تنفيذي','chief executive','chief executive officer','ceo']
    },
    {
      test:/(?:وزير|minister)/iu,
      aliases:['وزير','minister']
    },
    {
      test:/(?:محافظ|governor)/iu,
      aliases:['محافظ','governor']
    }
  ];
  const group = groups.find(item => item.test.test(value));
  return group ? group.aliases : [relation];
}

function buildSearchRoute({ intent = '', entityFrame = null, query = '', country = null } = {}) {
  const profile = searchProfile(intent);
  const institutionalSources = findInstitutionalSources({
    entityFrame,
    query,
    intent,
    country,
    limit:6
  });

  const routedQueries = [];
  const baseQuery = clean(query);

  if (entityFrame?.entity_type === 'relation') {
    const relation = entityFrame.relations?.[0]?.value || '';
    const organization = entityFrame.organizations?.[0]?.value || entityFrame.canonical_name || '';
    const aliases = relationAliases(relation);
    for (const alias of aliases.slice(0,5)) {
      routedQueries.push([alias, organization].filter(Boolean).join(' '));
    }
    for (const source of institutionalSources.slice(0,3)) {
      for (const template of source.search_templates || []) {
        routedQueries.push(template.replace('{query}', [aliases[0] || relation, organization].filter(Boolean).join(' ')));
      }
    }
  } else {
    for (const source of institutionalSources.slice(0,3)) {
      for (const template of source.search_templates || []) {
        routedQueries.push(template.replace('{query}', baseQuery));
      }
    }
  }

  routedQueries.push(baseQuery);

  return Object.freeze({
    search_route_schema_version:SEARCH_ROUTE_SCHEMA_VERSION,
    intent:String(intent || 'information'),
    categories:profile.categories,
    engines:profile.engines,
    institutional_sources:institutionalSources,
    preferred_domains:unique(institutionalSources.flatMap(source => source.domains),20),
    query_variants:unique(routedQueries,10),
    relation_aliases:entityFrame?.entity_type === 'relation'
      ? relationAliases(entityFrame.relations?.[0]?.value)
      : []
  });
}

module.exports = {
  SEARCH_ROUTE_SCHEMA_VERSION,
  searchProfile,
  relationAliases,
  buildSearchRoute
};
